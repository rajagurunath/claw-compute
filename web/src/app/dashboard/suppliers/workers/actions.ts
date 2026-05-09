"use server";

import { z } from "zod";

import { api } from "@/lib/api";
import type { ProvisioningTokenResponse } from "@/lib/api-types";

const Schema = z.object({ name: z.string().min(1).max(120) });

export type CreateWorkerResult =
  | { ok: true; provisioning_token: string; worker_id: string }
  | { error: string };

export async function createWorker(formData: FormData): Promise<CreateWorkerResult> {
  const parsed = Schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "Name required." };
  try {
    const result = await api.post<ProvisioningTokenResponse>(
      "/v1/workers/provisioning-tokens",
      parsed.data,
    );
    return {
      ok: true,
      provisioning_token: result.provisioning_token,
      worker_id: result.worker.id,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create worker." };
  }
}
