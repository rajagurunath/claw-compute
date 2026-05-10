"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError, api } from "@/lib/api";
import { getToken, setToken } from "@/lib/session";

// Identify Next.js's internal redirect "error" so we don't accidentally
// swallow it inside a try/catch. Public API doesn't export a helper, so
// we sniff the digest the runtime attaches.
function isRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

const RequestSchema = z.object({ email: z.string().email() });

export type AuthState = { ok?: true; error?: string };

export async function requestMagicLink(
  _prev: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const parsed = RequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };
  try {
    await api.post("/v1/auth/magic-link", parsed.data, { auth: false });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send link." };
  }
}

export async function verifyMagicLink(token: string): Promise<void> {
  // Server actions can fire twice during RSC render (e.g. when Next streams
  // and re-renders a route segment). The magic-link token is single-use, so
  // the second call gets a 401. If we already set a session cookie on the
  // first call, that's a successful sign-in — fall through to /dashboard.
  try {
    const result = await api.post<{ access_token: string }>(
      "/v1/auth/verify",
      { token },
      { auth: false },
    );
    // 24h cookie matches backend's JWT_USER_TTL_HOURS default.
    await setToken(result.access_token, 60 * 60 * 24);
  } catch (e) {
    // redirect() throws a NEXT_REDIRECT — let it propagate.
    if (isRedirectError(e)) throw e;
    if (e instanceof ApiError && e.status === 401) {
      // Token already consumed. If we have a session, treat as success.
      const existing = await getToken();
      if (!existing) {
        redirect("/auth/login?error=invalid-or-expired-link");
      }
    } else {
      throw e;
    }
  }
  redirect("/dashboard");
}
