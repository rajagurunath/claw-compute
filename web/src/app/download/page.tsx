"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, Check, Cpu, Download, KeyRound, Terminal } from "lucide-react";

import { InstallSnippet } from "@/components/dashboard/InstallSnippet";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TARBALL = `${API_BASE}/releases/claw-worker-latest-aarch64-apple-darwin.tar.gz`;
const INSTALL = `curl -fsSL ${API_BASE}/install.sh | bash`;
const REGISTER = `claw-worker register --api-url ${API_BASE} --provisioning-token <TOKEN>
claw-worker run --api-url ${API_BASE}`;

type Compat = "checking" | "supported" | "unsupported";

const noopSubscribe = () => () => {};

function detectAppleSilicon(): Compat {
  if (typeof navigator === "undefined") return "checking";
  const ua = navigator.userAgent;
  const platform = navigator.platform ?? "";
  const isMac = /Mac/.test(platform) || /Macintosh/.test(ua);
  if (!isMac) return "unsupported";
  // Intel Macs report "Intel" in the UA/renderer; Apple Silicon typically does
  // not. Detection is best-effort and never gates the download.
  const looksIntel = /Intel/.test(ua) && !/OS X 10_1[5-9]/.test(ua);
  return looksIntel ? "unsupported" : "supported";
}

export default function DownloadPage() {
  // Client-only compatibility read; "checking" on the server keeps SSR stable.
  const compat = useSyncExternalStore(
    noopSubscribe,
    detectAppleSilicon,
    () => "checking" as Compat,
  );

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-20 md:py-28">
          <div className="mb-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Cpu className="h-3 w-3 text-accent-crimson" /> claw-worker · Apple Silicon
          </div>

          <h1 className="text-balance font-heading text-4xl tracking-tight md:text-6xl">
            <span className="headline-gradient">Download the worker.</span>
          </h1>
          <p className="mt-5 max-w-xl text-balance text-muted-foreground md:text-lg">
            Put an idle Mac to work in one command. The worker runs sandboxed
            agents locally, registers with a token from your dashboard, and pays
            out USDC for the hours it&apos;s hired.
          </p>

          {/* compatibility */}
          <div className="mt-8">
            <CompatBadge compat={compat} />
          </div>

          {/* one-liner */}
          <div className="mt-10 space-y-3">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Terminal className="h-3.5 w-3.5 text-accent-crimson" /> Install
            </div>
            <InstallSnippet snippet={INSTALL} />
          </div>

          {/* direct download */}
          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="group bg-[rgb(var(--crimson))] text-[rgb(var(--ivory))] shadow-[0_8px_24px_-8px_rgb(var(--crimson-glow)/0.6)] hover:brightness-110"
            >
              <a href={TARBALL} download>
                Download binary
                <Download className="ml-1 h-4 w-4 transition group-hover:translate-y-0.5" />
              </a>
            </Button>
            <span className="font-mono text-[11px] text-muted-foreground">
              claw-worker · aarch64-apple-darwin · .tar.gz
            </span>
          </div>

          {/* register + run */}
          <div className="mt-12 space-y-3">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5 text-accent-crimson" /> Register &amp; run
            </div>
            <InstallSnippet snippet={REGISTER} />
            <p className="rounded-lg border border-[rgb(var(--gold))]/25 bg-[rgb(var(--gold))]/10 px-4 py-3 text-xs text-accent-gold">
              Grab a provisioning token from your supplier dashboard first — it&apos;s
              shown once and discarded server-side after register succeeds.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline" className="border-white/15 hover:border-white/30 hover:bg-white/5">
              <Link href="/auth/login?next=/dashboard/become-supplier">
                Get a provisioning token
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="hover:bg-white/5">
              <Link href="/pricing">See what you&apos;ll earn</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function CompatBadge({ compat }: { compat: Compat }) {
  if (compat === "supported") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--settle))]/30 bg-[rgb(var(--settle))]/10 px-3.5 py-2 text-sm text-settle">
        <Check className="h-4 w-4" />
        Compatible — macOS on Apple Silicon detected.
      </div>
    );
  }
  if (compat === "unsupported") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-background/50 px-3.5 py-2 text-sm text-muted-foreground">
        <Cpu className="h-4 w-4" />
        claw-worker runs on Apple Silicon Macs only. You can still download it to
        move to a Mac.
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-background/50 px-3.5 py-2 text-sm text-muted-foreground">
      <Cpu className="h-4 w-4" />
      Checking compatibility…
    </div>
  );
}
