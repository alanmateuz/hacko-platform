import { login } from "../../../../lib/auth";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => login(request);
