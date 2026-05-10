import {
  ArrowUpRight,
  Box,
  CircuitBoard,
  GitBranch,
  Lock,
  Rocket,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

import { ClawIcon } from "@/components/claw/ClawIcon";

export function Offerings() {
  return (
    <section id="offerings" className="relative mx-auto max-w-6xl px-6 py-24">
      {/* heading */}
      <div className="mb-14 max-w-3xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-[rgb(var(--claw-cyan-rgb))]">
          /// pick.your.tier
        </p>
        <h2 className="text-balance font-heading text-4xl tracking-tight md:text-6xl">
          Three ways to <span className="text-neon-magenta">grab the prize</span>.
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Suppliers light up the offerings they want to host. Each one runs
          inside the same Apple-signed sandbox — clean teardown, no state
          leaking between renters.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SandboxCard />
        <InferenceCard />
        <HermesCard />
      </div>
    </section>
  );
}

/* ========================================================================== */
/*  SANDBOX                                                                    */
/* ========================================================================== */

function SandboxCard() {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-[rgb(var(--claw-cyan-rgb)/0.25)] bg-card/60 p-7 backdrop-blur-sm bevel transition hover:border-[rgb(var(--claw-cyan-rgb)/0.6)] hover:-translate-y-1">
      <div aria-hidden className="pointer-events-none absolute inset-0 holo opacity-30" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[rgb(var(--claw-cyan-rgb))] opacity-10 blur-3xl" />

      <Header
        accent="cyan"
        icon={<Box className="h-5 w-5" />}
        kicker="01 / sandbox"
        title="Sandbox"
        tagline="Disposable Linux microVMs for agentic coding"
      />

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Drop an agent into a fresh Linux box and let it loose. Every booking gets
        its own VM via Apple&rsquo;s <code className="font-mono text-foreground">container</code>{" "}
        framework — boots in under a second, full reset on session end. Perfect
        for code-running agents, build experiments, and scratch workspaces that
        you don&rsquo;t want anywhere near your laptop.
      </p>

      <ul className="mt-5 space-y-2.5 text-sm">
        <Bullet icon={<Terminal className="h-3.5 w-3.5" />} accent="cyan">
          Full POSIX environment — bash, git, node, python, uv, cargo
        </Bullet>
        <Bullet icon={<GitBranch className="h-3.5 w-3.5" />} accent="cyan">
          Pull a repo, run the agent, push the diff back. Zero local risk.
        </Bullet>
        <Bullet icon={<Shield className="h-3.5 w-3.5" />} accent="cyan">
          Hardened-Runtime signed; no escalation to host filesystem
        </Bullet>
        <Bullet icon={<Zap className="h-3.5 w-3.5" />} accent="cyan">
          0.8s cold-start. Snapshots cache common toolchains.
        </Bullet>
      </ul>

      <UseCases title="Built for" items={["coding agents", "test harnesses", "untrusted code", "background workers"]} accent="cyan" />

      <div className="mt-auto flex items-center justify-between pt-7 font-mono text-xs">
        <span className="text-muted-foreground">from <span className="text-[rgb(var(--claw-cyan-rgb))]">$0.40 / hr</span></span>
        <a href="/browse?tier=sandbox" className="inline-flex items-center gap-1 text-[rgb(var(--claw-cyan-rgb))] hover:underline">
          browse hosts <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

/* ========================================================================== */
/*  INFERENCE                                                                  */
/* ========================================================================== */

function InferenceCard() {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-[rgb(var(--claw-magenta-rgb)/0.3)] bg-card/60 p-7 backdrop-blur-sm bevel transition hover:border-[rgb(var(--claw-magenta-rgb)/0.7)] hover:-translate-y-1">
      <div aria-hidden className="pointer-events-none absolute inset-0 holo opacity-30" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[rgb(var(--claw-magenta-rgb))] opacity-10 blur-3xl" />

      <Header
        accent="magenta"
        icon={<CircuitBoard className="h-5 w-5" />}
        kicker="02 / inference"
        title="Inference"
        tagline="Local LLM serving on Apple Silicon, no provider markup"
      />

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Hit a chat-completions endpoint that runs on a real M-series chip.
        MLX-tuned models stream at <span className="font-mono text-foreground">130 tok/s</span> on
        an M3 Max — measurably faster than llama.cpp on the same hardware.
        No spread on tokens, no cold-boot fees, no data leaving the machine
        you rented.
      </p>

      {/* Inline tok/s chart */}
      <BarChart />

      <ul className="mt-5 space-y-2.5 text-sm">
        <Bullet icon={<Sparkles className="h-3.5 w-3.5" />} accent="magenta">
          OpenAI-compatible <code className="font-mono text-foreground">/v1/chat/completions</code> — drop-in
        </Bullet>
        <Bullet icon={<Lock className="h-3.5 w-3.5" />} accent="magenta">
          Prompts and outputs never touch the marketplace. Edge-private by default.
        </Bullet>
        <Bullet icon={<Zap className="h-3.5 w-3.5" />} accent="magenta">
          MLX 4-bit quants for Qwen, Gemma, Llama; vLLM coming for x86 hosts
        </Bullet>
      </ul>

      <UseCases title="Built for" items={["RAG", "fine-tunes", "private chat", "batch eval"]} accent="magenta" />

      <div className="mt-auto flex items-center justify-between pt-7 font-mono text-xs">
        <span className="text-muted-foreground">from <span className="text-[rgb(var(--claw-magenta-rgb))]">$0.90 / hr</span></span>
        <a href="/browse?tier=inference" className="inline-flex items-center gap-1 text-[rgb(var(--claw-magenta-rgb))] hover:underline">
          browse hosts <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

/* ========================================================================== */
/*  HERMES — coming soon                                                       */
/* ========================================================================== */

function HermesCard() {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-[rgb(var(--claw-amber-rgb)/0.25)] bg-card/40 p-7 backdrop-blur-sm bevel transition hover:border-[rgb(var(--claw-amber-rgb)/0.55)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 holo opacity-20" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[rgb(var(--claw-amber-rgb))] opacity-10 blur-3xl" />

      {/* coming-soon ribbon */}
      <div className="absolute right-5 top-5 rotate-[8deg] rounded-md border border-[rgb(var(--claw-amber-rgb)/0.6)] bg-[rgb(var(--claw-amber-rgb)/0.15)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[rgb(var(--claw-amber-rgb))]">
        soon™
      </div>

      <Header
        accent="amber"
        icon={<Rocket className="h-5 w-5" />}
        kicker="03 / hermes"
        title="Claw / Hermes"
        tagline="Long-running autonomous agents with persistent memory"
      />

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        A persistent agent runtime that survives across bookings. Hermes carries
        your prompts, tools, and embeddings between sessions — so you can hire
        a Mac on Tuesday, come back on Friday, and pick up exactly where the
        agent left off. We&rsquo;re wiring this up after Sandbox + Inference
        prove out.
      </p>

      <ul className="mt-5 space-y-2.5 text-sm opacity-80">
        <Bullet icon={<Sparkles className="h-3.5 w-3.5" />} accent="amber">
          Pinned model + tool config travels with the agent identity
        </Bullet>
        <Bullet icon={<GitBranch className="h-3.5 w-3.5" />} accent="amber">
          Vector store + scratch FS persisted, encrypted, optionally restored
        </Bullet>
        <Bullet icon={<Shield className="h-3.5 w-3.5" />} accent="amber">
          Trust-but-verify v2: Secure Enclave attestation per booking
        </Bullet>
      </ul>

      <div className="mt-6 rounded-xl border border-[rgb(var(--claw-amber-rgb)/0.25)] bg-[rgb(var(--claw-amber-rgb)/0.06)] p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[rgb(var(--claw-amber-rgb))]">
          waitlist
        </div>
        <p className="text-xs text-muted-foreground">
          We&rsquo;re onboarding design partners. <a href="/auth/login" className="underline decoration-[rgb(var(--claw-amber-rgb)/0.5)] underline-offset-2 hover:text-foreground">Sign in</a> and we&rsquo;ll ping you when it ships.
        </p>
      </div>

      <div className="mt-auto pt-7 font-mono text-xs text-muted-foreground">
        eta · q3 2026
      </div>
    </article>
  );
}

/* ========================================================================== */
/*  Shared bits                                                                */
/* ========================================================================== */

function Header({
  accent,
  icon,
  kicker,
  title,
  tagline,
}: {
  accent: "cyan" | "magenta" | "amber";
  icon: React.ReactNode;
  kicker: string;
  title: string;
  tagline: string;
}) {
  const variant = accent === "cyan" ? "cyan" : accent === "magenta" ? "magenta" : "amber";
  const colorVar = `rgb(var(--claw-${accent}-rgb))`;
  return (
    <div>
      <div className="flex items-center gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl border bg-background/60"
          style={{ borderColor: `${colorVar}55`, color: colorVar }}
        >
          {icon}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: colorVar }}>
          {kicker}
        </div>
        <ClawIcon variant={variant} className="ml-auto h-7 w-7 motion-safe:animate-claw-bob" />
      </div>
      <h3 className="mt-4 font-heading text-3xl tracking-tight">{title}</h3>
      <p className="mt-1 text-sm font-medium" style={{ color: colorVar }}>{tagline}</p>
    </div>
  );
}

function Bullet({
  icon,
  accent,
  children,
}: {
  icon: React.ReactNode;
  accent: "cyan" | "magenta" | "amber";
  children: React.ReactNode;
}) {
  const colorVar = `rgb(var(--claw-${accent}-rgb))`;
  return (
    <li className="flex items-start gap-2.5 text-muted-foreground">
      <span
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border"
        style={{ borderColor: `${colorVar}40`, color: colorVar, background: `${colorVar}10` }}
      >
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

function UseCases({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "cyan" | "magenta" | "amber";
}) {
  const colorVar = `rgb(var(--claw-${accent}-rgb))`;
  return (
    <div className="mt-5 border-t border-white/5 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
            style={{ borderColor: `${colorVar}40`, color: colorVar, background: `${colorVar}10` }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarChart() {
  const rows = [
    { name: "Claw · MLX", val: 130, accent: "magenta" as const },
    { name: "llama.cpp",   val: 92,  accent: "amber"   as const },
    { name: "OpenAI gpt-4o", val: 75, accent: "cyan"    as const },
    { name: "Together · Llama-70B", val: 58, accent: "amber" as const },
  ];
  const max = 140;
  return (
    <div className="mt-5 rounded-xl border border-white/5 bg-background/40 p-4">
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>tok/s · Qwen 7B</span>
        <span>m3 max, batch 1</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate text-[11px] text-muted-foreground">{r.name}</span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-white/5">
              <div
                className="h-full"
                style={{
                  width: `${(r.val / max) * 100}%`,
                  background: `linear-gradient(90deg, rgb(var(--claw-${r.accent}-rgb)/0.3), rgb(var(--claw-${r.accent}-rgb)))`,
                  boxShadow: `0 0 12px rgb(var(--claw-${r.accent}-rgb)/0.5)`,
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-[11px] text-foreground">{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
