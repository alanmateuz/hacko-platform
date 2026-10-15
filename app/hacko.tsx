"use client";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { searchCatalog, normalize } from "../lib/domain.mjs";
type Row = Record<string, any>;
// Brand arrow (identidade visual Hacko): diagonal com ponta em "L".
function Arrow({ color = "currentColor", size = "0.62em" }: { color?: string; size?: string }) {
  return (
    <svg className="brand-arrow" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21 19.5 4.5M7.5 3.5h13v13" stroke={color} strokeWidth="3.4" fill="none" />
    </svg>
  );
}
function Logo({ arrow = "var(--lime)" }: { arrow?: string }) {
  return (
    <span className="wordmark">
      hacko
      <Arrow color={arrow} />
    </span>
  );
}
const photo = (n = 0) => (n === 3 ? "/brand/cover.svg" : `/assets/photo${n}.jpg`);
const imageUrl = (key: string, v: string) =>
  `/api/hacko?action=image&id=${encodeURIComponent(key)}&v=${encodeURIComponent(v)}`;
const coverOf = (e: Row) => (e.cover_v ? imageUrl("cover:" + e.id, e.cover_v) : photo(e.image));
function Avatar({ p, size }: { p: Row; size?: "lg" }) {
  const initials = (p.name || "?").slice(0, 2).toUpperCase();
  return (
    <div className={"avatar" + (size ? " " + size : "")} aria-hidden="true">
      {p.avatar_v ? <img src={imageUrl("avatar:" + p.id, p.avatar_v)} alt="" /> : initials}
    </div>
  );
}
// Downscales and re-encodes in the browser so uploads stay small (and EXIF/GPS metadata is dropped).
async function resizeImage(file: File, maxW: number, maxH: number, crop = false): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw Error("Use uma imagem JPG, PNG ou WebP.");
  if (file.size > 15_000_000) throw Error("Imagem muito grande (máx. 15 MB).");
  const bmp = await createImageBitmap(file);
  let sx = 0,
    sy = 0,
    sw = bmp.width,
    sh = bmp.height;
  if (crop) {
    const ratio = maxW / maxH;
    if (sw / sh > ratio) {
      sw = Math.round(sh * ratio);
      sx = Math.round((bmp.width - sw) / 2);
    } else {
      sh = Math.round(sw / ratio);
      sy = Math.round((bmp.height - sh) / 2);
    }
  }
  const scale = Math.min(1, maxW / sw, maxH / sh);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  for (const q of [0.85, 0.75, 0.6]) {
    const url = canvas.toDataURL("image/webp", q);
    const out = url.startsWith("data:image/webp") ? url : canvas.toDataURL("image/jpeg", q);
    if (out.length < 1_000_000) return out;
  }
  throw Error("Não foi possível comprimir a imagem.");
}
function ImageInput({ label, help, current, aspect, onChange }: any) {
  const [preview, setPreview] = useState<string>(current || "");
  const [err, setErr] = useState("");
  return (
    <div className="image-input">
      <span>{label}</span>
      <div className={"image-preview " + aspect}>
        {preview ? <img src={preview} alt="Pré-visualização" /> : <span>Nenhuma imagem</span>}
      </div>
      <div className="actions">
        <label className="button secondary file-button">
          Escolher imagem
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (ev) => {
              const f = ev.target.files?.[0];
              ev.target.value = "";
              if (!f) return;
              setErr("");
              try {
                const data = await resizeImage(
                  f,
                  ...((aspect === "square" ? [400, 400, true] : [1600, 640, true]) as [
                    number,
                    number,
                    boolean,
                  ]),
                );
                setPreview(data);
                onChange(data);
              } catch (e: any) {
                setErr(e.message);
              }
            }}
          />
        </label>
        {preview && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setPreview("");
              onChange(null);
            }}
          >
            Remover
          </button>
        )}
      </div>
      {help && <small>{help}</small>}
      {err && (
        <small role="alert" className="error-text">
          {err}
        </small>
      )}
    </div>
  );
}
const date = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
const nav = (s: string) => {
  location.hash = s;
};
const href = (s: string) => "#" + s;
// "Maria Clara de Souza" → "Maria Souza" (primeiro nome + último sobrenome).
const shortName = (name?: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[0] + " " + parts[parts.length - 1] : parts[0] || "";
};
const tags = (s = "") =>
  s
    .split(",")
    .filter(Boolean)
    .map((x: string) => (
      <span className="tag" key={x}>
        {x.trim()}
      </span>
    ));
const status = (s: string) =>
  ({
    draft: "Rascunho",
    published: "Publicado",
    archived: "Arquivado",
    forming: "Em formação",
    confirmed: "Confirmada",
    active: "Confirmada",
    cancelled: "Cancelada",
    pending: "Pendente",
    accepted: "Aceita",
    rejected: "Recusada",
  })[s] || s;
async function api(action: string, id = "") {
  const r = await fetch(`/api/hacko?action=${action}&id=${encodeURIComponent(id)}`, { cache: "no-store" });
  const d: Row = await r.json();
  if (!r.ok) throw Error(d.error || "Falha ao carregar");
  return d;
}
function Field({ name, label, value = "", type = "text", required = false, options, help }: any) {
  return (
    <label>
      {label}
      {options ? (
        <select name={name} defaultValue={value} required={required}>
          {options.map((s: string) => (
            <option key={s} value={s}>
              {s || "Todos"}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea name={name} defaultValue={value} required={required} />
      ) : (
        <input name={name} type={type} defaultValue={value} required={required} />
      )}{" "}
      {help && <small>{help}</small>}
    </label>
  );
}
function Form({ children, onSubmit, label = "Salvar", busy }: any) {
  return (
    <form
      className="form wide"
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        onSubmit(f);
      }}
    >
      {children}
      <button disabled={busy} type="submit">
        {busy ? "Aguarde…" : label}
      </button>
    </form>
  );
}
function Person({ p }: any) {
  return (
    <article className="panel">
      <div className="person">
        <Avatar p={p} />
        <div>
          <h3>{p.name}</h3>
          <small>
            {p.city} {p.availability && "· " + p.availability}
          </small>
        </div>
      </div>
      <p>{p.bio}</p>
      <div className="tags">{tags(p.skills)}</div>
      <div className="actions">
        {p.linkedin && (
          <a href={p.linkedin} target="_blank" rel="noreferrer">
            LinkedIn ↗
          </a>
        )}
        {p.github && (
          <a href={p.github} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        )}
      </div>
    </article>
  );
}
function windowState(e: Row) {
  const t = new Date().toISOString();
  if (e.status !== "published") return "draft";
  if (t < e.opens_at) return "soon";
  if (t >= e.closes_at) return "closed";
  if (e.participants != null && e.participants >= e.capacity) return "full";
  return "open";
}
const LOGIN_ERRORS: Record<string, string> = {
  cancelado: "Login cancelado.",
  sessao_expirada: "A tentativa de login expirou. Tente novamente.",
  falha_login: "Não foi possível entrar agora. Tente novamente.",
  email_nao_verificado: "Sua conta não tem um e-mail verificado. Use outra forma de login.",
  provedor_indisponivel: "Essa forma de login ainda não está disponível.",
};
const PROVIDER_LABEL: Record<string, string> = { google: "Google", github: "GitHub", linkedin: "LinkedIn" };
const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ["Mínimo de 8 caracteres", (p) => p.length >= 8],
  ["Uma letra maiúscula", (p) => /[A-Z]/.test(p)],
  ["Um número", (p) => /[0-9]/.test(p)],
];
const passwordValid = (p: string) => PASSWORD_RULES.every(([, ok]) => ok(p));
// 0 = fraca, 1 = mais ou menos, 2 = forte. Forte exige as regras + tamanho/variedade extra.
function passwordStrength(p: string) {
  if (!passwordValid(p)) return 0;
  const extra = [p.length >= 12, /[a-z]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
  return extra >= 2 ? 2 : 1;
}
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}
function PasswordInput({
  name,
  autoComplete,
  value,
  onChange,
}: {
  name: string;
  autoComplete: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input">
      <input
        name={name}
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={onChange && ((e) => onChange(e.target.value))}
      />
      <button
        type="button"
        className="eye"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
      >
        <EyeIcon open={!visible} />
      </button>
    </span>
  );
}
function PasswordStrength({ password }: { password: string }) {
  const level = passwordStrength(password);
  const labels = ["Senha fraca", "Senha mais ou menos", "Senha forte"];
  return (
    <div className="password-meter" aria-live="polite">
      <ul className="password-rules">
        {PASSWORD_RULES.map(([label, ok]) => (
          <li key={label} className={ok(password) ? "ok" : ""}>
            <span aria-hidden="true">{ok(password) ? "✓" : "○"}</span> {label}
          </li>
        ))}
      </ul>
      {password && (
        <>
          <div className={"strength-bar level-" + level} aria-hidden="true">
            <span />
          </div>
          <small className={"strength-label level-" + level}>{labels[level]}</small>
        </>
      )}
    </div>
  );
}
const PROVIDER_ICONS: Record<string, ReactNode> = {
  google: (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  ),
  github: (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  ),
  linkedin: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.1 9.5H4.7V19h2.4V9.5zM5.9 5.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM19.3 13.8c0-2.6-1.4-4.5-4-4.5-1.3 0-2.2.7-2.6 1.4V9.5h-2.3V19h2.4v-4.7c0-1.3.3-2.5 1.9-2.5 1.5 0 1.6 1.4 1.6 2.6V19h2.4l.6-5.2z"
      />
    </svg>
  ),
};
// Google abre o seletor de contas em uma janela pop-up; GitHub e LinkedIn levam ao site do provedor.
function startProviderLogin(p: string, returnTo: string, accountType = "participant") {
  const url = `/api/auth/${p}?return_to=${encodeURIComponent(returnTo)}&account_type=${accountType}`;
  if (p !== "google") return (location.href = url);
  const w = 480,
    h = 640;
  const left = window.screenX + (window.outerWidth - w) / 2,
    top = window.screenY + (window.outerHeight - h) / 2;
  const popup = window.open(
    url + "&popup=1",
    "hacko-google",
    `width=${w},height=${h},left=${left},top=${top}`,
  );
  if (!popup) return (location.href = url); // pop-up bloqueado: segue no mesmo separador
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin || e.data?.hacko !== "login") return;
    window.removeEventListener("message", onMessage);
    location.href = e.data.to;
    location.reload();
  };
  window.addEventListener("message", onMessage);
}
async function postJson(path: string, body: Row) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = (await r.json().catch(() => ({}))) as Row;
  if (!r.ok) throw Error(d.error || "Não foi possível continuar.");
  return d;
}
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<{ sent?: boolean; error?: string; busy?: boolean }>({});
  return state.sent ? (
    <div className="login-options">
      <p className="notice" role="status">
        Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele vale por 30
        minutos. Confira também a caixa de spam.
      </p>
      <button type="button" className="ghost" onClick={onBack}>
        ← Voltar para o login
      </button>
    </div>
  ) : (
    <form
      className="form wide login-options"
      onSubmit={async (e) => {
        e.preventDefault();
        setState({ busy: true });
        try {
          await postJson("/api/auth/forgot", { email: new FormData(e.currentTarget).get("email") });
          setState({ sent: true });
        } catch (err: any) {
          setState({ error: err.message });
        }
      }}
    >
      <p>Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
      <label>
        E-mail
        <input name="email" type="email" required autoComplete="email" />
      </label>
      {state.error && (
        <small role="alert" className="error-text">
          {state.error}
        </small>
      )}
      <button type="submit" disabled={state.busy}>
        {state.busy ? "Enviando…" : "Enviar link"}
      </button>
      <button type="button" className="ghost" onClick={onBack}>
        ← Voltar para o login
      </button>
    </form>
  );
}
function ResetPassword() {
  const token = new URLSearchParams(location.hash.split("?")[1] || "").get("token") || "";
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ error?: string; busy?: boolean }>({});
  if (!token)
    return (
      <p className="alert" role="alert">
        Link inválido. <a href="#/login">Peça um novo na tela de login.</a>
      </p>
    );
  return (
    <form
      className="form wide login-options"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Row;
        if (!passwordValid(password)) return setState({ error: "A senha não atende aos requisitos." });
        if (password !== f.confirm) return setState({ error: "As senhas não conferem." });
        setState({ busy: true });
        try {
          await postJson("/api/auth/reset", { token, password });
          location.hash = "/profile";
          location.reload();
        } catch (err: any) {
          setState({ error: err.message });
        }
      }}
    >
      <label>
        Nova senha
        <PasswordInput name="password" autoComplete="new-password" value={password} onChange={setPassword} />
      </label>
      <PasswordStrength password={password} />
      <label>
        Confirmar nova senha
        <PasswordInput name="confirm" autoComplete="new-password" />
      </label>
      {state.error && (
        <small role="alert" className="error-text">
          {state.error}
        </small>
      )}
      <button type="submit" disabled={state.busy || !passwordValid(password)}>
        {state.busy ? "Salvando…" : "Salvar nova senha"}
      </button>
      <small>Por segurança, você será desconectado de todos os outros dispositivos.</small>
    </form>
  );
}
function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<{ error?: string; busy?: boolean }>({});
  return (
    <section className="panel danger-zone">
      <h3>Excluir conta</h3>
      <p>
        Apaga seu perfil, foto, inscrições, equipes, favoritos, notificações e as organizações sem outros
        participantes. Não dá para desfazer.
      </p>
      {!open ? (
        <button type="button" className="danger" onClick={() => setOpen(true)}>
          Excluir minha conta
        </button>
      ) : (
        <form
          className="form wide"
          onSubmit={async (e) => {
            e.preventDefault();
            setState({ busy: true });
            try {
              await postJson("/api/hacko", { op: "account.delete", confirm: text });
              location.hash = "/";
              location.reload();
            } catch (err: any) {
              setState({ error: err.message });
            }
          }}
        >
          <label>
            Para confirmar, digite EXCLUIR
            <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          </label>
          {state.error && (
            <small role="alert" className="error-text">
              {state.error}
            </small>
          )}
          <div className="actions">
            <button type="submit" className="danger" disabled={state.busy || text !== "EXCLUIR"}>
              {state.busy ? "Excluindo…" : "Excluir definitivamente"}
            </button>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
function LoginOptions({ providers, passwordReset }: { providers: string[]; passwordReset: boolean }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [state, setState] = useState<{ error?: string; busy?: boolean }>({});
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const [role, setRole] = useState<"participant" | "company">(
    location.hash.includes("empresa") ? "company" : "participant",
  );
  const company = role === "company";
  const home = company ? "/company" : "/profile";
  const urlError = new URLSearchParams(location.hash.split("?")[1] || "").get("erro");
  const signup = mode === "signup";
  if (forgot) return <ForgotPassword onBack={() => setForgot(false)} />;
  return (
    <div className="login-options">
      <div className="role-switch" role="radiogroup" aria-label="Tipo de conta">
        {(
          [
            ["participant", "Sou participante", "Quero participar de hackathons"],
            ["company", "Sou uma empresa", "Quero organizar hackathons"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            className={role === value ? "active" : ""}
            onClick={() => {
              setRole(value);
              setState({});
            }}
          >
            <b>{label}</b>
            <small>{hint}</small>
          </button>
        ))}
      </div>
      <div className="auth-tabs" role="tablist">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? "active" : ""}
            onClick={() => {
              setMode(m);
              setState({});
              setPassword("");
            }}
          >
            {m === "login" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>
      {urlError && !state.error && (
        <p className="alert" role="alert">
          {LOGIN_ERRORS[urlError] || "Não foi possível entrar."}
        </p>
      )}
      <form
        className="form wide"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Row;
          if (signup && !passwordValid(f.password))
            return setState({ error: "A senha não atende aos requisitos." });
          if (signup && f.password !== f.confirm) return setState({ error: "As senhas não conferem." });
          setState({ busy: true });
          const r = await fetch("/api/auth/" + mode, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: f.name, email: f.email, password: f.password, account_type: role }),
          });
          const d = (await r.json().catch(() => ({}))) as Row;
          if (!r.ok) return setState({ error: d.error || "Não foi possível continuar." });
          // Depois de entrar, o perfil (de participante ou da empresa) é completado na própria Hacko.
          location.hash = d.accountType === "company" ? "/company" : "/profile";
          location.reload();
        }}
      >
        {signup && (
          <label>
            {company ? "Nome da empresa" : "Nome e sobrenome"}
            <input
              name="name"
              required
              minLength={2}
              maxLength={160}
              autoComplete={company ? "organization" : "name"}
            />
          </label>
        )}
        <label>
          {company ? "E-mail da empresa" : "E-mail"}
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Senha
          <PasswordInput
            name="password"
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={setPassword}
          />
        </label>
        {signup && <PasswordStrength password={password} />}
        {signup && (
          <label>
            Confirmar senha
            <PasswordInput name="confirm" autoComplete="new-password" />
          </label>
        )}
        {state.error && (
          <small role="alert" className="error-text">
            {state.error}
          </small>
        )}
        <button type="submit" disabled={state.busy || (signup && !passwordValid(password))}>
          {state.busy ? "Aguarde…" : signup ? "Criar conta" : "Entrar"}
        </button>
      </form>
      {providers.length > 0 && (
        <>
          <div className="divider">
            <span>ou continue com</span>
          </div>
          <div className="provider-buttons">
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                className={"provider " + p}
                onClick={() => startProviderLogin(p, "/#" + home, role)}
              >
                {PROVIDER_ICONS[p]}
                <span>{PROVIDER_LABEL[p]}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <small>
        {signup ? (
          <>
            Ao criar a conta, você concorda com os{" "}
            <a href="/termos" target="_blank">
              Termos de uso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" target="_blank">
              Política de Privacidade
            </a>
            . Depois, é só completar seu perfil.
          </>
        ) : (
          <>
            Ainda não tem conta? Clique em “Criar conta”.
            {passwordReset && (
              <>
                {" "}
                <button type="button" className="link-button" onClick={() => setForgot(true)}>
                  Esqueci minha senha
                </button>
              </>
            )}
          </>
        )}
      </small>
    </div>
  );
}
// Sino de notificações do cabeçalho: mostra as não lidas e abre um mini painel com as mais recentes.
function NotificationBell({ items, onMarkRead }: { items: Row[]; onMarkRead: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);
  return (
    <div className="notif" ref={ref}>
      <button
        type="button"
        className="notif-button"
        aria-label={unread ? `Notificações: ${unread} não lidas` : "Notificações"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notificações">
          <div className="notif-head">
            <b>Notificações</b>
            {unread > 0 && (
              <button
                type="button"
                className="link-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onMarkRead();
                  setBusy(false);
                }}
              >
                Marcar como lidas
              </button>
            )}
          </div>
          {items.length ? (
            <ul>
              {items.slice(0, 8).map((n) => (
                <li key={n.id} className={n.read ? "" : "unread"}>
                  <span>{n.message}</span>
                  <small>{date(n.created_at)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notif-empty">Nenhuma novidade por enquanto.</p>
          )}
          {items.length > 8 && (
            <a className="notif-all" href="#/profile">
              Ver todas no perfil →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
// Participantes e equipes de todos os hackathons da organização, com filtro por evento e busca.
function PeopleOverview({ data }: { data: Row }) {
  const [tab, setTab] = useState<"participants" | "teams">("participants");
  const [eventId, setEventId] = useState("");
  const [q, setQ] = useState("");
  const events: Row[] = data.events || [];
  const term = normalize(q);
  const match = (...fields: unknown[]) =>
    !term || fields.some((f) => normalize(String(f || "")).includes(term));
  const people = (data.participants || []).filter(
    (p: Row) => (!eventId || p.event_id === eventId) && match(p.name, p.email, p.skills, p.city, p.team_name),
  );
  const teams = (data.teams || []).filter(
    (t: Row) =>
      (!eventId || t.event_id === eventId) && match(t.name, t.skills, t.member_names, t.leader_name),
  );
  const withoutTeam = people.filter((p: Row) => !p.team_id).length;
  const exportCsv = () => {
    const cell = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const rows = [
      ["Hackathon", "Nome", "E-mail", "Stack", "Cidade", "Disponibilidade", "Equipe", "LinkedIn", "GitHub"],
      ...people.map((p: Row) => [
        p.event_title,
        p.name,
        p.email,
        p.skills,
        p.city,
        p.availability,
        p.team_name || "Sem equipe",
        p.linkedin,
        p.github,
      ]),
    ];
    const blob = new Blob(["\ufeff" + rows.map((r) => r.map(cell).join(";")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "inscritos-hacko.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">SEUS HACKATHONS</span>
          <h1>Inscritos e equipes</h1>
          <p>Todas as pessoas inscritas e as equipes formadas nos hackathons que vocês criaram.</p>
        </div>
      </div>
      {!events.length ? (
        <p className="notice">
          Vocês ainda não criaram hackathons. <a href="#/org">Criar o primeiro →</a>
        </p>
      ) : (
        <>
          <div className="metrics">
            {[
              ["Inscritos", people.length],
              ["Equipes", teams.length],
              ["Sem equipe", withoutTeam],
            ].map(([label, n]) => (
              <div className="panel" key={label}>
                <small>{label}</small>
                <h2>{n}</h2>
              </div>
            ))}
          </div>
          <div className="people-filters">
            <label>
              Hackathon
              <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">Todos os hackathons</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} {e.status !== "published" ? `(${status(e.status)})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Buscar
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome, e-mail, stack, cidade ou equipe"
              />
            </label>
          </div>
          <div className="auth-tabs people-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "participants"}
              className={tab === "participants" ? "active" : ""}
              onClick={() => setTab("participants")}
            >
              Participantes ({people.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "teams"}
              className={tab === "teams" ? "active" : ""}
              onClick={() => setTab("teams")}
            >
              Equipes ({teams.length})
            </button>
          </div>
          {tab === "participants" ? (
            <section className="panel">
              <div className="section-head">
                <small>
                  Dados compartilhados pelos participantes ao se inscreverem. Use apenas para o evento.
                </small>
                <button type="button" className="secondary" onClick={exportCsv} disabled={!people.length}>
                  Baixar planilha (CSV)
                </button>
              </div>
              {people.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {["Nome", "E-mail", "Stack", "Cidade", "Equipe", "Hackathon", "Links"].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((p: Row) => (
                        <tr key={p.event_id + p.id}>
                          <td>{p.name}</td>
                          <td>
                            <a href={"mailto:" + p.email}>{p.email}</a>
                          </td>
                          <td>{p.skills}</td>
                          <td>{p.city}</td>
                          <td>
                            {p.team_id ? (
                              <a href={href("/team/" + p.team_id)}>{p.team_name}</a>
                            ) : (
                              "Sem equipe"
                            )}
                          </td>
                          <td>{p.event_title}</td>
                          <td>
                            {p.linkedin && (
                              <a href={p.linkedin} target="_blank" rel="noreferrer">
                                LinkedIn ↗
                              </a>
                            )}{" "}
                            {p.github && (
                              <a href={p.github} target="_blank" rel="noreferrer">
                                GitHub ↗
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Nenhum inscrito encontrado.</p>
              )}
            </section>
          ) : teams.length ? (
            <div className="grid">
              {teams.map((t: Row) => (
                <article className="panel" key={t.id}>
                  <span className="pill">{status(t.status)}</span>
                  <h3>{t.name}</h3>
                  <small>{t.event_title}</small>
                  <p>
                    {t.members}/{t.team_max} integrantes
                    {t.members < t.team_min && ` · faltam ${t.team_min - t.members} para o mínimo`}
                  </p>
                  {t.leader_name && (
                    <p>
                      <b>Líder:</b> {t.leader_name}
                    </p>
                  )}
                  {t.member_names && (
                    <p>
                      <b>Integrantes:</b> {t.member_names}
                    </p>
                  )}
                  <div className="tags">{tags(t.skills)}</div>
                  <a className="button secondary" href={href("/manage/" + t.event_id)}>
                    Gerenciar evento →
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <p className="notice">Nenhuma equipe encontrada.</p>
          )}
        </>
      )}
    </>
  );
}
const DELIVERY: Record<string, [string, string]> = {
  none: ["Aguardando envio", "muted"],
  submitted: ["Enviado", "green"],
  reviewing: ["Em avaliação", "yellow"],
  evaluated: ["Avaliado", "lime"],
  pending: ["Revisar envio", "red"],
};
function DeliveryBadge({ value }: { value?: string }) {
  const [label, tone] = DELIVERY[value || "none"] || DELIVERY.none;
  return <span className={"delivery " + tone}>{label}</span>;
}
// Controle da organização para mudar o status de entrega de uma equipe.
function ReviewControl({ team, onSave, busy }: { team: Row; onSave: (body: Row) => void; busy: boolean }) {
  const [next, setNext] = useState(team.submission_status === "none" ? "pending" : "reviewing");
  const [note, setNote] = useState(team.review_note || "");
  return (
    <div className="review-control">
      <select
        value={next}
        onChange={(e) => setNext(e.target.value)}
        aria-label={"Novo status de " + team.name}
      >
        {team.submission_status !== "none" && <option value="reviewing">Em avaliação</option>}
        {team.submission_status !== "none" && <option value="evaluated">Avaliada</option>}
        <option value="pending">Pendente (pedir ajustes)</option>
      </select>
      <input
        value={note}
        maxLength={1000}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Comentário para a equipe (opcional)"
        aria-label={"Comentário para " + team.name}
      />
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={() => onSave({ op: "team.review", id: team.id, status: next, note })}
      >
        Salvar
      </button>
    </div>
  );
}
// "Hoje, 10h42" / "Ontem, 18h32" / "12 out, 09h10".
const pessoas = (n: number) => `${n} ${n === 1 ? "pessoa" : "pessoas"}`;
function relTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86400000);
  if (diff === 0) return "Hoje, " + hm;
  if (diff === 1) return "Ontem, " + hm;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") + ", " + hm;
}
// Situação da formação da equipe.
function formationOf(t: Row, e: Row): [string, string] {
  const n = Number(t.members || 0);
  if (n === 0) return ["Sem integrantes", "red"];
  if (t.status === "confirmed") return ["Confirmada", "lime"];
  if (n < e.team_min) return [`Faltando gente · ${n}/${e.team_min}`, "yellow"];
  if (n >= e.team_max) return ["Completa · lotada", "blue"];
  return ["Completa", "blue"];
}
// Situação da entrega, considerando o prazo do evento.
function deliveryOf(t: Row, e: Row): [string, string] {
  const map: Record<string, [string, string]> = {
    submitted: ["Enviado", "green"],
    reviewing: ["Em avaliação", "yellow"],
    evaluated: ["Avaliado", "lime"],
    pending: ["Revisar envio", "red"],
  };
  if (map[t.submission_status]) return map[t.submission_status];
  const deadline = e.submission_deadline || e.ends_at;
  const now = Date.now();
  if (now > Date.parse(deadline)) return ["Não entregue", "red"];
  if (Date.parse(deadline) - now < 48 * 3600000) return ["Prazo próximo", "yellow"];
  return ["Aguardando envio", "muted"];
}
function Badge({ value }: { value: [string, string] }) {
  return <span className={"delivery " + value[1]}>{value[0]}</span>;
}
function downloadCsv(name: string, rows: unknown[][]) {
  const cell = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(";")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
// Painel do evento para a organização: resumo, participantes (lista ou por equipe) e equipes/entregas.
function EventDashboard({
  data,
  busy,
  onAction,
  confirmButton,
}: {
  data: Row;
  busy: boolean;
  onAction: (body: Row) => void;
  confirmButton: (t: Row) => ReactNode;
}) {
  const e: Row = data.event;
  const regs: Row[] = (data.registrations || [])
    .filter((r: Row) => r.status === "active")
    .sort((a: Row, b: Row) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  const teams: Row[] = data.teams || [];
  const [view, setViewState] = useState<"list" | "teams">(() => {
    try {
      return sessionStorage.getItem("hacko-people-view") === "teams" ? "teams" : "list";
    } catch {
      return "list";
    }
  });
  const setView = (v: "list" | "teams") => {
    setViewState(v);
    try {
      sessionStorage.setItem("hacko-people-view", v);
    } catch {}
  };
  const [q, setQ] = useState("");
  // A equipe aberta e a visão escolhida sobrevivem ao recarregamento dos dados depois de salvar.
  const [open, setOpenState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("hacko-open-team");
    } catch {
      return null;
    }
  });
  const setOpen = (v: string | null) => {
    setOpenState(v);
    try {
      if (v) sessionStorage.setItem("hacko-open-team", v);
      else sessionStorage.removeItem("hacko-open-team");
    } catch {}
  };
  const term = normalize(q);
  const match = (r: Row) =>
    !term || [r.name, r.email, r.skills, r.bio].some((f) => normalize(String(f || "")).includes(term));
  const teamOf = (r: Row) => teams.find((t) => t.id === r.team_id);
  const membersOf = (t: Row) =>
    regs
      .filter((r) => r.team_id === t.id)
      .sort((a, b) => (b.user_id === t.leader_id ? 1 : 0) - (a.user_id === t.leader_id ? 1 : 0));
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
  const complete = teams.filter((t) => t.members >= e.team_min).length;
  const received = teams.filter((t) => t.submission_status && t.submission_status !== "none").length;
  const withoutTeam = regs.filter((r) => !r.team_id);
  const incomplete = teams.filter((t) => t.members < e.team_min).length;
  const notSent = teams.length - received;
  const deadline = e.submission_deadline || e.ends_at;
  const exportTeams = () =>
    downloadCsv("equipes-e-entregas.csv", [
      [
        "Equipe",
        "Formação",
        "Integrantes",
        "E-mails",
        "Entrega",
        "Link do projeto",
        "Enviado em",
        "Comentário",
      ],
      ...teams.map((t) => [
        t.name,
        formationOf(t, e)[0],
        membersOf(t)
          .map((m) => m.name + (m.user_id === t.leader_id ? " (líder)" : ""))
          .join(", "),
        membersOf(t)
          .map((m) => m.email)
          .join(", "),
        deliveryOf(t, e)[0],
        t.submission_url,
        t.submitted_at ? date(t.submitted_at) : "",
        t.review_note,
      ]),
    ]);
  return (
    <>
      <div className="dash-metrics">
        {[
          [
            "Participantes",
            regs.length,
            `+${regs.filter((r) => r.created_at > lastWeek).length} nesta semana`,
          ],
          ["Equipes", teams.length, `${complete} com formação completa`],
          ["Entregas recebidas", received, `${notSent} equipes ainda pendentes`],
          ["Sem equipe", withoutTeam.length, "pessoas aguardando equipe"],
        ].map(([label, n, hint]) => (
          <div className="dash-metric" key={label as string}>
            <small>{label}</small>
            <strong>{n}</strong>
            <span>{hint}</span>
          </div>
        ))}
      </div>

      <section className="panel dash-card">
        <div className="dash-head">
          <h2>Participantes</h2>
          <div className="auth-tabs dash-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              Lista (A–Z)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "teams"}
              className={view === "teams" ? "active" : ""}
              onClick={() => setView("teams")}
            >
              Por equipe
            </button>
          </div>
        </div>
        <input
          className="dash-search"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder="Buscar por nome, e-mail, stack ou descrição"
          aria-label="Buscar participantes"
        />
        {view === "list" ? (
          <div className="table-scroll">
            <table className="dash-table">
              <thead>
                <tr>
                  {["Nome", "E-mail", "Stack", "Disponibilidade", "Descrição", "Equipe"].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regs.filter(match).map((r) => (
                  <tr key={r.user_id}>
                    <td>
                      <b>{r.name}</b>
                    </td>
                    <td>
                      <a href={"mailto:" + r.email}>{r.email}</a>
                    </td>
                    <td>{r.skills}</td>
                    <td>{r.availability || "Não informada"}</td>
                    <td>
                      <div className="dash-bio">{r.bio}</div>
                    </td>
                    <td>
                      {teamOf(r) ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            setOpen(r.team_id);
                            setTimeout(
                              () =>
                                document
                                  .getElementById("team-" + r.team_id)
                                  ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                              50,
                            );
                          }}
                        >
                          {teamOf(r)!.name}
                        </button>
                      ) : (
                        <span className="delivery muted">Sem equipe</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!regs.filter(match).length && (
                  <tr>
                    <td colSpan={6}>Nenhum participante encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dash-groups">
            {[...teams, { id: "", name: "Sem equipe", members: withoutTeam.length }].map((t) => {
              const people = t.id ? membersOf(t).filter(match) : withoutTeam.filter(match);
              if (term && !people.length) return null;
              return (
                <div className="dash-group" key={t.id || "none"}>
                  <div className="dash-group-head">
                    <b>{t.name}</b>
                    <span className="muted">{pessoas(t.id ? membersOf(t).length : withoutTeam.length)}</span>
                    {t.id ? (
                      <Badge value={formationOf(t, e)} />
                    ) : (
                      <span className="delivery muted">Aguardando</span>
                    )}
                  </div>
                  {people.length ? (
                    <ul>
                      {people.map((r) => (
                        <li key={r.user_id}>
                          <span>
                            {r.name}
                            {r.user_id === t.leader_id && <span className="pill">Líder</span>}
                          </span>
                          <a href={"mailto:" + r.email}>{r.email}</a>
                          <small>{r.skills}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Ninguém por aqui ainda.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel dash-card">
        <div className="dash-head">
          <h2>Equipes e entregas</h2>
          <button type="button" className="secondary" onClick={exportTeams} disabled={!teams.length}>
            Exportar lista
          </button>
        </div>
        <p className="muted">
          Prazo de entrega: <b>{date(deadline)}</b> · Clique numa equipe para ver integrantes, entrega e
          avaliar.
        </p>
        <div className="table-scroll">
          <table className="dash-table dash-teams">
            <thead>
              <tr>
                {["Equipe", "Integrantes", "Formação", "Entrega", "Atualização", ""].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const isOpen = open === t.id;
                return (
                  <Fragment key={t.id}>
                    <tr
                      id={"team-" + t.id}
                      className={"dash-row" + (isOpen ? " open" : "")}
                      onClick={() => setOpen(isOpen ? null : t.id)}
                    >
                      <td>
                        <b>{t.name}</b>
                      </td>
                      <td>{pessoas(t.members)}</td>
                      <td>
                        <Badge value={formationOf(t, e)} />
                      </td>
                      <td>
                        <Badge value={deliveryOf(t, e)} />
                      </td>
                      <td>{relTime(t.reviewed_at || t.submitted_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          aria-expanded={isOpen}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setOpen(isOpen ? null : t.id);
                          }}
                        >
                          {isOpen ? "Fechar" : "Ver detalhes"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="dash-detail">
                        <td colSpan={6}>
                          <div className="dash-detail-grid">
                            <div>
                              <h3>Integrantes</h3>
                              <ul className="team-members">
                                {membersOf(t).map((r) => (
                                  <li key={r.user_id}>
                                    <b>
                                      {r.name}
                                      {r.user_id === t.leader_id && <span className="pill">Líder</span>}
                                    </b>
                                    <a href={"mailto:" + r.email}>{r.email}</a>
                                    <small>
                                      {[r.skills, r.city, r.availability].filter(Boolean).join(" · ")}
                                    </small>
                                  </li>
                                ))}
                                {!membersOf(t).length && <li>Nenhum integrante.</li>}
                              </ul>
                              {t.status === "forming" && t.members > 0 && confirmButton(t)}
                            </div>
                            <div>
                              <h3>Entrega</h3>
                              {t.submission_url ? (
                                <p>
                                  <a href={t.submission_url} target="_blank" rel="noreferrer">
                                    Abrir projeto ↗
                                  </a>
                                  <br />
                                  <small>Enviado {relTime(t.submitted_at).toLowerCase()}</small>
                                  {t.submission_note && (
                                    <span className="sheet-note">{t.submission_note}</span>
                                  )}
                                </p>
                              ) : (
                                <p className="muted">A equipe ainda não enviou o projeto.</p>
                              )}
                              {t.review_note && (
                                <p className="sheet-note">Último comentário: {t.review_note}</p>
                              )}
                              <ReviewControl
                                key={t.submission_status}
                                team={t}
                                onSave={onAction}
                                busy={busy}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!teams.length && (
                <tr>
                  <td colSpan={6}>Nenhuma equipe formada ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(incomplete > 0 || notSent > 0 || withoutTeam.length > 0) && (
        <section className="dash-callout">
          <h3>Acompanhe antes do prazo</h3>
          <p>
            {[
              incomplete &&
                `${incomplete} ${incomplete === 1 ? "equipe precisa" : "equipes precisam"} completar a formação.`,
              notSent && `${notSent} ainda não ${notSent === 1 ? "enviou" : "enviaram"} o projeto.`,
              withoutTeam.length &&
                `${withoutTeam.length} ${withoutTeam.length === 1 ? "pessoa está" : "pessoas estão"} sem equipe.`,
            ]
              .filter(Boolean)
              .join(" ")}{" "}
            Use os status para orientar o acompanhamento.
          </p>
        </section>
      )}
    </>
  );
}
// Entrega do projeto na página da equipe: o líder envia o link; todos veem o status e o comentário.
function TeamDelivery({
  team,
  event,
  leader,
  busy,
  onSubmit,
}: {
  team: Row;
  event: Row;
  leader: boolean;
  busy: boolean;
  onSubmit: (body: Row) => void;
}) {
  const nowIso = new Date().toISOString();
  const deadline = event.submission_deadline || event.ends_at;
  const open = nowIso >= event.starts_at && nowIso <= deadline && team.submission_status !== "evaluated";
  return (
    <section className="panel section">
      <div className="section-head">
        <h2>Entrega do projeto</h2>
        <DeliveryBadge value={team.submission_status} />
      </div>
      <p>
        Prazo: <b>{date(deadline)}</b>
        {team.submitted_at && <> · Enviado em {date(team.submitted_at)}</>}
      </p>
      {team.submission_url && (
        <p>
          <a href={team.submission_url} target="_blank" rel="noreferrer">
            {team.submission_url} ↗
          </a>
          {team.submission_note && (
            <>
              <br />
              <small>{team.submission_note}</small>
            </>
          )}
        </p>
      )}
      {team.review_note && <p className="notice">Comentário da organização: {team.review_note}</p>}
      {leader && open ? (
        <form
          className="form wide"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Row;
            onSubmit({ op: "team.submit", id: team.id, url: f.url, note: f.note });
          }}
        >
          <label>
            Link do projeto (GitHub, vídeo, Figma, site…)
            <input name="url" type="url" required pattern="https://.*" defaultValue={team.submission_url} />
          </label>
          <label>
            Descrição curta (opcional)
            <textarea name="note" maxLength={1000} defaultValue={team.submission_note} />
          </label>
          <button type="submit" disabled={busy}>
            {team.submission_url ? "Atualizar entrega" : "Enviar entrega"}
          </button>
        </form>
      ) : (
        <small>
          {nowIso < event.starts_at
            ? "As entregas abrem no início do evento."
            : nowIso > deadline
              ? "O prazo de entrega terminou."
              : team.submission_status === "evaluated"
                ? "A entrega já foi avaliada."
                : "Apenas o líder da equipe envia a entrega."}
        </small>
      )}
    </section>
  );
}
function Card({ e }: any) {
  const closed = e.closes_at <= new Date().toISOString();
  return (
    <article className="card">
      <a href={href("/event/" + e.id)}>
        <img src={coverOf(e)} alt={"Capa de " + e.title} loading="lazy" />
        <div className="card-body">
          <div className="eyebrow">
            {e.organization} · {e.format}
          </div>
          <h3>{e.title}</h3>
          <p className="meta">
            {date(e.starts_at)}
            <br />
            {e.city} · {e.venue}
          </p>
          <div className="tags">
            <span className="tag">{e.theme}</span>
            <span className={"tag " + (!closed ? "lime" : "")}>
              {closed
                ? "Inscrições encerradas"
                : e.opens_at > new Date().toISOString()
                  ? "Em breve"
                  : "Inscrições abertas"}
            </span>
          </div>
          <p className="meta">
            {e.participants || 0} participantes · {e.capacity} vagas
          </p>
        </div>
      </a>
    </article>
  );
}
function Teams({ items = [] }: any) {
  return items.length ? (
    <div className="grid">
      {items.map((t: Row) => (
        <article className="panel" key={t.id}>
          <span className="eyebrow">{t.event_title}</span>
          <h3>{t.name}</h3>
          <p>{t.description}</p>
          <p className="meta">
            {status(t.status)} {t.members !== undefined && `· ${t.members}/${t.team_max} integrantes`}
          </p>
          <div className="tags">{tags(t.skills)}</div>
          <a className="button secondary" href={href("/team/" + t.id)}>
            Ver equipe →
          </a>
        </article>
      ))}
    </div>
  ) : (
    <div className="empty">Nenhuma equipe encontrada.</div>
  );
}
const blankProfile = {
  name: "",
  bio: "",
  skills: "",
  interests: "",
  city: "",
  availability: "",
  linkedin: "",
  github: "",
  visible: 0,
};
export default function Hacko() {
  const [route, setRoute] = useState("/"),
    [boot, setBoot] = useState<Row | null>(null),
    [data, setData] = useState<Row>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errorFromLoad, setErrorFromLoad] = useState(false),
    [message, setMessage] = useState(""),
    [filters, setFilters] = useState<Row>({}),
    [query, setQuery] = useState(""),
    [radar, setRadar] = useState<Row | null>(null);
  const generation = useRef(0);
  const parts = route.split("/"),
    page = parts[1] || "home",
    id = parts[2] || "";
  const load = useCallback(async () => {
    const g = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const b = await api("bootstrap");
      if (g !== generation.current) return;
      setBoot(b);
      let d: Row = {};
      const p = route.split("/");
      const a: Row = {
        event: "event",
        team: "team",
        teams: "teams",
        community: "participants",
        mine: "mine",
        org: "org",
        manage: "manage",
        edit: "manage",
        inscritos: "people",
      };
      if (a[p[1]]) {
        const item = p[2] || (p[1] === "org" ? b.organizations[0]?.id : "");
        if (p[1] !== "org" || item) d = await api(a[p[1]], item);
      }
      if (g === generation.current) setData(d);
    } catch (e: any) {
      if (g === generation.current) {
        setError(e.message);
        setErrorFromLoad(true);
      }
    } finally {
      if (g === generation.current) setLoading(false);
    }
  }, [route]);
  useEffect(() => {
    const onHash = () => {
      setRoute(location.hash.slice(1).split("?")[0] || "/");
      setData({});
      setQuery("");
      setMessage("");
      window.scrollTo(0, 0);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function mutate(body: Row, next?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/hacko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d: Row = await r.json();
      if (!r.ok) throw Error(d.error || "Não foi possível salvar.");
      if (body.op === "radar") {
        setRadar(d);
      } else {
        setMessage("Alteração salva.");
        if (next) nav(next.replace(":id", d.id || ""));
        else await load();
      }
      return d;
    } catch (e: any) {
      setError(e.message);
      setErrorFromLoad(false);
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, body: Row, confirmation?: string, next?: string) => (
    <button
      disabled={busy}
      className="secondary"
      onClick={() => {
        if (!confirmation || confirm(confirmation))
          mutate({ ...body, ...(confirmation ? { confirm: true } : {}) }, next);
      }}
    >
      {label}
    </button>
  );
  const account = () =>
    !boot?.user ? (
      <div className="notice">
        Entre para continuar. <a href="#/login">Acessar conta →</a>
      </div>
    ) : !boot.profile ? (
      <div className="notice">
        Complete seu perfil para continuar. <a href="#/profile">Criar perfil →</a>
      </div>
    ) : null;
  const isCompany = boot?.user?.accountType === "company";
  const companyOrg = isCompany ? boot?.organizations?.[0] : null;
  const links = isCompany
    ? [
        ["/", "Explorar"],
        ["/org", "Meus eventos"],
        ["/inscritos", "Inscritos e equipes"],
        ["/company", "Perfil da empresa"],
      ]
    : [
        ["/", "Explorar"],
        ["/mine", "Meus hackathons"],
        ["/community", "Comunidade"],
        ["/radar", "Oportunidades"],
      ];
  function content() {
    if (!boot) return null;
    const p = boot.profile || { ...blankProfile, name: boot.user?.name || "" };
    if (page === "redefinir")
      return (
        <section className="panel small-width">
          <span className="eyebrow">NOVA SENHA</span>
          <h1>Crie uma nova senha.</h1>
          <ResetPassword />
        </section>
      );
    if (page === "login")
      return (
        <div className="auth">
          <section className="auth-art">
            <span className="pill">BORA CONSTRUIR O PRÓXIMO?</span>
            <h1>
              Ideias grandes.
              <br />
              Conexões reais.
            </h1>
            <p>Seu próximo desafio começa com as pessoas certas.</p>
            <img src={photo(1)} alt="Comunidade reunida em evento" />
          </section>
          <section className="auth-form">
            <h1>Seu lugar na Hacko.</h1>
            <p>Uma conta para participar e organizar.</p>
            {boot.user ? (
              <>
                <p>
                  Você entrou como <b>{boot.user.email}</b>.
                </p>
                <div className="actions">
                  <a className="button" href="#/profile">
                    Meu perfil
                  </a>
                  <a className="button secondary" href="#/org">
                    Sou organização
                  </a>
                </div>
                <button
                  className="ghost"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    location.href = "/";
                  }}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <LoginOptions
                  providers={boot.authProviders || []}
                  passwordReset={!!boot.passwordReset || location.hostname === "localhost"}
                />
              </>
            )}
          </section>
        </div>
      );
    if (page === "home")
      return (
        <>
          <section className="hero">
            <div>
              <span className="pill">MENOS IDEIAS NO PAPEL. MAIS NO MUNDO.</span>
              <h1>
                Seu próximo
                <br />
                grande desafio
                <br />
                começa aqui.
              </h1>
              <p>Explore hackathons, encontre sua equipe e transforme o que você sabe em algo que importa.</p>
              <a className="button" href="#/teams">
                Encontrar minha equipe ↗
              </a>
            </div>
            <img src={photo(0)} alt="Pessoas colaborando em um evento de tecnologia" />
          </section>
          <div className="section-head">
            <div>
              <span className="eyebrow">DESCUBRA. CONECTE. CONSTRUA.</span>
              <h2>Hackathons para você</h2>
            </div>
            <a href="#/org" className="button secondary">
              Organizar hackathon +
            </a>
          </div>
          <div className="search catalog-filters">
            <label>
              O que você quer construir?
              <input
                placeholder="Nome ou tema"
                value={filters.q || ""}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            </label>
            <label>
              Cidade
              <input
                placeholder="Qualquer cidade"
                value={filters.city || ""}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              />
            </label>
            <label>
              Formato
              <select
                value={filters.format || ""}
                onChange={(e) => setFilters({ ...filters, format: e.target.value })}
              >
                {["", "Presencial", "Online", "Híbrido"].map((x) => (
                  <option key={x} value={x}>
                    {x || "Todos"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              De
              <input
                type="date"
                value={filters.from || ""}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={filters.to || ""}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </label>
          </div>
          <div className="grid">
            {searchCatalog(boot.events, filters).map((e: Row) => (
              <Card key={e.id} e={e} />
            ))}
            {!searchCatalog(boot.events, filters).length && (
              <div className="empty">
                <h3>A próxima oportunidade começa aqui.</h3>
                <p>Nenhum hackathon publicado corresponde aos filtros.</p>
                <a href="#/radar">Buscar oportunidades na web →</a>
              </div>
            )}
          </div>
          <div className="promos">
            <section className="panel dark">
              <span className="eyebrow">RADAR HACKO</span>
              <h2>O próximo desafio pode estar perto.</h2>
              <p>Descreva seus interesses e encontre oportunidades com fontes para conferir.</p>
              <a className="button" href="#/radar">
                Explorar com IA ↗
              </a>
            </section>
            <section className="panel lime-panel">
              <h2>Talento encontra talento.</h2>
              <p>Complete seu perfil e mostre o que você quer construir.</p>
              <a className="button" href="#/community">
                Conhecer a comunidade
              </a>
            </section>
          </div>
        </>
      );
    if (page === "inscritos") {
      if (account()) return account();
      return <PeopleOverview data={data} />;
    }
    if (page === "company" || (page === "profile" && isCompany)) {
      if (!boot.user) return account();
      if (!isCompany)
        return (
          <section className="panel small-width">
            <h1>Esta é uma conta de participante.</h1>
            <p>
              Para organizar hackathons, saia e crie uma conta escolhendo <b>“Sou uma empresa”</b>.
            </p>
            <a className="button" href="#/profile">
              Ir para meu perfil
            </a>
          </section>
        );
      const o = companyOrg || {};
      return (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">PERFIL DA EMPRESA</span>
              <h1>{o.name || "Sua empresa"}</h1>
              <p>Estas informações aparecem nos hackathons que vocês publicarem.</p>
            </div>
            <a className="button" href={href("/new/" + (o.id || ""))}>
              Criar hackathon +
            </a>
          </div>
          <div className="two-col">
            <section className="panel">
              <h2>Dados da empresa</h2>
              {o.id && (
                <ImageInput
                  key={o.logo_v || "none"}
                  label="Logo da empresa"
                  help="Quadrada, 400×400. Aparece nos seus hackathons."
                  current={o.logo_v ? imageUrl("logo:" + o.id, o.logo_v) : ""}
                  aspect="square"
                  onChange={(d: string | null) =>
                    mutate({ op: "image.upload", kind: "logo", id: o.id, data: d })
                  }
                />
              )}
              <Form
                busy={busy}
                label="Salvar perfil da empresa"
                onSubmit={(v: Row) => mutate({ op: "organization.update", id: o.id, data: v })}
              >
                <Field name="name" label="Nome da empresa" value={o.name} required />
                <Field name="description" label="Sobre a empresa" type="textarea" value={o.description} />
                <div className="form-grid">
                  <Field
                    name="website"
                    label="Site da empresa"
                    type="url"
                    value={o.website}
                    help="https://…"
                  />
                  <Field name="cnpj" label="CNPJ (opcional)" value={o.cnpj} help="Somente informativo." />
                  <Field name="city" label="Cidade / UF" value={o.city} />
                  <Field name="linkedin" label="LinkedIn da empresa" type="url" value={o.linkedin} />
                  <Field name="instagram" label="Instagram da empresa" type="url" value={o.instagram} />
                </div>
                <h3>Pessoa responsável</h3>
                <small>Visível apenas para você e para a equipe da Hacko.</small>
                <div className="form-grid">
                  <Field name="contact_name" label="Nome" value={o.contact_name} />
                  <Field name="contact_role" label="Cargo" value={o.contact_role} />
                </div>
              </Form>
            </section>
            <aside className="stack">
              <section className="panel company-card">
                <div className="person">
                  <div className="avatar">
                    {o.logo_v ? (
                      <img src={imageUrl("logo:" + o.id, o.logo_v)} alt="" />
                    ) : (
                      (o.name || "?").slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3>{o.name}</h3>
                    <small>{[o.city, boot.user.email].filter(Boolean).join(" · ")}</small>
                  </div>
                </div>
                <p>{o.description}</p>
                <div className="actions">
                  {o.website && (
                    <a href={o.website} target="_blank" rel="noreferrer">
                      Site ↗
                    </a>
                  )}
                  {o.linkedin && (
                    <a href={o.linkedin} target="_blank" rel="noreferrer">
                      LinkedIn ↗
                    </a>
                  )}
                  {o.instagram && (
                    <a href={o.instagram} target="_blank" rel="noreferrer">
                      Instagram ↗
                    </a>
                  )}
                </div>
              </section>
              <section className="panel dark">
                <h3>Seus hackathons.</h3>
                <p>Crie, publique e acompanhe inscrições e equipes.</p>
                <div className="actions">
                  <a className="button" href="#/org">
                    Painel de eventos
                  </a>
                  <a className="button secondary" href="#/inscritos">
                    Inscritos e equipes
                  </a>
                </div>
              </section>
              <section className="panel">
                <h3>Sair da conta</h3>
                <p>
                  Conectado como <b style={{ overflowWrap: "anywhere" }}>{boot.user.email}</b>.
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    location.href = "/";
                  }}
                >
                  Sair da conta
                </button>
              </section>
              <DeleteAccount />
            </aside>
          </div>
        </>
      );
    }
    if (page === "profile")
      return (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">SEU ESPAÇO</span>
              <h1>Seu próximo capítulo.</h1>
              <p>Mostre suas habilidades. Encontre as conexões certas.</p>
            </div>
          </div>
          {!boot.user ? (
            account()
          ) : (
            <div className="two-col">
              <section className="panel">
                <h2>{boot.profile ? "Editar perfil" : "Bem-vindo à Hacko"}</h2>
                {boot.profile ? (
                  <ImageInput
                    key={p.avatar_v || "none"}
                    label="Foto de perfil"
                    help="Quadrada, 400×400. Visível apenas se o seu perfil estiver público."
                    current={p.avatar_v ? imageUrl("avatar:" + p.id, p.avatar_v) : ""}
                    aspect="square"
                    onChange={(d: string | null) => mutate({ op: "image.upload", kind: "avatar", data: d })}
                  />
                ) : (
                  <small>Salve seu perfil para poder adicionar uma foto.</small>
                )}
                <Form
                  busy={busy}
                  onSubmit={(v: Row) =>
                    mutate({ op: "profile", data: { ...v, visible: v.visible === "on" } })
                  }
                >
                  <Field name="name" label="Nome" value={p.name} required />
                  <label>
                    E-mail da conta
                    <input value={boot.user.email} readOnly />
                  </label>
                  <Field name="bio" label="Sobre você" type="textarea" value={p.bio} />
                  <Field name="city" label="Cidade / UF" value={p.city} />
                  <Field
                    name="skills"
                    label="Sua stack e competências"
                    value={p.skills}
                    help="Separe por vírgulas: Java, React, UX, Produto"
                  />
                  <Field name="interests" label="Interesses" value={p.interests} />
                  <Field
                    name="availability"
                    label="Disponibilidade"
                    value={p.availability}
                    options={["", "Integral", "Noites", "Finais de semana"]}
                  />
                  <Field name="linkedin" label="LinkedIn (opcional)" type="url" value={p.linkedin} />
                  <Field name="github" label="GitHub ou portfólio (opcional)" type="url" value={p.github} />
                  <label className="check">
                    <input type="checkbox" name="visible" defaultChecked={!!p.visible} />
                    Exibir meu nome, bio, stack e links na comunidade e nos eventos em que me inscrevi.
                  </label>
                  <small>
                    Seu e-mail é mostrado apenas a você e à organização dos eventos em que se inscrever.
                    Perfil privado é o padrão.
                  </small>
                </Form>
              </section>
              <aside className="stack">
                <Person p={p} />
                <section className="panel dark">
                  <h3>Participante e organização.</h3>
                  <p>
                    Você pode participar de desafios e administrar sua própria organização com esta conta.
                  </p>
                  <a className="button" href="#/org">
                    Abrir organização
                  </a>
                </section>
                <section className="panel">
                  <h3>Sair da conta</h3>
                  <p>
                    Conectado como <b style={{ overflowWrap: "anywhere" }}>{boot.user.email}</b>.
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST" });
                      location.href = "/";
                    }}
                  >
                    Sair da conta
                  </button>
                </section>
                <DeleteAccount />
                <section className="panel">
                  <h3>Notificações</h3>
                  {boot.notifications.map((n: Row) => (
                    <p key={n.id}>
                      {!n.read && "● "}
                      {n.message}
                      <br />
                      <small>{date(n.created_at)}</small>
                    </p>
                  ))}
                  {!boot.notifications.length && <p>Nenhuma novidade por enquanto.</p>}
                  {button("Marcar como lidas", { op: "notifications.read" })}
                </section>
              </aside>
            </div>
          )}
        </>
      );
    if (page === "event" && data.event) {
      const e = data.event;
      const registered = boot.registrations.some((r: Row) => r.event_id === id && r.status === "active");
      const saved = boot.favorites.some((f: Row) => f.event_id === id);
      return (
        <>
          <a className="breadcrumb" href="#/">
            ← Todos os hackathons
          </a>
          <img className="cover" src={coverOf(e)} alt={"Capa de " + e.title} />
          <div className="two-col">
            <section>
              <span className="eyebrow">
                {e.logo_v && <img className="org-logo" src={imageUrl("logo:" + e.org_id, e.logo_v)} alt="" />}
                {e.organization} · {e.theme}
              </span>
              <h1>{e.title}</h1>
              <p className="prewrap">{e.summary}</p>
              <div className="facts">
                <div className="fact">
                  <b>Quando</b>
                  {date(e.starts_at)} até {date(e.ends_at)}
                </div>
                <div className="fact">
                  <b>Onde</b>
                  {e.format} · {e.city}
                  <br />
                  {e.venue}
                </div>
                <div className="fact">
                  <b>Inscrições</b>
                  {date(e.opens_at)} até {date(e.closes_at)}
                </div>
                <div className="fact">
                  <b>Equipes</b>
                  {e.team_min} a {e.team_max} integrantes
                </div>
              </div>
              {e.format !== "Online" && (
                <a
                  className="button secondary"
                  href={
                    "https://www.google.com/maps/search/?api=1&query=" +
                    encodeURIComponent(e.venue + " " + e.city)
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver local no mapa ↗
                </a>
              )}
              {e.source && (
                <a className="button ghost" href={e.source} target="_blank" rel="noreferrer">
                  Site oficial ↗
                </a>
              )}
              <section className="panel section">
                <h2>Quem pode participar</h2>
                <p className="prewrap">{e.eligibility}</p>
                <h2>Regulamento</h2>
                <p className="prewrap">{e.rules}</p>
              </section>
            </section>
            <aside className="stack">
              <section className="panel">
                <span className="pill">{status(e.status)}</span>
                <h2>Seu desafio começa aqui</h2>
                {account() || (
                  <>
                    {isCompany ? (
                      <p className="notice">
                        Contas de empresa organizam hackathons e não se inscrevem. Para participar, use uma
                        conta de participante.
                      </p>
                    ) : registered ? (
                      <>
                        <p className="notice">Sua inscrição está confirmada.</p>
                        <div className="actions">
                          <a className="button" href={href("/create/" + id)}>
                            Criar equipe
                          </a>
                          <a className="button secondary" href={href("/teams/" + id)}>
                            Já tenho equipe / Buscar
                          </a>
                        </div>
                        {button(
                          "Cancelar inscrição",
                          { op: "cancel", id },
                          "Cancelar sua inscrição neste evento?",
                        )}
                      </>
                    ) : windowState(e) !== "open" ? (
                      <p className="notice">
                        {windowState(e) === "draft"
                          ? "Evento em rascunho: publique-o no painel da organização para abrir as inscrições."
                          : windowState(e) === "soon"
                            ? "As inscrições abrem em " + date(e.opens_at) + "."
                            : windowState(e) === "full"
                              ? "Todas as vagas foram preenchidas."
                              : "As inscrições foram encerradas em " + date(e.closes_at) + "."}
                      </p>
                    ) : (
                      <Form
                        busy={busy}
                        label="Confirmar inscrição"
                        onSubmit={(v: Row) => mutate({ op: "register", id, accept: v.accept === "on" })}
                      >
                        <label className="check">
                          <input type="checkbox" name="accept" required />
                          Li e aceito o regulamento e declaro atender aos critérios de elegibilidade.
                        </label>
                        <small>
                          Seu perfil e e-mail serão compartilhados com a organização para administrar a
                          inscrição.
                        </small>
                      </Form>
                    )}
                    {button(saved ? "♥ Remover dos favoritos" : "♡ Salvar evento", {
                      op: "favorite",
                      id,
                      saved: !saved,
                    })}
                  </>
                )}
              </section>
              <section className="panel dark">
                <h3>Melhor, em equipe.</h3>
                <p>Encontre pessoas com competências que complementam as suas.</p>
                <a href={href("/teams/" + id)} className="button">
                  Explorar equipes
                </a>
              </section>
            </aside>
          </div>
          <div className="section-head">
            <h2>Equipes do evento</h2>
          </div>
          <Teams items={data.teams} />
          <div className="section-head">
            <h2>Conheça participantes</h2>
            <small>Perfis com visibilidade ativada</small>
          </div>
          <div className="grid">{data.participants?.map((p: Row) => <Person key={p.id} p={p} />)}</div>
        </>
      );
    }
    if (page === "teams")
      return (
        <>
          <span className="eyebrow">ENCONTRE SEU TIME</span>
          <h1>
            Ideias diferentes.
            <br />
            Uma equipe incrível.
          </h1>
          <label className="search-label">
            Buscar equipe ou competência
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Java, design, produto…"
            />
          </label>
          <Teams
            items={(data.teams || []).filter(
              (t: Row) =>
                (!id || t.event_id === id) && normalize(t.name + " " + t.skills).includes(normalize(query)),
            )}
          />
        </>
      );
    if (page === "community")
      return (
        <>
          <span className="eyebrow">GENTE QUE CONSTRÓI JUNTO</span>
          <h1>Sua próxima conexão.</h1>
          <p>Descubra participantes que escolheram compartilhar seus perfis.</p>
          <div className="actions">
            <a className="button" href="#/teams">
              Buscar grupos e equipes
            </a>
            <a className="button secondary" href="#/profile">
              Meu perfil
            </a>
          </div>
          <label className="search-label">
            Nome, cidade ou stack
            <input
              placeholder="O que você procura?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="grid">
            {(data.participants || [])
              .filter((p: Row) =>
                normalize(p.name + " " + p.skills + " " + p.city).includes(normalize(query)),
              )
              .map((p: Row) => (
                <Person key={p.id} p={p} />
              ))}
            {!data.participants?.length && (
              <div className="empty">
                A comunidade está começando. Ative a visibilidade do seu perfil para aparecer aqui.
              </div>
            )}
          </div>
        </>
      );
    if (page === "mine")
      return (
        <>
          <span className="eyebrow">SUA JORNADA</span>
          <h1>Meus hackathons</h1>
          {account()}
          <div className="grid">
            {boot.registrations.map((r: Row) => (
              <article className="panel" key={r.event_id}>
                <span className="pill">{status(r.status)}</span>
                <h3>{r.title}</h3>
                <a href={href("/event/" + r.event_id)}>Abrir evento →</a>
              </article>
            ))}
          </div>
          {!boot.registrations.length && (
            <div className="empty">
              Suas inscrições aparecerão aqui. <a href="#/">Explorar eventos →</a>
            </div>
          )}
          <div className="section-head">
            <h2>Minhas equipes</h2>
          </div>
          <Teams items={data.teams} />
          <div className="section-head">
            <h2>Convites recebidos</h2>
          </div>
          {data.invites?.map((r: Row) => (
            <section className="panel" key={r.id}>
              <h3>{r.name}</h3>
              <div className="actions">
                {button("Aceitar", { op: "team.respond", id: r.team_id, requestId: r.id, accept: true })}
                {button("Recusar", { op: "team.respond", id: r.team_id, requestId: r.id, accept: false })}
              </div>
            </section>
          ))}
          <div className="section-head">
            <h2>Salvos</h2>
          </div>
          <div className="grid">
            {boot.events
              .filter((e: Row) => boot.favorites.some((f: Row) => f.event_id === e.id))
              .map((e: Row) => (
                <Card key={e.id} e={e} />
              ))}
          </div>
        </>
      );
    if (page === "create")
      return (
        <section className="panel small-width">
          <span className="eyebrow">MONTE SUA EQUIPE</span>
          <h1>Uma boa ideia precisa de gente.</h1>
          {account() ||
            (!boot.registrations.some((r: Row) => r.event_id === id && r.status === "active") ? (
              <p className="notice">
                Inscreva-se no evento antes de criar uma equipe.{" "}
                <a href={href("/event/" + id)}>Ir para a inscrição →</a>
              </p>
            ) : (
              <Form
                busy={busy}
                label="Criar equipe"
                onSubmit={(v: Row) =>
                  mutate({ op: "team.create", data: { ...v, event_id: id } }, "/team/:id")
                }
              >
                <Field name="name" label="Nome da equipe" required />
                <Field name="description" label="O que vocês querem construir?" type="textarea" />
                <Field name="skills" label="Competências que procuram" />
                <small>Apenas uma equipe por participante em cada evento.</small>
              </Form>
            ))}
        </section>
      );
    if (page === "team" && data.team) {
      const t = data.team;
      const leader = t.leader_id === boot.user?.id,
        member = data.members.some((m: Row) => m.id === boot.user?.id);
      return (
        <>
          <a href={href("/event/" + t.event_id)}>← Ver hackathon</a>
          <div className="section-head">
            <div>
              <span className="pill">{status(t.status)}</span>
              <h1>{t.name}</h1>
              <p>{t.description}</p>
              <div className="tags">{tags(t.skills)}</div>
            </div>
          </div>
          {member && data.event && (
            <TeamDelivery
              team={t}
              event={data.event}
              leader={leader}
              busy={busy}
              onSubmit={(b: Row) => mutate(b)}
            />
          )}
          <div className="two-col">
            <section className="panel">
              <h2>Integrantes</h2>
              {data.members.map((m: Row) => (
                <div className="member" key={m.id}>
                  <Avatar p={m} />
                  <div>
                    <b>{m.name}</b>
                    {m.id === t.leader_id && " · Líder"}
                    <div className="tags">{tags(m.skills)}</div>
                  </div>
                </div>
              ))}
              <div className="actions">
                {member ? (
                  button(
                    leader ? "Dissolver equipe" : "Sair da equipe",
                    { op: leader ? "team.dissolve" : "team.leave", id },
                    leader ? "Dissolver a equipe de todos os integrantes?" : "Sair desta equipe?",
                    "/mine",
                  )
                ) : data.myRequest ? (
                  <p className="notice">
                    Solicitação pendente.{" "}
                    {data.myRequest.kind === "invite" && (
                      <>
                        {button("Aceitar convite", {
                          op: "team.respond",
                          id,
                          requestId: data.myRequest.id,
                          accept: true,
                        })}
                        {button("Recusar", {
                          op: "team.respond",
                          id,
                          requestId: data.myRequest.id,
                          accept: false,
                        })}
                      </>
                    )}
                  </p>
                ) : (
                  account() || button("Solicitar entrada", { op: "team.request", id })
                )}
              </div>
            </section>
            {leader && (
              <aside className="stack">
                <section className="panel">
                  <h2>Solicitações</h2>
                  {data.requests
                    .filter((r: Row) => r.status === "pending" && r.kind === "request")
                    .map((r: Row) => (
                      <div className="member" key={r.id}>
                        <div>
                          <b>{r.name}</b>
                          <p>{r.skills}</p>
                          <div className="actions">
                            {button("Aceitar", { op: "team.respond", id, requestId: r.id, accept: true })}
                            {button("Recusar", { op: "team.respond", id, requestId: r.id, accept: false })}
                          </div>
                        </div>
                      </div>
                    ))}
                  {!data.requests.length && <p>Nenhuma solicitação por enquanto.</p>}
                </section>
                <Invite
                  eventId={t.event_id}
                  busy={busy}
                  invite={(userId: string) => mutate({ op: "team.invite", id, userId })}
                />
              </aside>
            )}
          </div>
        </>
      );
    }
    if (page === "org") {
      const org = boot.organizations.find((o: Row) => o.id === (id || boot.organizations[0]?.id));
      return (
        <>
          <span className="eyebrow">HACKO PARA ORGANIZAÇÕES</span>
          <h1>
            Grandes desafios.
            <br />
            Gestão simples.
          </h1>
          {account() || (
            <>
              {org ? (
                <>
                  <div className="section-head">
                    <h2>{org.name}</h2>
                    <a className="button" href={href("/new/" + org.id)}>
                      Criar hackathon +
                    </a>
                  </div>
                  <div className="actions">
                    {boot.organizations.map((o: Row) => (
                      <a className="button secondary" href={href("/org/" + o.id)} key={o.id}>
                        {o.name}
                      </a>
                    ))}
                  </div>
                  <div className="metrics">
                    {[
                      ["Inscrições", data.events?.reduce((n: number, e: Row) => n + e.participants, 0) || 0],
                      ["Equipes", data.events?.reduce((n: number, e: Row) => n + e.teams, 0) || 0],
                      ["Sem equipe", data.events?.reduce((n: number, e: Row) => n + e.without_team, 0) || 0],
                    ].map(([label, n]) => (
                      <div className="panel" key={label}>
                        <small>{label}</small>
                        <h2>{n}</h2>
                      </div>
                    ))}
                  </div>
                  <div className="grid">
                    {data.events?.map((e: Row) => (
                      <article className="panel" key={e.id}>
                        <span className="pill">{status(e.status)}</span>
                        <h3>{e.title}</h3>
                        <p>
                          {e.participants}/{e.capacity} inscrições · {e.teams} equipes
                        </p>
                        <a className="button" href={href("/manage/" + e.id)}>
                          Gerenciar →
                        </a>
                      </article>
                    ))}
                  </div>
                  {!data.events?.length && (
                    <p className="notice">
                      Crie seu primeiro hackathon. Ele ficará em rascunho até você publicar.
                    </p>
                  )}
                </>
              ) : (
                <p>Cadastre sua empresa, universidade ou comunidade para começar.</p>
              )}
              {!isCompany && !org ? (
                <section className="panel">
                  <h2>Organize com uma conta de empresa</h2>
                  <p>
                    Hackathons são criados por contas de empresa, separadas do seu perfil de participante.
                    Saia e crie uma conta escolhendo <b>“Sou uma empresa”</b> na tela de login.
                  </p>
                  <a className="button" href="#/login?tipo=empresa">
                    Criar conta de empresa
                  </a>
                </section>
              ) : (
                <details className="panel section" open={!org}>
                  <summary>{org ? "Adicionar outra organização" : "Cadastrar organização"}</summary>
                  <Form
                    busy={busy}
                    label="Criar organização"
                    onSubmit={(v: Row) => mutate({ op: "organization", data: v }, "/org/:id")}
                  >
                    <Field name="name" label="Nome da organização" required />
                    <Field name="description" label="Sobre a organização" type="textarea" />
                  </Form>
                </details>
              )}
              {org && (
                <details className="panel">
                  <summary>Histórico de atividades</summary>
                  {data.audit?.map((a: Row) => (
                    <p key={a.id}>
                      {a.action} · {date(a.created_at)}
                    </p>
                  ))}
                </details>
              )}
            </>
          )}
        </>
      );
    }
    if (page === "new" || page === "edit") {
      if (account()) return account();
      const e = page === "edit" ? data.event : {};
      if (page === "edit" && !e) return null;
      return (
        <section className="panel">
          <h1>{page === "edit" ? "Editar hackathon" : "Seu próximo grande evento"}</h1>
          <EventForm
            event={e}
            busy={busy}
            save={async (v: Row, cover?: string | null) => {
              const d = await mutate(
                {
                  op: "event.save",
                  id: page === "edit" ? id : "",
                  orgId: page === "new" ? id : undefined,
                  data: v,
                },
                cover === undefined ? "/manage/:id" : undefined,
              );
              if (d?.id && cover !== undefined)
                await mutate({ op: "image.upload", kind: "cover", id: d.id, data: cover }, "/manage/" + d.id);
            }}
          />
        </section>
      );
    }
    if (page === "manage" && data.event) {
      const e = data.event;
      return (
        <>
          <a href={href("/org/" + e.org_id)}>← Organização</a>
          <div className="section-head">
            <div>
              <span className="pill">{status(e.status)}</span>
              <h1>{e.title}</h1>
            </div>
            <a className="button" href={href("/edit/" + id)}>
              Editar evento
            </a>
          </div>
          <div className="actions">
            {e.status !== "published" &&
              button("Publicar evento", { op: "event.publish", id }, "Publicar este hackathon no catálogo?")}
            {e.status === "published" && (
              <a className="button secondary" href={href("/event/" + id)}>
                Ver página
              </a>
            )}
            {button("Duplicar", { op: "event.duplicate", id }, undefined, "/manage/:id")}
            {e.status !== "archived" &&
              button(
                "Arquivar",
                { op: "event.archive", id },
                "Arquivar o evento e encerrar novas inscrições?",
              )}
          </div>
          <EventDashboard
            data={data}
            busy={busy}
            onAction={(b: Row) => mutate(b)}
            confirmButton={(t: Row) =>
              button("Confirmar equipe", { op: "team.confirm", id: t.id }, "Confirmar esta equipe?")
            }
          />
          <section className="panel section">
            <span className="eyebrow">TEAMMATCH</span>
            <h2>Formação assistida, com revisão humana.</h2>
            <p>
              Preserva as equipes existentes e combina inscritos sem equipe por disponibilidade e
              competências. Pessoas sem disponibilidade declarada ficam pendentes para revisão.
            </p>
            {button("Gerar proposta", { op: "matching.propose", id })}
            {data.runs.map((r: Row) => {
              const result = JSON.parse(r.payload);
              return (
                <details className="proposal" key={r.id}>
                  <summary>
                    Proposta de {date(r.created_at)} ·{" "}
                    {r.approved ? "Aprovada" : `${result.teams.length} equipes sugeridas`}
                  </summary>
                  {result.teams.map((t: Row, i: number) => (
                    <div className="notice" key={i}>
                      <b>Equipe {i + 1}</b>
                      <p>
                        {t.members
                          .map(
                            (pid: string) =>
                              data.registrations.find((p: Row) => p.user_id === pid)?.name || pid,
                          )
                          .join(", ")}
                      </p>
                      <small>{t.reason}</small>
                    </div>
                  ))}
                  {result.unassigned.map((u: Row) => (
                    <p key={u.id}>
                      {data.registrations.find((p: Row) => p.user_id === u.id)?.name}: {u.reason}
                    </p>
                  ))}
                  {!r.approved &&
                    !!result.teams.length &&
                    button(
                      "Aprovar e confirmar equipes",
                      { op: "matching.approve", id: r.id },
                      "Revise todos os integrantes. Confirmar e notificar estas equipes?",
                    )}
                </details>
              );
            })}
          </section>
        </>
      );
    }
    if (page === "radar")
      return (
        <>
          <section className="panel dark">
            <span className="eyebrow">RADAR HACKO · IA</span>
            <h1>
              Encontre seu
              <br />
              próximo movimento.
            </h1>
            <p>Busque no catálogo ou explore hackathons na web, com fontes para conferir.</p>
          </section>
          <section className="panel section">
            {account() || (
              <Form
                busy={busy}
                label="Buscar oportunidades"
                onSubmit={(v: Row) => {
                  setRadar(null);
                  mutate({ op: "radar", query: v.query, scope: v.scope });
                }}
              >
                <Field
                  name="query"
                  label="Que tipo de hackathon você procura?"
                  type="textarea"
                  required
                  help="Ex.: hackathons de IA em Fortaleza ou online, com inscrições abertas."
                />
                <Field name="scope" label="Onde buscar" value="Web" options={["Web", "Catálogo Hacko"]} />
                <small>
                  Até 20 buscas por dia. A consulta é enviada à OpenAI; não inclua dados sensíveis.
                </small>
              </Form>
            )}
          </section>
          {radar && (
            <>
              <p className="notice">
                {radar.scope} · Consulta em {date(radar.searchedAt || new Date().toISOString())}. Confira
                prazos e regras no site oficial antes de se inscrever.
              </p>
              {radar.text && (
                <div className="panel prewrap">
                  <CitedText text={radar.text} citations={radar.citations || []} />
                </div>
              )}
              <div className="grid">{radar.events?.map((e: Row) => <Card key={e.id} e={e} />)}</div>
              {radar.events?.length === 0 && (
                <div className="empty">
                  Nenhum evento corresponde aos filtros interpretados. Tente uma consulta mais ampla.
                </div>
              )}
              {radar.sources?.length > 0 && (
                <section className="panel section">
                  <h2>Fontes consultadas</h2>
                  {radar.sources.map((s: Row, i: number) => (
                    <p key={i}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title || s.url} ↗
                      </a>
                    </p>
                  ))}
                </section>
              )}
            </>
          )}
        </>
      );
    return (
      <div className="empty">
        Página não encontrada ou indisponível. <a href="#/">Voltar ao início</a>
      </div>
    );
  }
  return (
    <>
      <a className="skip" href="#main">
        Pular para conteúdo
      </a>
      <header>
        <a href="#/" className="logo" aria-label="Hacko — início">
          <Logo />
        </a>
        <nav aria-label="Principal">
          {links.map(([url, label]) => (
            <a key={url} href={href(url)} aria-current={route === url ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          {boot?.user && (
            <NotificationBell
              items={boot.notifications || []}
              onMarkRead={async () => {
                await fetch("/api/hacko", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ op: "notifications.read" }),
                });
                // Atualiza só a lista local, sem recarregar a página inteira.
                setBoot(
                  (b) => b && { ...b, notifications: b.notifications.map((n: Row) => ({ ...n, read: 1 })) },
                );
              }}
            />
          )}
          <a className="account-link" href={!boot?.user ? "#/login" : isCompany ? "#/company" : "#/profile"}>
            {isCompany && companyOrg?.logo_v && (
              <img
                className="header-logo"
                src={imageUrl("logo:" + companyOrg.id, companyOrg.logo_v)}
                alt=""
              />
            )}
            {(isCompany
              ? companyOrg?.name || boot?.user?.name
              : shortName(boot?.profile?.name || boot?.user?.name)) || "Minha conta"}{" "}
            ↗
          </a>
        </div>
        <div className="mobile-tabs">
          <a href="#/">Explorar</a>
          {isCompany ? (
            <>
              <a href="#/org">Meus eventos</a>
              <a href="#/inscritos">Inscritos</a>
            </>
          ) : (
            <>
              <a href="#/mine">Meus hackathons</a>
              <a href="#/teams">Equipes</a>
            </>
          )}
        </div>
      </header>
      <main id="main" className={page === "login" ? "" : "container"}>
        {error && (
          <div className="alert" role="alert">
            {error}{" "}
            <button className="ghost" onClick={() => (errorFromLoad ? load() : setError(""))}>
              {errorFromLoad ? "Recarregar" : "Fechar"}
            </button>
          </div>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <div className="empty" role="status">
            Carregando sua Hacko…
          </div>
        ) : (
          content()
        )}
        <footer>
          <span>
            <Logo arrow="var(--blue)" /> · Ideias grandes, conexões reais.
          </span>
          <a href="#/org">Para organizações</a>
          <span>
            <a href="/privacidade">Privacidade</a> · <a href="/termos">Termos de uso</a> · Fotos ilustrativas
            · Unsplash
          </span>
        </footer>
      </main>
      <nav className="bottom" aria-label="Atalhos mobile">
        <a href="#/">Explorar</a>
        {isCompany ? (
          <a href="#/org">Eventos</a>
        ) : (
          <>
            <a href="#/community">Comunidade</a>
            <a href="#/radar">Radar</a>
          </>
        )}
        <a href={isCompany ? "#/company" : "#/profile"}>Perfil</a>
      </nav>
    </>
  );
}
function Invite({ eventId, invite, busy }: any) {
  const [people, setPeople] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("event", eventId)
      .then((d) => setPeople(d.participants))
      .catch((e) => setError(e.message));
  }, [eventId]);
  return (
    <section className="panel">
      <h2>Convidar participante</h2>
      {error && <p role="alert">{error}</p>}
      <Form busy={busy} label="Enviar convite" onSubmit={(v: Row) => invite(v.userId)}>
        <label>
          Participante inscrito
          <select name="userId" required>
            <option value="">Selecione</option>
            {people.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.skills}
              </option>
            ))}
          </select>
        </label>
        <small>Apenas inscritos com perfil visível aparecem aqui.</small>
      </Form>
    </section>
  );
}
function EventForm({ event = {}, save, busy }: any) {
  // undefined = unchanged, null = remove, string = new data URL
  const cover = useRef<string | null | undefined>(undefined);
  const local = (s: string) =>
    s
      ? new Date(new Date(s).getTime() - new Date(s).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : "";
  return (
    <Form
      busy={busy}
      label="Salvar evento"
      onSubmit={(v: Row) => {
        for (const k of ["starts_at", "ends_at", "opens_at", "closes_at"])
          v[k] = new Date(v[k]).toISOString();
        v.submission_deadline = v.submission_deadline ? new Date(v.submission_deadline).toISOString() : "";
        for (const k of ["capacity", "team_min", "team_max", "image"]) v[k] = Number(v[k]);
        save(v, cover.current);
      }}
    >
      <div className="form-grid">
        <Field name="title" label="Nome do hackathon" value={event.title} required />
        <Field name="theme" label="Tema" value={event.theme} required />
        <Field
          name="format"
          label="Modalidade"
          value={event.format || "Presencial"}
          options={["Presencial", "Online", "Híbrido"]}
        />
        <Field name="city" label="Cidade / UF (ou Online)" value={event.city} required />
        <Field name="venue" label="Local ou plataforma" value={event.venue} required />
        <Field name="source" label="Site oficial (opcional)" type="url" value={event.source} />
      </div>
      <ImageInput
        label="Capa do hackathon"
        help="JPG, PNG ou WebP. Recortada em 1600×640 (proporção 5:2). Sem capa, usamos a imagem ilustrativa escolhida abaixo."
        current={event.cover_v ? coverOf(event) : ""}
        aspect="wide"
        onChange={(d: string | null) => (cover.current = d)}
      />
      <Field
        name="summary"
        label="Descrição — mínimo 20 caracteres"
        value={event.summary}
        type="textarea"
        required
      />
      <Field
        name="eligibility"
        label="Quem pode participar"
        value={event.eligibility}
        type="textarea"
        required
      />
      <Field
        name="rules"
        label="Regulamento — mínimo 20 caracteres"
        value={event.rules}
        type="textarea"
        required
      />
      <div className="form-grid">
        {[
          ["opens_at", "Abertura das inscrições"],
          ["closes_at", "Fim das inscrições"],
          ["starts_at", "Início do evento"],
          ["ends_at", "Fim do evento"],
        ].map(([name, label]) => (
          <Field
            key={name}
            name={name}
            label={label}
            type="datetime-local"
            value={local(event[name])}
            required
          />
        ))}
        <Field
          name="submission_deadline"
          label="Prazo de entrega dos projetos (opcional)"
          type="datetime-local"
          value={local(event.submission_deadline)}
          help="Se ficar vazio, vale o fim do evento."
        />
        <Field name="capacity" label="Vagas" type="number" value={event.capacity || 100} required />
        <Field name="team_min" label="Mínimo por equipe" type="number" value={event.team_min || 2} required />
        <Field name="team_max" label="Máximo por equipe" type="number" value={event.team_max || 5} required />
        <label>
          Imagem ilustrativa (sem capa enviada)
          <select name="image" defaultValue={event.image ?? 3}>
            <option value="0">Comunidade e inovação</option>
            <option value="1">Pessoas e conexões</option>
            <option value="2">Colaboração</option>
            <option value="3">Padrão Hacko ↗</option>
          </select>
        </label>
      </div>
      <p className="notice">
        Novos eventos são salvos como rascunho. A publicação é uma ação separada no painel. Datas seguem o
        fuso horário do seu navegador.
      </p>
    </Form>
  );
}
function CitedText({ text, citations }: any) {
  const pieces: any[] = [];
  let cursor = 0;
  for (const [i, c] of citations.entries()) {
    if (c.start_index < cursor || c.end_index > text.length) continue;
    pieces.push(text.slice(cursor, c.start_index));
    pieces.push(
      <a key={i} href={c.url} target="_blank" rel="noreferrer" title={c.title}>
        [{i + 1}] {c.title}
      </a>,
    );
    cursor = c.end_index;
  }
  pieces.push(text.slice(cursor));
  return <>{pieces}</>;
}
