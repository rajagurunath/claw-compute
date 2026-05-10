import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cpu, Shield, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* single warm vignette behind the hero — no rainbow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10"
      >
        <div className="mx-auto h-[40rem] w-[80rem] max-w-full rounded-full bg-[radial-gradient(closest-side,rgb(var(--crimson)/0.16),transparent)]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-20 pb-24 md:grid-cols-[1.15fr_1fr] md:pt-28 md:pb-32">
        {/* LEFT — copy */}
        <div className="relative z-10 flex flex-col">
          <div className="mb-6 flex items-center gap-2 self-start rounded-full border border-[rgb(var(--crimson))/0.3] bg-[rgb(var(--crimson))/0.08] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-crimson">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[rgb(var(--crimson))] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--crimson))]" />
            </span>
            Now in private beta · v0.1
          </div>

          <h1 className="text-balance font-heading text-5xl leading-[1.02] tracking-tight md:text-7xl">
            <span className="headline-gradient">A peer-to-peer arcade for</span>
            <br />
            <span className="accent-underline text-[rgb(var(--ivory))]">idle Apple Silicon</span>.
          </h1>

          <p className="mt-7 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
            Hire sandboxed AI agents on a real Mac, by the hour. Owners run
            one binary and start earning from compute that would otherwise sit
            idle. Open core. MLX-native. Outbound only.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group min-w-48 bg-[rgb(var(--crimson))] text-[rgb(var(--ivory))] shadow-[0_8px_24px_-8px_rgb(var(--crimson-glow)/0.6)] hover:bg-[rgb(var(--crimson))] hover:brightness-110"
            >
              <Link href="/browse">
                Browse machines
                <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-w-48 border-white/15 hover:border-[rgb(var(--gold))]/60 hover:bg-white/5"
            >
              <Link href="/auth/login?next=/dashboard/become-supplier">
                List your Mac
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid max-w-md grid-cols-3 gap-x-6 border-t border-white/5 pt-6 font-mono text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Cpu className="h-3 w-3 text-[rgb(var(--gold))]" /> MLX-native</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="h-3 w-3 text-[rgb(var(--gold))]" /> 0.8s sandbox</span>
            <span className="inline-flex items-center gap-1.5"><Shield className="h-3 w-3 text-[rgb(var(--gold))]" /> 0 inbound</span>
          </div>
        </div>

        {/* RIGHT — refined "console" with the openclaw centerpiece */}
        <Console />
      </div>

      <StatsStrip />
    </section>
  );
}

function Console() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      {/* outer halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(closest-side,rgb(var(--crimson)/0.18),transparent)] blur-2xl"
      />
      {/* console frame */}
      <div className="surface-card absolute inset-0 rounded-[24px] border border-white/8 p-5">
        {/* status bar */}
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>claw // console</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(74_222_128/0.7)]" />
            healthy
          </span>
        </div>

        {/* claw stage */}
        <div className="relative mt-4 grid h-[68%] place-items-center overflow-hidden rounded-2xl border border-white/5 bg-[radial-gradient(ellipse_at_top,rgb(var(--crimson)/0.08),transparent_60%)]">
          <div className="absolute inset-0 bg-grid-fine opacity-60" />
          {/* spotlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--gold)/0.30),transparent)] blur-xl"
          />
          {/* the claw */}
          <div className="relative z-10 motion-safe:animate-claw-bob">
            <Image
              src="/openclaw.svg"
              alt=""
              aria-hidden
              width={220}
              height={220}
              priority
              className="h-44 w-44 drop-shadow-[0_8px_30px_rgb(var(--crimson-glow)/0.45)] motion-safe:animate-glow-soft"
            />
          </div>
          {/* "prize" beneath */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-white/15 bg-[rgb(var(--ivory)/0.06)] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/80 backdrop-blur">
            M3 Max · 64 GB · 130 tok/s
          </div>
        </div>

        {/* metrics row */}
        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px]">
          <Metric label="bookings 24h" value="1,248" />
          <Metric label="util" value="72%" tone="gold" />
          <Metric label="payout / mo" value="$430" tone="crimson" />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold" | "crimson";
}) {
  const color =
    tone === "gold" ? "text-[rgb(var(--gold))]" :
    tone === "crimson" ? "text-accent-crimson" :
    "text-foreground";
  return (
    <div className="rounded-lg border border-white/8 bg-background/50 px-3 py-2">
      <div className={`font-heading text-base ${color}`} style={{ letterSpacing: "-0.02em" }}>{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    </div>
  );
}

function StatsStrip() {
  const stats = [
    { v: "130", l: "median tok/s · M3 Max" },
    { v: "0.8s", l: "sandbox cold-start" },
    { v: "$1.80", l: "average per hour" },
    { v: "88%", l: "to suppliers" },
    { v: "20–40%", l: "MLX vs llama.cpp" },
    { v: "0", l: "inbound ports needed" },
  ];
  return (
    <div className="border-y border-white/5 bg-background/40 py-6">
      <div className="flex overflow-hidden">
        <div className="flex shrink-0 items-center gap-14 pr-14 motion-safe:animate-marquee">
          {[...stats, ...stats].map((s, i) => (
            <div key={i} className="flex items-baseline gap-3 whitespace-nowrap">
              <span className="font-heading text-2xl text-foreground">{s.v}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {s.l}
              </span>
              <span className="ml-8 inline-block h-1 w-1 rotate-45 bg-[rgb(var(--crimson))]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
