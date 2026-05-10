import Link from "next/link";
import { ArrowRight, Cpu, Sparkles, Zap } from "lucide-react";

import { ClawIcon } from "@/components/claw/ClawIcon";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* mesh gradient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 transform-gpu blur-3xl"
      >
        <div
          className="relative left-1/2 aspect-[1155/678] w-[80rem] -translate-x-1/2 rotate-[30deg] bg-[conic-gradient(at_50%_50%,rgb(var(--claw-cyan-rgb)/0.55),rgb(var(--claw-magenta-rgb)/0.45),rgb(var(--claw-amber-rgb)/0.35),rgb(var(--claw-cyan-rgb)/0.55))] opacity-40 motion-safe:animate-hero-pulse"
          style={{
            clipPath:
              "polygon(74% 44%, 100% 61%, 97% 26%, 85% 0%, 80% 2%, 72% 32%, 60% 62%, 52% 68%, 47% 58%, 45% 34%, 27% 76%, 0% 64%, 17% 100%, 27% 76%, 76% 97%, 74% 44%)",
          }}
        />
      </div>

      {/* CRT corner brackets */}
      <Bracket className="left-4 top-4 rotate-0" />
      <Bracket className="right-4 top-4 rotate-90" />
      <Bracket className="left-4 bottom-4 -rotate-90" />
      <Bracket className="right-4 bottom-4 rotate-180" />

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pt-20 pb-24 md:grid-cols-[1.2fr_1fr] md:gap-14 md:pt-28 md:pb-32">
        {/* LEFT — copy */}
        <div className="relative z-10 flex flex-col">
          <div className="mb-5 flex items-center gap-2 self-start rounded-full border border-[rgb(var(--claw-cyan-rgb)/0.4)] bg-[rgb(var(--claw-cyan-rgb)/0.08)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--claw-cyan-rgb))]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(var(--claw-cyan-rgb))] shadow-[0_0_10px_rgb(var(--claw-cyan-rgb))]" />
            INSERT_COIN · MARKETPLACE.LIVE
          </div>

          <h1 className="text-balance font-heading text-6xl leading-[0.95] tracking-tight md:text-8xl">
            Hire the
            <br />
            <span className="relative inline-block">
              <span className="text-neon-cyan motion-safe:animate-flicker">claw</span>
              <Underline />
            </span>
            .
            <br />
            <span className="text-foreground/70">Pay by the</span>
            <br />
            <span className="text-neon-magenta">hour.</span>
          </h1>

          <p className="mt-7 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
            A peer-to-peer arcade for idle Apple Silicon. One curl turns your
            Mac into a sandboxed AI agent host. Consumers grab a machine, drop
            in a prompt, and the claw runs the job — locally, privately, fast.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group min-w-48 bg-[rgb(var(--claw-cyan-rgb))] text-background shadow-[0_0_30px_rgb(var(--claw-cyan-rgb)/0.5)] hover:bg-[rgb(var(--claw-cyan-rgb))] hover:brightness-110"
            >
              <Link href="/browse">
                Insert coin
                <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-w-48 border-[rgb(var(--claw-magenta-rgb)/0.5)] text-[rgb(var(--claw-magenta-rgb))] hover:bg-[rgb(var(--claw-magenta-rgb)/0.1)] hover:text-[rgb(var(--claw-magenta-rgb))]"
            >
              <Link href="/auth/login?next=/dashboard/become-supplier">
                Plug in your Mac
              </Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-[rgb(var(--claw-amber-rgb))]" /> open-source worker</span>
            <span className="inline-flex items-center gap-1.5"><Cpu className="h-3 w-3 text-[rgb(var(--claw-cyan-rgb))]" /> MLX-native</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="h-3 w-3 text-[rgb(var(--claw-magenta-rgb))]" /> sub-second sandbox</span>
          </div>
        </div>

        {/* RIGHT — arcade cabinet with the claw */}
        <ArcadeCabinet />
      </div>

      {/* Live stats — marquee strip */}
      <StatsMarquee />
    </section>
  );
}

function Bracket({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-10 h-6 w-6 border-l-2 border-t-2 border-[rgb(var(--claw-cyan-rgb)/0.7)] ${className ?? ""}`}
    />
  );
}

function Underline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 12"
      className="absolute -bottom-1 left-0 w-full motion-safe:animate-pulse"
      preserveAspectRatio="none"
    >
      <path
        d="M2 8 Q 50 -2 100 6 T 198 4"
        stroke="rgb(var(--claw-cyan-rgb))"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
    </svg>
  );
}

function ArcadeCabinet() {
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
      {/* cabinet body */}
      <div className="absolute inset-0 rounded-[28px] border border-white/10 bg-gradient-to-b from-[rgb(var(--claw-cyan-rgb)/0.10)] to-[rgb(var(--claw-magenta-rgb)/0.10)] bevel">
        {/* screen */}
        <div className="absolute inset-x-5 top-5 h-2/3 overflow-hidden rounded-2xl border border-[rgb(var(--claw-cyan-rgb)/0.35)] bg-background shadow-[inset_0_0_60px_rgb(var(--claw-cyan-rgb)/0.25)]">
          <div className="absolute inset-0 bg-grid-lines opacity-50" />
          <div className="absolute inset-0 bg-scanlines opacity-30" />
          {/* prize pile silhouette */}
          <div className="absolute inset-x-6 bottom-2 h-10 rounded-b-xl bg-gradient-to-t from-[rgb(var(--claw-amber-rgb)/0.35)] to-transparent blur-md" />
          {/* claw — anchored top, animated */}
          <div className="absolute left-1/2 top-2 -translate-x-1/2 motion-safe:animate-claw-bob">
            <ClawIcon className="h-32 w-32 motion-safe:animate-glow" gripping />
          </div>
          {/* prize: a tiny Mac */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-white/30 bg-foreground/80 px-3 py-1 font-mono text-[8px] uppercase tracking-widest text-background">
            M3 · 64GB
          </div>
          {/* score */}
          <div className="absolute left-3 top-2 font-mono text-[9px] text-[rgb(var(--claw-amber-rgb))]">
            HI 88¢/hr
          </div>
          <div className="absolute right-3 top-2 font-mono text-[9px] text-[rgb(var(--claw-magenta-rgb))]">
            P1 ▮▮▮
          </div>
        </div>
        {/* control panel */}
        <div className="absolute inset-x-5 bottom-5 top-[calc(2/3*100%+24px)] rounded-2xl border border-white/10 bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(["bg-[rgb(var(--claw-magenta-rgb))]", "bg-[rgb(var(--claw-cyan-rgb))]", "bg-[rgb(var(--claw-amber-rgb))]"] as const).map((c, i) => (
                <span key={i} className={`h-3 w-3 rounded-full ${c} shadow-[0_0_8px_currentColor]`} />
              ))}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              cab.001
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className="h-2 rounded-sm bg-foreground/10"
                style={{ opacity: 0.3 + (i % 3) * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsMarquee() {
  const stats = [
    { v: "130", l: "median tok/s" },
    { v: "0.8s", l: "sandbox boot" },
    { v: "$1.80", l: "avg / hour" },
    { v: "88%", l: "to suppliers" },
    { v: "20-40%", l: "MLX over llama.cpp" },
    { v: "0", l: "inbound ports" },
  ];
  return (
    <div className="border-y border-border/40 bg-background/40 py-5">
      <div className="flex overflow-hidden">
        <div className="flex shrink-0 items-center gap-12 pr-12 motion-safe:animate-marquee">
          {[...stats, ...stats].map((s, i) => (
            <div key={i} className="flex items-baseline gap-3 whitespace-nowrap">
              <span className="font-heading text-2xl text-foreground">{s.v}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {s.l}
              </span>
              <span className="ml-6 h-1 w-1 rounded-full bg-[rgb(var(--claw-cyan-rgb))]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
