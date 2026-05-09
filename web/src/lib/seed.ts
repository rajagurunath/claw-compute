import type { OfferingList, OfferingOut } from "./api-types";

// Seed offerings used as a graceful fallback when NEXT_PUBLIC_API_URL is
// unreachable (e.g. preview deploys before the marketplace API is live).
// They demonstrate the breadth of the marketplace; ids are stable so deep
// links into /offerings/<id> keep working.

export const SEED_OFFERINGS: OfferingOut[] = [
  {
    id: "seed-mac-studio-m3-max",
    supplier_id: "seed-supplier-1",
    title: "Mac Studio M3 Max · 64 GB · MLX-tuned",
    description:
      "Dedicated Mac Studio M3 Max with 64 GB unified memory. mlx-lm pre-warmed with Qwen3.5-7B-Instruct-4bit. Sub-second sandbox boot via Apple `container`. 1 Gbps fibre.",
    price_per_hour_cents: 180,
    capability_tags: ["macos", "mlx", "m3-max", "qwen3.5", "64gb"],
    status: "active",
  },
  {
    id: "seed-macbook-m3-pro",
    supplier_id: "seed-supplier-2",
    title: "MacBook Pro M3 Pro · 36 GB · low-latency",
    description:
      "MacBook Pro M3 Pro 14\". 36 GB unified memory. Plugged in 24/7, fibre uplink, located in EU-West for low transatlantic latency.",
    price_per_hour_cents: 120,
    capability_tags: ["macos", "mlx", "m3-pro", "eu-west"],
    status: "active",
  },
  {
    id: "seed-mac-mini-m4",
    supplier_id: "seed-supplier-3",
    title: "Mac mini M4 · 24 GB · always-on",
    description:
      "Bargain entry tier. Mac mini M4 with 24 GB. Great for Gemma 3 12B and small Qwen models. Always-on home lab, residential fibre.",
    price_per_hour_cents: 50,
    capability_tags: ["macos", "mlx", "m4", "gemma", "budget"],
    status: "active",
  },
  {
    id: "seed-mac-studio-m4-max",
    supplier_id: "seed-supplier-4",
    title: "Mac Studio M4 Max · 128 GB · big-model tier",
    description:
      "Top-of-line M4 Max with 128 GB. Comfortably runs Qwen3.5-30B-A3B (MoE) at >100 tok/s. Symmetric 2.5 Gbps fibre. Dedicated machine.",
    price_per_hour_cents: 350,
    capability_tags: ["macos", "mlx", "m4-max", "qwen-30b", "moe", "128gb"],
    status: "active",
  },
  {
    id: "seed-macbook-m3-max",
    supplier_id: "seed-supplier-5",
    title: "MacBook Pro M3 Max · 48 GB · agent-tuned",
    description:
      "MacBook Pro M3 Max 16\" with 48 GB. Pre-warmed with Trinity Mini for agentic workloads. AU-East region. Plugged in business hours only — pause-aware bookings.",
    price_per_hour_cents: 200,
    capability_tags: ["macos", "mlx", "m3-max", "trinity-mini", "ap-southeast"],
    status: "active",
  },
  {
    id: "seed-imac-m3",
    supplier_id: "seed-supplier-6",
    title: "iMac M3 · 24 GB · learner tier",
    description:
      "Cheapest active offering. iMac M3 24 GB. Limited to llama.cpp models <8B but rock-solid uptime. US-Central, residential gigabit.",
    price_per_hour_cents: 30,
    capability_tags: ["macos", "llama-cpp", "m3", "us-central", "budget"],
    status: "active",
  },
];

export const SEED_OFFERING_LIST: OfferingList = {
  items: SEED_OFFERINGS,
  total: SEED_OFFERINGS.length,
};

export function findSeedOffering(id: string): OfferingOut | undefined {
  return SEED_OFFERINGS.find((o) => o.id === id);
}
