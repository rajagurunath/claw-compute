"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Coins, Power, Terminal, TrendingUp } from "lucide-react";

import { ClawIcon } from "@/components/claw/ClawIcon";
import { Button } from "@/components/ui/button";

const INSTALL = "curl -fsSL https://api.claw.dev/install.sh | bash";

export function SupplierCTA() {
  const [copied, setCopied] = useState(false);
  return (
    <section className="relative isolate overflow-hidden border-y border-border/40 bg-card/30">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-lines opacity-30" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(closest-side,white,transparent)]"
      >
        <div className="absolute left-1/2 top-1/2 h-72 w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--claw-amber-rgb)/0.25)] blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-6 py-24 text-center">
        <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-[rgb(var(--claw-amber-rgb)/0.4)] bg-[rgb(var(--claw-amber-rgb)/0.08)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[rgb(var(--claw-amber-rgb))]">
          <Terminal className="h-3 w-3" /> one.command
        </div>
        <h2 className="mb-4 text-balance font-heading text-4xl tracking-tight md:text-6xl">
          Got an idle Mac? <br className="md:hidden" /> <span className="text-neon-amber">Get the claw to work.</span>
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-balance text-muted-foreground md:text-lg">
          Run one curl, set your hourly rate, get paid when consumers grab the
          arm. Pause any time. Earnings settle weekly.
        </p>

        {/* command box */}
        <div className="group relative mx-auto max-w-2xl">
          <div aria-hidden className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[rgb(var(--claw-cyan-rgb)/0.4)] via-[rgb(var(--claw-magenta-rgb)/0.4)] to-[rgb(var(--claw-amber-rgb)/0.4)] opacity-50 blur-md transition group-hover:opacity-80" />
          <pre className="relative overflow-x-auto rounded-2xl border border-white/10 bg-background/95 p-5 pr-16 text-left font-mono text-sm shadow-xl bevel">
            <span className="mr-2 select-none text-[rgb(var(--claw-cyan-rgb))]">$</span>
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
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-background p-2 text-muted-foreground transition hover:border-[rgb(var(--claw-cyan-rgb)/0.6)] hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-[rgb(var(--claw-cyan-rgb))]" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        {/* tiny earnings calc */}
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-3 text-left md:grid-cols-3">
          <SupplierStat icon={<Coins className="h-4 w-4" />} title="$1.80 / hr" sub="avg M3 Max billing" />
          <SupplierStat icon={<TrendingUp className="h-4 w-4" />} title="$430 / mo" sub="@ 60% utilization" />
          <SupplierStat icon={<Power className="h-4 w-4" />} title="88% kept" sub="flat 12% to platform" />
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="min-w-44 bg-[rgb(var(--claw-amber-rgb))] text-background shadow-[0_0_30px_rgb(var(--claw-amber-rgb)/0.5)] hover:brightness-110"
          >
            <Link href="/auth/login?next=/dashboard/become-supplier">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="min-w-44 hover:bg-white/5">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>

        {/* mascot peeking */}
        <div className="mx-auto mt-12 flex w-fit items-center gap-3 rounded-full border border-white/10 bg-background/40 py-2 pl-2 pr-4 backdrop-blur">
          <ClawIcon variant="amber" className="h-8 w-8 motion-safe:animate-claw-bob" gripping />
          <span className="font-mono text-xs text-muted-foreground">
            <span className="text-[rgb(var(--claw-amber-rgb))]">claw://</span>
            ready_when_you_are
          </span>
        </div>
      </div>
    </section>
  );
}

function SupplierStat({
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
      <div className="grid h-9 w-9 place-items-center rounded-lg border border-[rgb(var(--claw-amber-rgb)/0.4)] bg-[rgb(var(--claw-amber-rgb)/0.1)] text-[rgb(var(--claw-amber-rgb))]">
        {icon}
      </div>
      <div>
        <div className="font-heading text-lg leading-none">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
