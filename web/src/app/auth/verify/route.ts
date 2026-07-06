import { NextRequest, NextResponse } from "next/server";

import { ApiError, api } from "@/lib/api";
import { getToken, setToken } from "@/lib/session";

export const dynamic = "force-dynamic";

// Cookie writes are only allowed in Server Actions and Route Handlers, so the
// magic-link landing is a GET route handler (it used to be a page that set
// the cookie during render, which Next 16 rejects).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (!token) return to("/auth/login");

  try {
    const result = await api.post<{ access_token: string }>(
      "/v1/auth/verify",
      { token },
      { auth: false },
    );
    // Always overwrite any existing cookie — a stale session must never win
    // over a fresh magic link. 24h matches backend's JWT_USER_TTL_HOURS.
    await setToken(result.access_token, 60 * 60 * 24);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // Token consumed (double-open of the link). If the session that was
      // set on the first open still works, this is a successful sign-in.
      if (await getToken()) {
        try {
          await api.get("/v1/me");
          return to("/dashboard");
        } catch {
          // fall through to the error redirect
        }
      }
      return to("/auth/login?error=invalid-or-expired-link");
    }
    throw e;
  }
  return to("/dashboard");
}
