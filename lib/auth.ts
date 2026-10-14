// Hacko's own authentication: OAuth (Google, GitHub, LinkedIn) + e-mail magic link.
// Sessions are random tokens kept in an HttpOnly cookie; only their SHA-256 is stored in D1.
import { env } from "cloudflare:workers";

export type AuthUser = { userId: string; email: string; displayName: string };
export type Provider = "google" | "github" | "linkedin";

const SESSION_COOKIE = "hacko_session";
const STATE_COOKIE = "hacko_oauth";
const SESSION_DAYS = 30;
const LINK_MINUTES = 15;

const vars = env as unknown as Record<string, string | undefined>;
function db(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB unavailable");
  return env.DB;
}
const now = () => new Date().toISOString();

function randomToken(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function readCookie(header: string | null, name: string) {
  for (const part of (header || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function cookie(name: string, value: string, request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
// Only same-site relative paths (e.g. "/#/profile") are allowed as post-login destinations.
export function safeReturn(value: string | null) {
  const v = value || "/";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}
function redirect(location: string, cookies: string[] = []) {
  const h = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}
const loginError = (code: string) => redirect("/#/login?erro=" + code);

export async function userFromCookieHeader(cookieHeader: string | null): Promise<AuthUser | null> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token || !env.DB) return null;
  const row = await db()
    .prepare(
      "SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?",
    )
    .bind(await sha256(token), now())
    .first<{ id: string; email: string; name: string }>();
  return row ? { userId: row.id, email: row.email, displayName: row.name || row.email } : null;
}

async function startSession(userId: string, request: Request, returnTo: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db().batch([
    db().prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now()),
    db()
      .prepare("INSERT INTO sessions(id,user_id,expires_at,created_at) VALUES(?,?,?,?)")
      .bind(await sha256(token), userId, expires, now()),
  ]);
  return redirect(returnTo, [
    cookie(SESSION_COOKIE, token, request, SESSION_DAYS * 86400),
    cookie(STATE_COOKIE, "", request, 0),
  ]);
}

export async function logout(request: Request) {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (token && env.DB)
    await db()
      .prepare("DELETE FROM sessions WHERE id=?")
      .bind(await sha256(token))
      .run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie(SESSION_COOKIE, "", request, 0) },
  });
}

// Finds the account for a provider identity, linking by verified e-mail, or creates it.
async function upsertUser(provider: string, subject: string, email: string, name: string) {
  email = email.trim().toLowerCase();
  const linked = await db()
    .prepare("SELECT user_id FROM identities WHERE provider=? AND subject=?")
    .bind(provider, subject)
    .first<{ user_id: string }>();
  if (linked) return linked.user_id;
  const existing = await db()
    .prepare("SELECT id FROM users WHERE email=?")
    .bind(email)
    .first<{ id: string }>();
  const userId = existing?.id || crypto.randomUUID();
  await db().batch([
    ...(existing
      ? []
      : [
          db()
            .prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)")
            .bind(userId, email, name.slice(0, 160), now()),
        ]),
    db()
      .prepare("INSERT OR IGNORE INTO identities(provider,subject,user_id) VALUES(?,?,?)")
      .bind(provider, subject, userId),
  ]);
  return userId;
}

const PROVIDERS: Record<
  Provider,
  { authorize: string; token: string; scope: string; id: string; secret: string }
> = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    id: "GOOGLE_CLIENT_ID",
    secret: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    id: "GITHUB_CLIENT_ID",
    secret: "GITHUB_CLIENT_SECRET",
  },
  linkedin: {
    authorize: "https://www.linkedin.com/oauth/v2/authorization",
    token: "https://www.linkedin.com/oauth/v2/accessToken",
    scope: "openid email profile",
    id: "LINKEDIN_CLIENT_ID",
    secret: "LINKEDIN_CLIENT_SECRET",
  },
};
export const enabledProviders = () =>
  (Object.keys(PROVIDERS) as Provider[]).filter((p) => vars[PROVIDERS[p].id] && vars[PROVIDERS[p].secret]);

// GET /api/auth/<provider>: without ?code starts the flow, with ?code finishes it.
export async function oauth(provider: Provider, request: Request) {
  const p = PROVIDERS[provider];
  const clientId = vars[p.id],
    secret = vars[p.secret];
  if (!clientId || !secret) return loginError("provedor_indisponivel");
  const url = new URL(request.url);
  const callback = url.origin + "/api/auth/" + provider;
  const code = url.searchParams.get("code");
  if (!code) {
    if (url.searchParams.get("error")) return loginError("cancelado");
    const state = randomToken(16);
    const returnTo = safeReturn(url.searchParams.get("return_to"));
    const auth = new URL(p.authorize);
    auth.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      response_type: "code",
      scope: p.scope,
      state,
      ...(provider === "google" ? { prompt: "select_account" } : {}),
    }).toString();
    return redirect(auth.toString(), [cookie(STATE_COOKIE, state + "|" + returnTo, request, 600)]);
  }
  const [expected, returnTo] = (readCookie(request.headers.get("cookie"), STATE_COOKIE) || "").split("|");
  if (!expected || expected !== url.searchParams.get("state")) return loginError("sessao_expirada");
  try {
    const tokenRes = await fetch(p.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callback,
        client_id: clientId,
        client_secret: secret,
      }),
    });
    const tok: any = await tokenRes.json();
    if (!tok.access_token) return loginError("falha_login");
    const bearer = {
      Authorization: "Bearer " + tok.access_token,
      "User-Agent": "Hacko",
      Accept: "application/json",
    };
    let subject = "",
      email = "",
      name = "",
      verified = false;
    if (provider === "github") {
      const u: any = await (await fetch("https://api.github.com/user", { headers: bearer })).json();
      const emails: any[] = await (
        await fetch("https://api.github.com/user/emails", { headers: bearer })
      ).json();
      const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) : null;
      subject = String(u.id || "");
      name = u.name || u.login || "";
      email = primary?.email || "";
      verified = !!primary;
    } else {
      const info =
        provider === "google"
          ? "https://openidconnect.googleapis.com/v1/userinfo"
          : "https://api.linkedin.com/v2/userinfo";
      const u: any = await (await fetch(info, { headers: bearer })).json();
      subject = String(u.sub || "");
      name = u.name || [u.given_name, u.family_name].filter(Boolean).join(" ");
      email = u.email || "";
      // LinkedIn may omit email_verified; its OIDC e-mail is the account's confirmed primary address.
      verified =
        u.email_verified === true || u.email_verified === "true" || (provider === "linkedin" && !!email);
    }
    if (!subject || !email || !verified) return loginError("email_nao_verificado");
    const userId = await upsertUser(provider, subject, email, name);
    return startSession(userId, request, safeReturn(returnTo));
  } catch (e) {
    console.error("OAuth error", provider, (e as Error)?.name);
    return loginError("falha_login");
  }
}

// POST /api/auth/email {email, return_to}: sends a one-time sign-in link.
export async function sendEmailLink(request: Request) {
  const json = (data: object, status = 200) =>
    Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Origem inválida." }, 403);
  const body: any = await request.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return json({ error: "Informe um e-mail válido." }, 400);
  const recent = await db()
    .prepare("SELECT count(*) n, max(created_at) last FROM login_tokens WHERE email=? AND created_at>?")
    .bind(email, new Date(Date.now() - 3600000).toISOString())
    .first<{ n: number; last: string | null }>();
  if (recent && (recent.n >= 5 || (recent.last && Date.now() - Date.parse(recent.last) < 60000)))
    return json({ error: "Aguarde um pouco antes de pedir outro link." }, 429);
  const token = randomToken();
  const link =
    new URL(request.url).origin +
    "/api/auth/email?token=" +
    token +
    "&return_to=" +
    encodeURIComponent(safeReturn(body.return_to));
  await db().batch([
    db()
      .prepare("DELETE FROM login_tokens WHERE created_at<=?")
      .bind(new Date(Date.now() - 86400000).toISOString()),
    db()
      .prepare("INSERT INTO login_tokens(id,email,expires_at,created_at) VALUES(?,?,?,?)")
      .bind(await sha256(token), email, new Date(Date.now() + LINK_MINUTES * 60000).toISOString(), now()),
  ]);
  if (!vars.RESEND_API_KEY) {
    if (new URL(request.url).hostname !== "localhost" && new URL(request.url).hostname !== "127.0.0.1")
      return json({ error: "Login por e-mail ainda não está configurado." }, 503);
    console.log("[dev] link de login para", email, link);
    return json({ ok: true, dev: true });
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + vars.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: vars.AUTH_FROM_EMAIL || "Hacko <login@hacko.com.br>",
      to: email,
      subject: "Seu link de acesso à Hacko",
      text: `Use este link para entrar na Hacko (válido por ${LINK_MINUTES} minutos):\n\n${link}\n\nSe você não pediu este acesso, ignore este e-mail.`,
      html: `<p>Use o botão abaixo para entrar na <b>hacko↗</b>. O link vale por ${LINK_MINUTES} minutos.</p><p><a href="${link}" style="background:#0367FC;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Entrar na Hacko</a></p><p style="color:#626975;font-size:13px">Se você não pediu este acesso, ignore este e-mail.</p>`,
    }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status);
    return json({ error: "Não foi possível enviar o e-mail agora." }, 502);
  }
  return json({ ok: true });
}

// GET /api/auth/email?token=...: consumes the link (single use) and signs in.
export async function verifyEmailLink(request: Request) {
  const url = new URL(request.url);
  const id = await sha256(url.searchParams.get("token") || "");
  const row = await db()
    .prepare(
      "UPDATE login_tokens SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? RETURNING email",
    )
    .bind(now(), id, now())
    .first<{ email: string }>();
  if (!row) return loginError("link_invalido");
  const userId = await upsertUser("email", row.email, row.email, row.email.split("@")[0]);
  return startSession(userId, request, safeReturn(url.searchParams.get("return_to")));
}
