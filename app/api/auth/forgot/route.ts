import { forgotPassword } from "../../../../lib/auth";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => forgotPassword(request);
