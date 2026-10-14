// Hacko's own authentication: OAuth (Google, GitHub, LinkedIn) + e-mail magic link.
// Sessions are random tokens kept in an HttpOnly cookie; only their SHA-256 is stored in D1.
import { env } from "cloudflare:workers";

export type AuthUser = { userId: string; email: string; displayName: string };
export type Provider = "google" | "github" | "linkedin";

const SESSION_COOKIE = "hacko_session";
const STATE_COOKIE = "hacko_oauth";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000; // limite máximo do Web Crypto nos Workers

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
// Contas criadas com senha não têm e-mail verificado: se o dono real do e-mail entrar por um provedor,
// a senha anterior e as sessões abertas são invalidadas (impede sequestro de conta por pré-cadastro).
async function upsertUser(provider: string, subject: string, email: string, name: string) {
  email = email.trim().toLowerCase();
  const linked = await db()
    .prepare("SELECT user_id FROM identities WHERE provider=? AND subject=?")
    .bind(provider, subject)
    .first<{ user_id: string }>();
  if (linked) return linked.user_id;
  const existing = await db()
    .prepare("SELECT id,email_verified FROM users WHERE email=?")
    .bind(email)
    .first<{ id: string; email_verified: number }>();
  const userId = existing?.id || crypto.randomUUID();
  await db().batch([
    ...(existing
      ? existing.email_verified
        ? []
        : [
            db().prepare("UPDATE users SET password_hash=NULL,email_verified=1 WHERE id=?").bind(userId),
            db().prepare("DELETE FROM sessions WHERE user_id=?").bind(userId),
          ]
      : [
          db()
            .prepare("INSERT INTO users(id,email,name,email_verified,created_at) VALUES(?,?,?,1,?)")
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
// With ?popup=1 the flow runs in a popup window (account chooser), which then hands the
// result back to the page that opened it and closes itself.
export async function oauth(provider: Provider, request: Request) {
  const url = new URL(request.url);
  const finishing = url.searchParams.has("code") || url.searchParams.has("error");
  const popup = finishing
    ? (readCookie(request.headers.get("cookie"), STATE_COOKIE) || "").split("|")[2] === "1"
    : url.searchParams.get("popup") === "1";
  const res = await oauthFlow(provider, request, popup);
  const to = res.headers.get("Location");
  if (!popup || !to || !to.startsWith("/")) return res;
  const headers = new Headers(res.headers);
  headers.delete("Location");
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'");
  const target = JSON.stringify(to).replace(/</g, "\\u003c");
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Hacko</title><script>` +
      `var t=${target};try{if(window.opener&&!window.opener.closed){window.opener.postMessage({hacko:"login",to:t},location.origin);window.close()}}catch(e){}location.replace(t)` +
      `</script>`,
    { status: 200, headers },
  );
}

async function oauthFlow(provider: Provider, request: Request, popup: boolean) {
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
    return redirect(auth.toString(), [
      cookie(STATE_COOKIE, state + "|" + returnTo + (popup ? "|1" : ""), request, 600),
    ]);
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

// ===== Cadastro e login com e-mail e senha =====
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256),
  );
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(password, salt, PBKDF2_ITERATIONS))}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const [alg, iter, salt, hash] = (stored || "").split("$");
  // Mesmo custo quando a conta não existe, para não revelar pelo tempo quais e-mails estão cadastrados.
  const actual = await pbkdf2(
    password,
    salt ? unb64(salt) : new Uint8Array(16),
    Math.min(Number(iter) || PBKDF2_ITERATIONS, PBKDF2_ITERATIONS),
  );
  if (alg !== "pbkdf2" || !hash) return false;
  const expected = unb64(hash);
  let diff = expected.length ^ actual.length;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  return diff === 0;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILURES = 10,
  FAILURE_WINDOW_MS = 15 * 60000;
const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function credentials(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Origem inválida.", 403);
  const body: any = await request.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  if (!EMAIL_RE.test(email) || email.length > 254) return fail("Informe um e-mail válido.", 400);
  if (!password || password.length > 200) return fail("Informe sua senha.", 400);
  return { email, password };
}
async function sessionResponse(userId: string, request: Request) {
  const r = await startSession(userId, request, "/");
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  for (const c of r.headers.getSetCookie()) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify({ ok: true }), { headers });
}

// POST /api/auth/signup {email, password}
export async function signup(request: Request) {
  const c = await credentials(request);
  if (c instanceof Response) return c;
  const weak = passwordProblems(c.password);
  if (weak.length) return fail("A senha precisa ter " + weak.join(", ") + ".", 400);
  if (await db().prepare("SELECT 1 FROM users WHERE email=?").bind(c.email).first())
    return fail("Este e-mail já tem conta. Entre com sua senha ou pelo Google, GitHub ou LinkedIn.", 409);
  const userId = crypto.randomUUID();
  try {
    await db()
      .prepare("INSERT INTO users(id,email,name,password_hash,email_verified,created_at) VALUES(?,?,?,?,0,?)")
      .bind(userId, c.email, c.email.split("@")[0], await hashPassword(c.password), now())
      .run();
  } catch (e) {
    if (String((e as Error)?.message).includes("UNIQUE")) return fail("Este e-mail já tem conta.", 409);
    throw e;
  }
  return sessionResponse(userId, request);
}

// POST /api/auth/login {email, password}
export async function login(request: Request) {
  const c = await credentials(request);
  if (c instanceof Response) return c;
  const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
  const failures = await db()
    .prepare("SELECT count(*) n FROM login_failures WHERE email=? AND created_at>?")
    .bind(c.email, since)
    .first<{ n: number }>();
  if ((failures?.n || 0) >= MAX_FAILURES)
    return fail("Muitas tentativas. Aguarde 15 minutos e tente novamente.", 429);
  const user = await db()
    .prepare("SELECT id,password_hash FROM users WHERE email=?")
    .bind(c.email)
    .first<{ id: string; password_hash: string | null }>();
  if (!(await verifyPassword(c.password, user?.password_hash || null))) {
    await db().batch([
      db().prepare("DELETE FROM login_failures WHERE created_at<=?").bind(since),
      db().prepare("INSERT INTO login_failures(email,created_at) VALUES(?,?)").bind(c.email, now()),
    ]);
    return fail(
      user && !user.password_hash
        ? "Esta conta entra pelo Google, GitHub ou LinkedIn."
        : "E-mail ou senha incorretos.",
      401,
    );
  }
  await db().prepare("DELETE FROM login_failures WHERE email=?").bind(c.email).run();
  return sessionResponse(user!.id, request);
}

// Regras mínimas da senha (mesmas exibidas no cadastro).
export function passwordProblems(password: string) {
  const missing: string[] = [];
  if (password.length < 8) missing.push("pelo menos 8 caracteres");
  if (!/[A-Z]/.test(password)) missing.push("uma letra maiúscula");
  if (!/[0-9]/.test(password)) missing.push("um número");
  return missing;
}
