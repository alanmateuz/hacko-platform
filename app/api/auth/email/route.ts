import { sendEmailLink, verifyEmailLink } from "../../../../lib/auth";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => sendEmailLink(request);
export const GET = (request: Request) => verifyEmailLink(request);
