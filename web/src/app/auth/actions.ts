"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { api } from "@/lib/api";
import { setToken } from "@/lib/session";

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
  const result = await api.post<{ access_token: string }>(
    "/v1/auth/verify",
    { token },
    { auth: false },
  );
  // 24h cookie matches backend's JWT_USER_TTL_HOURS default.
  await setToken(result.access_token, 60 * 60 * 24);
  redirect("/dashboard");
}
