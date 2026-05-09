"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";

const INSTALL = "curl -fsSL https://api.claw.dev/install.sh | bash";

export function SupplierCTA() {
  const [copied, setCopied] = useState(false);
  return (
    <section className="relative isolate overflow-hidden border-y border-border/40 bg-muted/20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(closest-side,white,transparent)]"
      >
        <div className="absolute left-1/2 top-1/2 h-72 w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/20 blur-3xl" />
      </div>
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" /> One command
        </div>
        <h2 className="mb-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Got an idle Mac Studio?
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-balance text-muted-foreground md:text-lg">
          Run one curl, set your hourly rate, get paid when consumers hire your
          machine. Pause any time.
        </p>
        <div className="group relative mx-auto max-w-2xl">
          <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/90 p-5 pr-16 text-left font-mono text-sm shadow-sm">
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
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-background p-2 text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-w-44">
            <Link href="/auth/login?next=/dashboard/become-supplier">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="min-w-44">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
