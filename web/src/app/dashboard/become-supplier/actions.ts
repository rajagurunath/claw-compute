"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { api } from "@/lib/api";

const Schema = z.object({
  display_name: z.string().min(1).max(120),
  payout_email: z.string().email(),
});

export type BecomeSupplierState = { error?: string };

export async function becomeSupplier(
  _prev: BecomeSupplierState | null,
  formData: FormData,
): Promise<BecomeSupplierState> {
  const parsed = Schema.safeParse({
    display_name: formData.get("display_name"),
    payout_email: formData.get("payout_email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await api.post("/v1/suppliers", parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed." };
  }
  redirect("/dashboard/suppliers");
}
