import { Code2, Coins, Cpu, Lock, Shield, Workflow } from "lucide-react";

const features = [
  {
    icon: Cpu,
    accent: "from-violet-500/20 to-violet-500/5 text-violet-500",
    title: "Real Apple Silicon",
    body: "Local MLX inference at 130 tok/s on M3 Max. 3× faster than llama.cpp on MoE models. No GPU rental markup, no cold-boot fees.",
  },
  {
    icon: Lock,
    accent: "from-cyan-500/20 to-cyan-500/5 text-cyan-500",
    title: "Sandboxed agents",
    body: "Each booking runs in its own Linux microVM via Apple's `container` framework. Sub-second boot. Full reset on session end.",
  },
  {
    icon: Coins,
    accent: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
    title: "Suppliers keep 88%",
    body: "Set your hourly rate. Marketplace takes a flat 12%. Stripe payout on a schedule that works for you.",
  },
  {
    icon: Code2,
    accent: "from-amber-500/20 to-amber-500/5 text-amber-500",
    title: "Open-source worker",
    body: "One curl command installs a code-signed binary. Read every line on GitHub before running it on your hardware.",
  },
  {
    icon: Shield,
    accent: "from-rose-500/20 to-rose-500/5 text-rose-500",
    title: "Trust-but-verify",
    body: "Hardened-Runtime sign in v1; Secure Enclave attestation in v2. Documented threat model — no hand-waving.",
  },
  {
    icon: Workflow,
    accent: "from-blue-500/20 to-blue-500/5 text-blue-500",
    title: "Outbound only",
    body: "Worker connects out over HTTPS. No port forwarding, no DDNS, no inbound firewall holes. Works behind any NAT.",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-12 max-w-2xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          What you get
        </p>
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Built for an AI workload, not a crypto miner.
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: typeof Cpu;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition hover:border-foreground/20 hover:shadow-lg">
      <div
        className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent opacity-0 transition group-hover:opacity-100"
      />
    </div>
  );
}
