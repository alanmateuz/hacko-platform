import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import * as domain from "../lib/domain.mjs";
const require = createRequire(import.meta.url),
  sql = new DatabaseSync(":memory:");
sql.exec("PRAGMA foreign_keys=ON");
for (const f of fs
  .readdirSync(new URL("../drizzle/", import.meta.url))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  sql.exec(fs.readFileSync(new URL("../drizzle/" + f, import.meta.url), "utf8"));
const db = {
  prepare(query) {
    let values = [];
    return {
      bind(...v) {
        values = v;
        return this;
      },
      async first() {
        return sql.prepare(query).get(...values) || null;
      },
      async all() {
        return { results: sql.prepare(query).all(...values) };
      },
      async run() {
        const r = sql.prepare(query).run(...values);
        return { meta: { changes: Number(r.changes) } };
      },
    };
  },
  async batch(statements) {
    sql.exec("BEGIN");
    try {
      const result = [];
      for (const s of statements) result.push(await s.run());
      sql.exec("COMMIT");
      return result;
    } catch (e) {
      sql.exec("ROLLBACK");
      throw e;
    }
  },
};
let user = null;
function compiled(path, imports) {
  const js = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, {
    module: mod,
    exports: mod.exports,
    require: (x) => imports[x] ?? require(x),
    Response,
    Request,
    URL,
    crypto,
    console,
    AbortSignal,
    atob,
    btoa,
    TextEncoder,
    Headers,
    Uint8Array,
    fetch,
  });
  return mod.exports;
}
const validation = compiled("../lib/validation.ts", {});
const api = compiled("../app/api/hacko/route.ts", {
  "cloudflare:workers": { env: { DB: db } },
  "../../session": { getCurrentUser: async () => user },
  "../../../lib/auth": {
    enabledProviders: () => ["google", "github", "linkedin"],
    emailEnabled: () => false,
  },
  "../../../lib/validation": validation,
  "../../../lib/domain.mjs": domain,
});
const as = (id) => {
  user = id ? { userId: id, email: id + "@example.test", displayName: id } : null;
};
async function post(body) {
  const r = await api.POST(
    new Request("https://hacko.test/api/hacko", {
      method: "POST",
      headers: { origin: "https://hacko.test", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: r.status, body: await r.json() };
}
async function get(action, id = "") {
  const r = await api.GET(new Request("https://hacko.test/api/hacko?action=" + action + "&id=" + id));
  return { status: r.status, body: await r.json() };
}
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();
let org, event, team;
test("fase 01: autenticação, isolamento e jornada de evento/equipe", async () => {
  as(null);
  assert.equal((await post({ op: "organization", data: { name: "Empresa" } })).status, 401);
  for (const id of ["owner", "other", "alice", "bob", "carol", "dave"]) {
    as(id);
    assert.equal(
      (
        await post({
          op: "profile",
          data: {
            name: id,
            bio: "",
            skills: "Java, UX",
            interests: "",
            city: "Fortaleza",
            availability: "Noites",
            linkedin: "",
            github: "",
            visible: id !== "carol",
          },
        })
      ).status,
      200,
    );
  }
  as("owner");
  org = (await post({ op: "organization", data: { name: "Organização teste", description: "" } })).body.id;
  const data = {
    title: "Hackathon teste",
    summary: "Evento sintético de teste funcional.",
    rules: "Regras para participação no evento teste.",
    eligibility: "Participantes de teste",
    format: "Online",
    city: "Online",
    venue: "Plataforma online",
    theme: "IA",
    starts_at: day(10),
    ends_at: day(11),
    opens_at: day(-1),
    closes_at: day(9),
    capacity: 3,
    team_min: 2,
    team_max: 2,
    image: 0,
    source: "",
  };
  event = (await post({ op: "event.save", orgId: org, data })).body.id;
  assert.ok(event);
  assert.equal((await get("bootstrap")).body.events.length, 0);
  as("other");
  assert.equal((await get("manage", event)).status, 403);
  assert.equal((await post({ op: "event.save", id: event, data })).status, 403);
  assert.equal((await get("event", event)).status, 404);
  as("owner");
  const draftReg = await post({ op: "register", id: event, accept: true });
  assert.equal(draftReg.status, 409);
  assert.match(draftReg.body.error, /não foi publicado/);
  assert.equal((await post({ op: "event.publish", id: event })).status, 400);
  assert.equal((await post({ op: "event.publish", id: event, confirm: true })).status, 200);
  for (const id of ["alice", "bob", "carol"]) {
    as(id);
    assert.equal((await post({ op: "register", id: event, accept: true })).status, 200);
  }
  as("dave");
  assert.equal((await post({ op: "register", id: event, accept: true })).status, 409);
  as("alice");
  assert.equal((await post({ op: "register", id: event, accept: true })).body.already, true);
  const publiclyVisible = (await get("event", event)).body.participants;
  assert.ok(!publiclyVisible.some((p) => p.id === "carol"));
  assert.ok(publiclyVisible.every((p) => !("email" in p)));
  team = (
    await post({
      op: "team.create",
      data: { event_id: event, name: "Equipe teste", skills: "React", description: "" },
    })
  ).body.id;
  assert.ok(team);
  assert.equal(
    (
      await post({
        op: "team.create",
        data: { event_id: event, name: "Outra equipe", skills: "", description: "" },
      })
    ).status,
    409,
  );
  assert.equal(sql.prepare("SELECT count(*) n FROM teams").get().n, 1);
  as("other");
  assert.equal((await post({ op: "team.leave", id: team })).status, 403);
  assert.equal((await post({ op: "team.dissolve", id: team, confirm: true })).status, 403);
  as("bob");
  assert.equal((await post({ op: "team.request", id: team })).status, 200);
  as("alice");
  const request = (await get("team", team)).body.requests[0];
  assert.equal(
    (await post({ op: "team.respond", id: team, requestId: request.id, accept: true })).status,
    200,
  );
  as("carol");
  await post({ op: "team.request", id: team });
  as("alice");
  const req = (await get("team", team)).body.requests.find((r) => r.user_id === "carol");
  assert.equal((await post({ op: "team.respond", id: team, requestId: req.id, accept: true })).status, 409);
  as("owner");
  assert.equal((await post({ op: "team.confirm", id: team })).status, 200);
  const managed = (await get("manage", event)).body;
  assert.equal(managed.registrations.length, 3);
  assert.equal(managed.teams[0].members, 2);
  assert.equal((await post({ op: "event.save", id: event, data: { ...data, capacity: 2 } })).status, 409);
  as("bob");
  assert.equal((await post({ op: "cancel", id: event })).status, 400);
  assert.equal((await post({ op: "team.leave", id: team })).status, 200);
  assert.equal(sql.prepare("SELECT status FROM teams WHERE id=?").get(team).status, "forming");
  assert.equal((await post({ op: "cancel", id: event })).status, 200);
  as("owner");
  assert.equal((await post({ op: "team.confirm", id: team })).status, 409);
  const bad = await api.POST(
    new Request("https://hacko.test/api/hacko", {
      method: "POST",
      headers: { origin: "https://evil.test", "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(bad.status, 403);
});
test("matching: 20, 100 e 300 participantes, sem omissões ou duplicidades", () => {
  for (const size of [20, 100, 300])
    for (const [min, max] of [
      [2, 3],
      [3, 5],
      [5, 7],
    ]) {
      const people = Array.from({ length: size }, (_, i) => ({
        id: String(i).padStart(4, "0"),
        skills: i % 2 ? "Java, React" : "UX, Produto",
        availability: i % 7 === 0 ? "" : i % 3 ? "Noites" : "Integral",
      }));
      const result = domain.suggestTeams(people, min, max);
      assert.deepEqual(result, domain.suggestTeams([...people].reverse(), min, max));
      const ids = [...result.teams.flatMap((t) => t.members), ...result.unassigned.map((p) => p.id)];
      assert.equal(new Set(ids).size, size);
      assert.equal(ids.length, size);
      for (const t of result.teams) {
        assert.ok(t.members.length >= min && t.members.length <= max);
        assert.equal(new Set(t.members.map((id) => people.find((p) => p.id === id).availability)).size, 1);
      }
    }
});
test("matching: rejeita IDs duplicados e limites inválidos", () => {
  assert.throws(() => domain.suggestTeams([{ id: "a" }, { id: "a" }], 2, 4));
  assert.throws(() => domain.suggestTeams([], 5, 2));
});
test("catálogo: filtros combinados e acentuação", () => {
  const events = [
    {
      title: "Inovação",
      summary: "Teste",
      theme: "IA",
      city: "Fortaleza",
      format: "Online",
      starts_at: "2027-01-05T10:00:00Z",
    },
  ];
  assert.equal(
    domain.searchCatalog(events, {
      q: "inovacao",
      city: "forta",
      format: "Online",
      from: "2027-01-01",
      to: "2027-01-06",
    }).length,
    1,
  );
  assert.equal(domain.searchCatalog(events, { format: "Presencial" }).length, 0);
});

test("v3: upload de capa e foto de perfil", async () => {
  // 1x1 PNG
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const image = async (key) => api.GET(new Request("https://hacko.test/api/hacko?action=image&id=" + key));
  as("other");
  assert.equal((await post({ op: "image.upload", kind: "cover", id: event, data: png })).status, 403);
  as("owner");
  assert.equal(
    (await post({ op: "image.upload", kind: "cover", id: event, data: "data:text/html;base64,PGI+" })).status,
    400,
  );
  assert.equal(
    (
      await post({
        op: "image.upload",
        kind: "cover",
        id: event,
        data: "data:image/png;base64,/9j/4AAQSkZJRg==",
      })
    ).status,
    400,
  );
  assert.equal((await post({ op: "image.upload", kind: "cover", id: event, data: png })).status, 200);
  assert.ok((await get("event", event)).body.event.cover_v);
  const r = await image("cover:" + event);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  as("carol"); // profile not visible
  assert.equal((await post({ op: "image.upload", kind: "avatar", data: png })).status, 200);
  assert.equal((await image("avatar:carol")).status, 200);
  as("alice");
  assert.equal((await image("avatar:carol")).status, 404);
  assert.equal((await post({ op: "image.upload", kind: "avatar", data: png })).status, 200);
  as(null);
  assert.equal((await image("avatar:alice")).status, 200);
  assert.equal((await post({ op: "image.upload", kind: "avatar", data: png })).status, 401);
  as("alice");
  assert.equal((await post({ op: "image.upload", kind: "avatar", data: null })).status, 200);
  assert.equal((await image("avatar:alice")).status, 404);
  assert.equal((await post({ op: "profile", data: { name: "x".repeat(50000) } })).status, 413);
});

test("auth: cadastro e login com senha, sessão, logout e proteções", async () => {
  const auth = compiled("../lib/auth.ts", {
    "cloudflare:workers": { env: { DB: db } },
  });
  const origin = "http://localhost:5173";
  const call = (path, body, from = origin) =>
    auth[path](
      new Request(origin + "/api/auth/" + path, {
        method: "POST",
        headers: { origin: from, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const sessionOf = (r) => r.headers.get("set-cookie").match(/hacko_session=([^;]+)/)[1];

  assert.equal(
    (
      await call(
        "signup",
        { name: "Pessoa Teste", email: "x@y.test", password: "12345678" },
        "https://evil.test",
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("signup", { name: "Pessoa Teste", email: "nao-e-email", password: "12345678" })).status,
    400,
  );
  assert.equal(
    (await call("signup", { name: "Pessoa Teste", email: "ana@example.test", password: "curta" })).status,
    400,
  );
  // regras da senha: 8+ caracteres, maiúscula e número
  assert.match(
    (
      await (
        await call("signup", { name: "Pessoa Teste", email: "ana@example.test", password: "semmaiuscula1" })
      ).json()
    ).error,
    /maiúscula/,
  );
  assert.match(
    (
      await (
        await call("signup", { name: "Pessoa Teste", email: "ana@example.test", password: "SemNumeroAqui" })
      ).json()
    ).error,
    /número/,
  );
  // nome e sobrenome são obrigatórios no cadastro
  assert.match(
    (await (await call("signup", { email: "sem-nome@example.test", password: "Senha-forte-1" })).json())
      .error,
    /sobrenome/,
  );
  assert.equal(
    (await call("signup", { name: "Maria", email: "so-nome@example.test", password: "Senha-forte-1" }))
      .status,
    400,
  );
  const created = await call("signup", {
    name: "  Pessoa   Teste ",
    email: "Ana@Example.test",
    password: "Senha-forte-1",
  });
  assert.equal(created.status, 200);
  assert.match(created.headers.get("set-cookie"), /hacko_session=[^;]+; Path=\/; HttpOnly; SameSite=Lax/);
  const me = await auth.userFromCookieHeader("hacko_session=" + sessionOf(created));
  assert.equal(me.email, "ana@example.test");
  assert.equal(me.displayName, "Pessoa Teste");
  assert.equal(
    (await call("signup", { name: "Pessoa Teste", email: "ana@example.test", password: "Outra-senha1" }))
      .status,
    409,
  );
  // senha nunca é guardada em texto puro
  const stored = sql
    .prepare("SELECT password_hash FROM users WHERE email='ana@example.test'")
    .get().password_hash;
  assert.match(stored, /^pbkdf2\$100000\$/);
  assert.ok(!stored.includes("Senha-forte-1"));

  assert.equal((await call("login", { email: "ana@example.test", password: "errada" })).status, 401);
  assert.equal((await call("login", { email: "ninguem@example.test", password: "errada" })).status, 401);
  const ok = await call("login", { email: " ANA@example.test ", password: "Senha-forte-1" });
  assert.equal(ok.status, 200);
  const session = sessionOf(ok);
  assert.equal(await auth.userFromCookieHeader("hacko_session=forjado"), null);
  await auth.logout(
    new Request(origin + "/api/auth/logout", {
      method: "POST",
      headers: { cookie: "hacko_session=" + session },
    }),
  );
  assert.equal(await auth.userFromCookieHeader("hacko_session=" + session), null);

  // limite de tentativas erradas
  for (let i = 0; i < 10; i++) await call("login", { email: "ana@example.test", password: "errada" });
  assert.equal((await call("login", { email: "ana@example.test", password: "Senha-forte-1" })).status, 429);

  // pop-up do Google: erros e sucesso voltam para a janela que abriu o pop-up
  const pop = await auth.oauth("google", new Request(origin + "/api/auth/google?popup=1"));
  assert.equal(pop.status, 200);
  assert.equal(pop.headers.get("location"), null);
  const html = await pop.text();
  assert.match(html, /postMessage\(\{hacko:"login",to:t\},location.origin\)/);
  assert.match(html, /provedor_indisponivel/);
  // provedor sem chaves configuradas não inicia o fluxo
  const r = await auth.oauth("google", new Request(origin + "/api/auth/google"));
  assert.equal(r.headers.get("location"), "/#/login?erro=provedor_indisponivel");
  assert.deepEqual([...auth.enabledProviders()], []);
});

test("conta: esqueci minha senha e exclusão de conta", async () => {
  const auth = compiled("../lib/auth.ts", { "cloudflare:workers": { env: { DB: db } } });
  const origin = "http://localhost:5173";
  const call = (path, body) =>
    auth[path](
      new Request(origin + "/api/auth/" + path, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  assert.equal(
    (await call("signup", { name: "Pessoa Teste", email: "rita@example.test", password: "Senha-antiga1" }))
      .status,
    200,
  );
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => logs.push(a.join(" "));
  try {
    // e-mail sem conta recebe a mesma resposta (não revela quem está cadastrado)
    assert.equal((await call("forgotPassword", { email: "ninguem@example.test" })).status, 200);
    assert.equal(logs.length, 0);
    assert.equal((await call("forgotPassword", { email: "Rita@example.test" })).status, 200);
  } finally {
    console.log = origLog;
  }
  const token = new URL(logs.at(-1).split(" ").at(-1).replace("/#/redefinir", "/redefinir")).searchParams.get(
    "token",
  );
  assert.ok(token);
  assert.ok(!sql.prepare("SELECT 1 FROM password_resets WHERE id=?").get(token)); // só o hash fica salvo
  assert.equal((await call("resetPassword", { token, password: "fraca" })).status, 400);
  assert.equal((await call("resetPassword", { token: "forjado", password: "Senha-nova1" })).status, 400);
  assert.equal((await call("resetPassword", { token, password: "Senha-nova1" })).status, 200);
  assert.equal((await call("resetPassword", { token, password: "Outra-senha2" })).status, 400); // uso único
  assert.equal((await call("login", { email: "rita@example.test", password: "Senha-antiga1" })).status, 401);
  assert.equal((await call("login", { email: "rita@example.test", password: "Senha-nova1" })).status, 200);

  // exclusão: líder de equipe com outros membros precisa dissolver antes
  // cenário: cópia do evento com uma equipe de dois membros liderada por bob
  const cols = sql
    .prepare("SELECT name FROM pragma_table_info('events') WHERE name<>'id'")
    .all()
    .map((c) => c.name)
    .join(",");
  sql.exec(`INSERT INTO events(id,${cols}) SELECT 'ev-del',${cols} FROM events LIMIT 1`);
  sql.exec(
    "INSERT INTO teams(id,event_id,name,leader_id,status,skills,description) VALUES('t-del','ev-del','Equipe del','bob','forming','','')",
  );
  sql.exec(
    "INSERT INTO team_members(team_id,event_id,user_id) VALUES('t-del','ev-del','bob'),('t-del','ev-del','carol')",
  );
  as("bob");
  assert.equal((await post({ op: "account.delete", confirm: "EXCLUIR" })).status, 409);
  as("dave");
  assert.equal((await post({ op: "account.delete", confirm: "sim" })).status, 400);
  const ok = await api.POST(
    new Request("https://hacko.test/api/hacko", {
      method: "POST",
      headers: { origin: "https://hacko.test", "content-type": "application/json" },
      body: JSON.stringify({ op: "account.delete", confirm: "EXCLUIR" }),
    }),
  );
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("set-cookie"), /hacko_session=; .*Max-Age=0/);
  for (const t of [
    "profiles WHERE id",
    "registrations WHERE user_id",
    "favorites WHERE user_id",
    "notifications WHERE user_id",
  ])
    assert.equal(sql.prepare(`SELECT count(*) n FROM ${t}='dave'`).get().n, 0, t);
  // dono de organização com inscritos não pode apagar a conta sem resolver o evento
  as("owner");
  assert.equal((await post({ op: "account.delete", confirm: "EXCLUIR" })).status, 409);
});
