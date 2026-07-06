import Image from "next/image";
import { ArrowDown, MessageSquare, Server, Zap } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: <Server className="h-5 w-5" />,
    title: "A Mac plugs in",
    body: "Supplier runs one curl. The worker binary fingerprints the chip, registers with the marketplace, and starts heartbeating every 30s.",
  },
  {
    n: "02",
    icon: <ArrowDown className="h-5 w-5" />,
    title: "A consumer hires it",
    body: "Pick an offering on /browse, set duration, confirm. USDC for the session locks in on-chain escrow and the worker is notified over an outbound WebSocket.",
  },
  {
    n: "03",
    icon: <Zap className="h-5 w-5" />,
    title: "The sandbox spins up",
    body: "Worker spins up a fresh microVM (or Lima fallback on macOS 14/15). MLX preloads the model. Latency from booking to ready ≈ 0.8s.",
  },
  {
    n: "04",
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Chat or call the API",
    body: "Stream tokens through the relay or POST to /v1/chat/completions. When the booking ends, escrow settles on-chain for actual usage and the sandbox tears down clean.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-6 py-28">
      <header className="mb-14 max-w-2xl">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-accent-crimson">
          How it works
        </p>
        <h2 className="text-balance font-heading text-4xl tracking-tight md:text-6xl">
          <span className="headline-gradient">From <em className="not-italic font-normal">curl</em> to prompt in four moves.</span>
        </h2>
      </header>

      <ol className="relative grid gap-5 md:grid-cols-4">
        {/* connecting hairline */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-12 hidden h-px bg-gradient-to-r from-transparent via-[rgb(var(--crimson))]/40 to-transparent md:block"
        />
        {steps.map((s) => (
          <Step key={s.n} {...s} />
        ))}
      </ol>

      <div className="divider-dot mt-16" />

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-[11px] text-muted-foreground">
        {[
          "hardened-runtime signed",
          "0 inbound ports",
          "open-source worker",
          "documented threat model",
          "USDC settlement on-chain",
        ].map((t) => (
          <span key={t} className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rotate-45 bg-[rgb(var(--crimson))]" />
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="surface-card relative flex flex-col rounded-xl border border-white/8 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-background/60 text-foreground">
          {icon}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent-crimson">
          step {n}
        </span>
      </div>
      <h3 className="mt-3 font-heading text-xl tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Image
        src="/openclaw.svg"
        alt=""
        aria-hidden
        width={32}
        height={32}
        className="absolute -right-2 -top-3 h-8 w-8 opacity-50 motion-safe:animate-claw-bob"
      />
    </li>
  );
}
