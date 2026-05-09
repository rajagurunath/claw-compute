import { cookies } from "next/headers";

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "claw_session";

export async function getToken(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE)?.value ?? null;
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
