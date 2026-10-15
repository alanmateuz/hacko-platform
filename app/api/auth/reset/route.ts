import { resetPassword } from "../../../../lib/auth";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => resetPassword(request);
