import { ArrowDown, MessageSquare, Server, Zap } from "lucide-react";

import { ClawIcon } from "@/components/claw/ClawIcon";

const steps = [
  {
    n: "01",
    accent: "cyan" as const,
    icon: <Server className="h-5 w-5" />,
    title: "A Mac plugs in",
    body: "Supplier runs one curl. The worker binary fingerprints the chip, registers with the marketplace, and starts heartbeating every 30s.",
  },
  {
    n: "02",
    accent: "magenta" as const,
    icon: <ArrowDown className="h-5 w-5" />,
    title: "Consumer drops a coin",
    body: "Pick an offering on /browse, set duration, hit Insert Coin. The marketplace activates a booking and notifies the worker over an outbound WebSocket.",
  },
  {
    n: "03",
    accent: "amber" as const,
    icon: <Zap className="h-5 w-5" />,
    title: "The claw fires the sandbox",
    body: "Worker spins up a fresh microVM (or Lima fallback on macOS 14/15). MLX preloads the model. Latency from booking → ready ≈ 0.8s.",
  },
  {
    n: "04",
    accent: "cyan" as const,
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Chat or hit the API",
    body: "Stream tokens through the relay or POST to /v1/chat/completions. When you cancel, the sandbox tears down and the next renter gets a clean machine.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-6 py-24">
      <div className="mb-14 max-w-2xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-[rgb(var(--claw-magenta-rgb))]">
          /// how.it.works
        </p>
        <h2 className="text-balance font-heading text-4xl tracking-tight md:text-6xl">
          From <span className="text-neon-cyan">curl</span> to{" "}
          <span className="text-neon-magenta">prompt</span> in four moves.
        </h2>
      </div>

      <ol className="relative grid gap-5 md:grid-cols-4">
        {/* connecting cable */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-12 hidden h-px bg-gradient-to-r from-[rgb(var(--claw-cyan-rgb)/0)] via-[rgb(var(--claw-cyan-rgb)/0.5)] to-[rgb(var(--claw-cyan-rgb)/0)] md:block"
        />
        {steps.map((s) => (
          <Step key={s.n} {...s} />
        ))}
      </ol>

      {/* trust strip */}
      <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-2xl border border-white/5 bg-background/30 p-5 font-mono text-[11px] text-muted-foreground">
        <Trust label="hardened-runtime signed" />
        <Trust label="0 inbound ports" />
        <Trust label="open-source worker" />
        <Trust label="threat model documented" />
        <Trust label="weekly stripe payouts" />
      </div>
    </section>
  );
}

function Step({
  n,
  accent,
  icon,
  title,
  body,
}: {
  n: string;
  accent: "cyan" | "magenta" | "amber";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const colorVar = `rgb(var(--claw-${accent}-rgb))`;
  return (
    <li className="relative flex flex-col rounded-2xl border border-white/10 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 place-items-center rounded-lg border bg-background/60"
          style={{ borderColor: `${colorVar}55`, color: colorVar }}
        >
          {icon}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: colorVar }}>
          step {n}
        </span>
      </div>
      <h3 className="mt-3 font-heading text-xl tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {/* tiny mascot peek */}
      <ClawIcon
        variant={accent}
        className="absolute -right-2 -top-3 h-8 w-8 motion-safe:animate-claw-bob"
      />
    </li>
  );
}

function Trust({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--claw-cyan-rgb))]" />
      {label}
    </span>
  );
}
