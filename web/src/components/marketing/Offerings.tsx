import Image from "next/image";
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

export function Offerings() {
  return (
    <section id="offerings" className="relative mx-auto max-w-6xl px-6 py-28">
      <header className="mb-14 max-w-3xl">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-accent-crimson">
          Capabilities
        </p>
        <h2 className="text-balance font-heading text-4xl tracking-tight md:text-6xl">
          <span className="headline-gradient">Three workloads</span>, one binary.
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Suppliers light up the workloads they want to host. Each one runs
          inside the same Apple-signed sandbox, with clean teardown between
          renters and zero state leakage.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
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
    <Card>
      <Header
        kicker="01 / Claw Sandbox"
        title="Sandbox"
        tagline="Disposable Linux microVMs for agentic coding"
        icon={<Box className="h-5 w-5" />}
      />
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Drop an agent into a fresh Linux VM and let it run. Each booking gets
        its own microVM via Apple&rsquo;s <Code>container</Code> framework —
        boots in under a second, full reset on session end. Built for code-
        running agents, build experiments, and untrusted workloads that you
        don&rsquo;t want anywhere near your laptop.
      </p>

      <ul className="mt-6 space-y-2.5 text-sm">
        <Bullet icon={<Terminal className="h-3.5 w-3.5" />}>
          Full POSIX environment: bash, git, Node, Python, uv, Cargo
        </Bullet>
        <Bullet icon={<GitBranch className="h-3.5 w-3.5" />}>
          Pull a repo, run the agent, push the diff back. Zero local risk.
        </Bullet>
        <Bullet icon={<Shield className="h-3.5 w-3.5" />}>
          Hardened-Runtime signed; no escalation to host filesystem
        </Bullet>
        <Bullet icon={<Zap className="h-3.5 w-3.5" />}>
          0.8s cold-start. Snapshots cache common toolchains.
        </Bullet>
      </ul>

      <UseCases items={["coding agents", "test harnesses", "untrusted code", "background jobs"]} />

      <Footer price="$0.40 / hr" href="/browse?tier=sandbox" />
    </Card>
  );
}

/* ========================================================================== */
/*  INFERENCE                                                                  */
/* ========================================================================== */

function InferenceCard() {
  return (
    <Card>
      <Header
        kicker="02 / Claw Inference"
        title="Inference"
        tagline="Local LLM serving on Apple Silicon, no provider markup"
        icon={<CircuitBoard className="h-5 w-5" />}
      />
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Hit a chat-completions endpoint that runs on a real M-series chip.
        MLX-tuned models stream at <Code>130 tok/s</Code> on an M3 Max —
        measurably faster than llama.cpp on the same hardware. No spread on
        tokens, no cold-boot fees, no data leaving the Mac you rented.
      </p>

      <BarChart />

      <ul className="mt-6 space-y-2.5 text-sm">
        <Bullet icon={<Sparkles className="h-3.5 w-3.5" />}>
          OpenAI-compatible <Code>/v1/chat/completions</Code> — drop-in
        </Bullet>
        <Bullet icon={<Lock className="h-3.5 w-3.5" />}>
          Prompts and outputs never touch the marketplace. Edge-private by default.
        </Bullet>
        <Bullet icon={<Zap className="h-3.5 w-3.5" />}>
          MLX 4-bit quants for Qwen, Gemma, Llama; vLLM coming for x86 hosts
        </Bullet>
      </ul>

      <UseCases items={["RAG", "fine-tunes", "private chat", "batch eval"]} />

      <Footer price="$0.90 / hr" href="/browse?tier=inference" />
    </Card>
  );
}

/* ========================================================================== */
/*  HERMES                                                                     */
/* ========================================================================== */

function HermesCard() {
  return (
    <Card muted>
      <div className="absolute right-5 top-5 rounded-full border border-[rgb(var(--crimson))]/40 bg-[rgb(var(--crimson))]/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-crimson">
        Q3 · 2026
      </div>

      <Header
        kicker="03 / Claw Hermes"
        title="Hermes"
        tagline="Persistent agents with memory across bookings"
        icon={<Rocket className="h-5 w-5" />}
      />

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        A persistent agent runtime that survives across bookings. Hermes
        carries your prompts, tools, and embeddings between sessions — so you
        can hire a Mac on Tuesday, return Friday, and pick up exactly where
        the agent left off. Shipping after Sandbox + Inference reach GA.
      </p>

      <ul className="mt-6 space-y-2.5 text-sm opacity-90">
        <Bullet icon={<Sparkles className="h-3.5 w-3.5" />}>
          Pinned model + tool config travels with the agent identity
        </Bullet>
        <Bullet icon={<GitBranch className="h-3.5 w-3.5" />}>
          Vector store + scratch FS persisted, encrypted, optionally restored
        </Bullet>
        <Bullet icon={<Shield className="h-3.5 w-3.5" />}>
          Trust-but-verify v2: Secure Enclave attestation per booking
        </Bullet>
      </ul>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-crimson">
          Design partner waitlist
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Building a long-running agent? <a href="/auth/login" className="text-foreground underline-offset-2 hover:underline">Sign in</a> and we&rsquo;ll notify you when Hermes opens.
        </p>
      </div>
    </Card>
  );
}

/* ========================================================================== */
/*  Shared building blocks                                                     */
/* ========================================================================== */

function Card({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <article
      className={`group surface-card relative flex flex-col overflow-hidden rounded-2xl border border-white/8 p-7 transition hover:-translate-y-0.5 hover:border-[rgb(var(--crimson))]/40 ${
        muted ? "opacity-95" : ""
      }`}
    >
      {/* corner claw — quietly bobbing */}
      <Image
        src="/openclaw.svg"
        alt=""
        aria-hidden
        width={48}
        height={48}
        className="pointer-events-none absolute -right-3 -top-3 h-12 w-12 opacity-30 transition group-hover:opacity-60 motion-safe:animate-claw-bob"
      />
      {children}
    </article>
  );
}

function Header({
  kicker,
  title,
  tagline,
  icon,
}: {
  kicker: string;
  title: string;
  tagline: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent-crimson">
        {kicker}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-background/60 text-foreground">
          {icon}
        </span>
        <h3 className="font-heading text-3xl tracking-tight">{title}</h3>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground/80">{tagline}</p>
    </div>
  );
}

function Bullet({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-muted-foreground">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-white/10 bg-background/60 text-accent-crimson">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

function UseCases({ items }: { items: string[] }) {
  return (
    <div className="mt-6 border-t border-white/5 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Built for
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground/80"
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function Footer({ price, href }: { price: string; href: string }) {
  return (
    <div className="mt-auto flex items-center justify-between pt-7 font-mono text-xs">
      <span className="text-muted-foreground">
        from <span className="tabular text-foreground">{price}</span>
      </span>
      <a href={href} className="inline-flex items-center gap-1 text-foreground hover:text-accent-crimson">
        Browse hosts <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

function BarChart() {
  const rows = [
    { name: "Claw · MLX",        val: 130 },
    { name: "llama.cpp",         val: 92  },
    { name: "OpenAI gpt-4o",     val: 75  },
    { name: "Together · Llama-70B", val: 58 },
  ];
  const max = 140;
  return (
    <div className="mt-6 rounded-xl border border-white/8 bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>tok/s · Qwen 7B · batch 1</span>
        <span>M3 Max</span>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate text-[11px] text-muted-foreground">{r.name}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-white/5">
              <div
                className="h-full"
                style={{
                  width: `${(r.val / max) * 100}%`,
                  background: i === 0
                    ? "linear-gradient(90deg, rgb(var(--crimson)/0.6), rgb(var(--crimson)))"
                    : "linear-gradient(90deg, rgb(var(--ivory)/0.15), rgb(var(--ivory)/0.35))",
                }}
              />
            </div>
            <span
              className={`w-8 shrink-0 text-right font-mono text-[11px] ${
                i === 0 ? "text-accent-crimson" : "text-foreground/80"
              }`}
            >
              {r.val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
