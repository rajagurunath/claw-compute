import { cookies } from "next/headers";

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "claw_session";

export async function getToken(): Promise<string | null> {
  const c = await cookies();
  const cookieValue = c.get(COOKIE)?.value;
  if (cookieValue) return cookieValue;
  // Dev bypass: when CLAW_DEV_BYPASS_AUTH=1, fall back to CLAW_DEV_JWT so
  // pages render against the real API without an interactive sign-in.
  // Never enable in production.
  if (process.env.CLAW_DEV_BYPASS_AUTH === "1" && process.env.CLAW_DEV_JWT) {
    return process.env.CLAW_DEV_JWT;
  }
  return null;
}

export async function setToken(value: string, maxAgeSeconds: number): Promise<void> {
  const c = await cookies();
  c.set({
    name: COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearToken(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}
