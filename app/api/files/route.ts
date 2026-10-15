import { getCurrentUser } from "../../session";
import { downloadFile, uploadFile } from "../../../lib/deliveries";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const u = await getCurrentUser();
  if (!u) return Response.json({ error: "Entre para continuar." }, { status: 401 });
  if (u.accountType === "company") return Response.json({ error: "Apenas equipes enviam arquivos." }, { status: 403 });
  return uploadFile(request, u.userId);
}
export async function GET(request: Request) {
  const u = await getCurrentUser();
  return downloadFile(request, u?.userId || null);
}
