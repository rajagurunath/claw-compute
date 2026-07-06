"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Coins, Copy, Power, Terminal, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";

const INSTALL = "curl -fsSL https://api.claw.dev/install.sh | bash";

export function SupplierCTA() {
  const [copied, setCopied] = useState(false);
  return (
    <section className="relative isolate overflow-hidden border-y border-white/5 bg-card/30">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-1/2 h-72 w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--crimson))/0.18] blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-6 py-28 text-center">
        <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <Terminal className="h-3 w-3 text-accent-crimson" /> One command
        </div>

        <h2 className="text-balance font-heading text-4xl tracking-tight md:text-6xl">
          <span className="headline-gradient">Got an idle Mac?</span>
          <br />
          Put the <span className="accent-underline text-[rgb(var(--ivory))]">claw to work</span>.
        </h2>

        <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground md:text-lg">
          Run one curl, set your hourly rate, get paid when consumers hire your
          machine. Pause any time. Earn USDC straight to your payout wallet —
          85% of every hour, settled on-chain.
        </p>

        {/* command box */}
        <div className="group relative mx-auto mt-10 max-w-2xl">
          <div
            aria-hidden
            className="absolute -inset-px rounded-xl bg-gradient-to-r from-[rgb(var(--crimson))]/0 via-[rgb(var(--crimson))]/35 to-[rgb(var(--crimson))]/0 opacity-70 blur"
          />
          <pre className="relative overflow-x-auto rounded-xl border border-white/10 bg-background/95 p-5 pr-16 text-left font-mono text-sm shadow-2xl">
            <span className="mr-2 select-none text-accent-crimson">$</span>
            <code>{INSTALL}</code>
          </pre>
          <button
            type="button"
            aria-label="Copy install command"
            onClick={async () => {
              await navigator.clipboard.writeText(INSTALL);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-background p-2 text-muted-foreground transition hover:border-[rgb(var(--crimson))]/60 hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-accent-crimson" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-3 text-left md:grid-cols-3">
          <Stat icon={<Coins className="h-4 w-4" />} title="$1.80 / hr" sub="avg M3 Max billing" />
          <Stat icon={<TrendingUp className="h-4 w-4" />} title="$430 / mo" sub="@ 60% utilization" />
          <Stat icon={<Power className="h-4 w-4" />} title="85% kept" sub="flat 15% to platform" />
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="min-w-44 bg-[rgb(var(--crimson))] text-[rgb(var(--ivory))] shadow-[0_8px_24px_-8px_rgb(var(--crimson-glow)/0.6)] hover:brightness-110"
          >
            <Link href="/auth/login?next=/dashboard/become-supplier">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="min-w-44 hover:bg-white/5">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>

        {/* mascot — claw at the bottom */}
        <div className="mx-auto mt-12 flex w-fit items-center gap-3 rounded-full border border-white/10 bg-background/40 py-2 pl-2 pr-4 backdrop-blur">
          <Image
            src="/openclaw.svg"
            alt=""
            aria-hidden
            width={32}
            height={32}
            className="h-8 w-8 motion-safe:animate-claw-bob"
          />
          <span className="font-mono text-xs text-muted-foreground">
            <span className="text-accent-crimson">claw // </span>
            ready when you are
          </span>
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-background/40 p-4">
      <div className="grid h-9 w-9 place-items-center rounded-md border border-[rgb(var(--settle))]/30 bg-[rgb(var(--settle))]/10 text-settle">
        {icon}
      </div>
      <div>
        <div className="font-heading text-lg leading-none">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
