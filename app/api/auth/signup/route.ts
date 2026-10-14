import { signup } from "../../../../lib/auth";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => signup(request);
