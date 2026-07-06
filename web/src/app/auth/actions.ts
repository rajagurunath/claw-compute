"use server";

import { z } from "zod";

import { api } from "@/lib/api";

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

// Magic-link verification lives in app/auth/verify/route.ts — cookie writes
// are only allowed in Server Actions and Route Handlers, and the landing is
// a plain GET.
