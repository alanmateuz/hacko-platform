import { oauth } from "../../../../lib/auth";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => oauth("google", request);
