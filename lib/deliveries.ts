// Itens da entrega das equipes: arquivos (fotos e PDFs no R2) e links.
// Qualquer integrante anexa; o líder envia (team.submit); a organização do evento valida.
import { env } from "cloudflare:workers";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ITEMS = 10;
const TYPES: Record<string, (b: Uint8Array) => boolean> = {
  "application/pdf": (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b) =>
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP",
};

function db(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB unavailable");
  return env.DB;
}
function bucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("R2 binding BUCKET unavailable");
  return env.BUCKET;
}
const now = () => new Date().toISOString();
const json = (data: object, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
export const storageKey = (teamId: string, itemId: string) => `deliveries/${teamId}/${itemId}`;

// Quem pode ver/alterar a entrega de uma equipe.
export async function teamAccess(teamId: string, userId: string) {
  const row = await db()
    .prepare(
      `SELECT t.id,t.name,t.leader_id,t.submission_status,e.id event_id,e.starts_at,e.ends_at,e.submission_deadline,o.owner_id,
        EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.id AND m.user_id=?) member
       FROM teams t JOIN events e ON e.id=t.event_id JOIN organizations o ON o.id=e.org_id WHERE t.id=?`,
    )
    .bind(userId, teamId)
    .first<Record<string, any>>();
  if (!row) return null;
  return { ...row, member: !!row.member, organizer: row.owner_id === userId };
}
// Anexar/remover itens: integrantes, do início do evento até o prazo, antes da validação.
export function editWindowError(t: Record<string, any>) {
  const at = now();
  if (!t.member) return "Apenas integrantes da equipe podem alterar a entrega.";
  if (at < t.starts_at) return "As entregas abrem no início do evento.";
  if (at > (t.submission_deadline || t.ends_at)) return "O prazo de entrega terminou.";
  if (t.submission_status === "evaluated") return "Esta entrega já foi validada.";
  return null;
}

// POST /api/files?team=<id>&name=<arquivo>  (corpo = bytes do arquivo, Content-Type do arquivo)
export async function uploadFile(request: Request, userId: string) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Origem inválida." }, 403);
  const url = new URL(request.url);
  const teamId = url.searchParams.get("team") || "";
  const name = (url.searchParams.get("name") || "arquivo").replace(/[\\/\r\n"]/g, "_").slice(0, 120);
  const mime = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES[mime]) return json({ error: "Envie fotos (JPG, PNG, WebP) ou PDF." }, 415);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_FILE_BYTES) return json({ error: "Arquivo muito grande (máx. 20 MB)." }, 413);
  const t = await teamAccess(teamId, userId);
  if (!t) return json({ error: "Equipe não encontrada." }, 404);
  const blocked = editWindowError(t);
  if (blocked) return json({ error: blocked }, t.member ? 409 : 403);
  const count = await db()
    .prepare("SELECT count(*) n FROM delivery_items WHERE team_id=?")
    .bind(teamId)
    .first<{ n: number }>();
  if ((count?.n || 0) >= MAX_ITEMS) return json({ error: `Limite de ${MAX_ITEMS} itens por entrega.` }, 409);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return json({ error: "Arquivo vazio." }, 400);
  if (bytes.length > MAX_FILE_BYTES) return json({ error: "Arquivo muito grande (máx. 20 MB)." }, 413);
  if (!TYPES[mime](bytes))
    return json({ error: "O conteúdo do arquivo não corresponde ao tipo informado." }, 400);
  const id = crypto.randomUUID();
  await bucket().put(storageKey(teamId, id), bytes, { httpMetadata: { contentType: mime } });
  await db()
    .prepare(
      "INSERT INTO delivery_items(id,team_id,kind,name,mime,size,url,uploaded_by,created_at) VALUES(?,?,'file',?,?,?,'',?,?)",
    )
    .bind(id, teamId, name, mime, bytes.length, userId, now())
    .run();
  return json({ ok: true, id });
}

// GET /api/files?id=<item>  — só integrantes da equipe e a organização do evento.
export async function downloadFile(request: Request, userId: string | null) {
  if (!userId) return new Response("Entre para continuar.", { status: 401 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const item = await db()
    .prepare("SELECT * FROM delivery_items WHERE id=? AND kind='file'")
    .bind(id)
    .first<Record<string, any>>();
  if (!item) return new Response("Arquivo não encontrado.", { status: 404 });
  const t = await teamAccess(item.team_id, userId);
  if (!t || !(t.member || t.organizer)) return new Response("Sem acesso a este arquivo.", { status: 403 });
  const obj = await bucket().get(storageKey(item.team_id, item.id));
  if (!obj) return new Response("Arquivo não encontrado.", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": item.mime,
      "Content-Length": String(item.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

// Remove os arquivos de uma equipe do R2 (usado ao dissolver equipe / excluir conta).
export async function deleteTeamFiles(teamId: string) {
  if (!env.BUCKET) return;
  const listed = await bucket().list({ prefix: `deliveries/${teamId}/` });
  if (listed.objects.length) await bucket().delete(listed.objects.map((o) => o.key));
}
export { now as nowIso };
