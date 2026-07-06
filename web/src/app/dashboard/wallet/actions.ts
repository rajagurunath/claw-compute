"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api } from "@/lib/api";

const Address = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Enter a valid 0x address (40 hex characters).");

export type WalletFormState = { error?: string; saved?: boolean };

export async function saveEscrowWallet(
  _prev: WalletFormState | null,
  formData: FormData,
): Promise<WalletFormState> {
  const parsed = Address.safeParse(formData.get("wallet_address"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid address." };
  }
  try {
    await api.put("/v1/me/wallet", { wallet_address: parsed.data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save wallet." };
  }
  revalidatePath("/dashboard/wallet");
  return { saved: true };
}

export async function savePayoutWallet(
  _prev: WalletFormState | null,
  formData: FormData,
): Promise<WalletFormState> {
  const parsed = Address.safeParse(formData.get("wallet_address"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid address." };
  }
  try {
    await api.patch("/v1/suppliers/me", { payout_wallet: parsed.data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save wallet." };
  }
  revalidatePath("/dashboard/wallet");
  return { saved: true };
}
