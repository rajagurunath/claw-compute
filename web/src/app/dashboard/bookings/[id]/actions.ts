"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api";
import type { MessageOut } from "@/lib/api-types";

export type SendMessageResult =
  | { ok: true; message: MessageOut }
  | { ok: false; error: string };

export async function sendMessage(
  bookingId: string,
  formData: FormData,
): Promise<SendMessageResult> {
  const content = (formData.get("content") as string | null)?.trim();
  if (!content) return { ok: false, error: "Type a message." };
  try {
    const message = await api.post<MessageOut>(
      `/v1/bookings/${bookingId}/messages`,
      { content },
    );
    revalidatePath(`/dashboard/bookings/${bookingId}`);
    return { ok: true, message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Send failed.",
    };
  }
}
