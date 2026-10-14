import { headers } from "next/headers";
import { userFromCookieHeader } from "../lib/auth";
export type { AuthUser } from "../lib/auth";
// Current signed-in user for the request (session cookie), or null.
export async function getCurrentUser() {
  return userFromCookieHeader((await headers()).get("cookie"));
}
