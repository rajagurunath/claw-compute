"use server";

import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type { BookingStatus, MessageOut } from "@/lib/api-types";

export type TransitionResult = { error?: string };

async function transition(id: string, to: BookingStatus): Promise<TransitionResult> {
  try {
    await api.post(`/v1/bookings/${id}/transition`, { to });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "Transition failed." };
  }
  revalidatePath(`/dashboard/bookings/${id}`);
  return {};
}

/** Pay + lock USDC on Arc, then create the agent (pending → active). */
export async function startAgent(
  _prev: TransitionResult | null,
  fd: FormData,
): Promise<TransitionResult> {
  return transition(String(fd.get("id")), "active");
}

/** End the session — settles actual usage on Arc (active → completed). */
export async function endSession(
  _prev: TransitionResult | null,
  fd: FormData,
): Promise<TransitionResult> {
  return transition(String(fd.get("id")), "completed");
}

/** Cancel — partial usage settled on Arc, the rest released. */
export async function cancelBooking(
  _prev: TransitionResult | null,
  fd: FormData,
): Promise<TransitionResult> {
  return transition(String(fd.get("id")), "cancelled");
}

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
