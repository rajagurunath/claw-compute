"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { api } from "@/lib/api";

const Status = z.enum(["draft", "active", "archived"]);

const Body = z.object({
  title: z.string().min(1).max(200),
  description: z.string().default(""),
  price_per_hour_cents: z.coerce.number().int().min(0),
  capability_tags: z
    .string()
    .transform((s) => s.split(",").map((t) => t.trim()).filter(Boolean)),
  status: Status,
});

const PartialBody = Body.partial();

export type OfferingFormResult = { error?: string };

export async function createOffering(
  _prev: OfferingFormResult | null,
  fd: FormData,
): Promise<OfferingFormResult> {
  const parsed = Body.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await api.post("/v1/offerings", parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create." };
  }
  revalidatePath("/dashboard/suppliers/offerings");
  redirect("/dashboard/suppliers/offerings");
}

export async function updateOffering(
  id: string,
  _prev: OfferingFormResult | null,
  fd: FormData,
): Promise<OfferingFormResult> {
  const parsed = PartialBody.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await api.patch(`/v1/offerings/${id}`, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update." };
  }
  revalidatePath("/dashboard/suppliers/offerings");
  redirect("/dashboard/suppliers/offerings");
}

export async function archiveOffering(id: string, _fd?: FormData): Promise<void> {
  try {
    await api.del(`/v1/offerings/${id}`);
  } catch (e) {
    // Surface as a redirect with no toast; offering list shows the latest state.
    console.error("archive failed", e);
  }
  revalidatePath("/dashboard/suppliers/offerings");
  redirect("/dashboard/suppliers/offerings");
}
