import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cpu } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import type { OfferingOut, Workload } from "@/lib/api-types";
import { findSeedOffering } from "@/lib/seed";

const WORKLOAD_LABEL: Record<Workload, string> = {
  openclaw: "OpenClaw",
  sandbox: "Sandbox",
  inference: "Inference",
  hermes: "Hermes",
};

export const dynamic = "force-dynamic";

export default async function OfferingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let offering: OfferingOut | undefined;
  try {
    offering = await api.get<OfferingOut>(`/v1/offerings/${id}`, { auth: false });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      // Real API said no — try seed data (in case this is a seed deep-link).
      offering = findSeedOffering(id);
      if (!offering) notFound();
    } else if (e instanceof ApiError) {
      throw e;
    } else {
      // Network error / no API configured: fall back to seed data only.
      console.warn(`[offerings/${id}] API unreachable — using seed fallback`);
      offering = findSeedOffering(id);
      if (!offering) notFound();
    }
  }
  const usdHr = (offering.price_per_hour_cents / 100).toFixed(2);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <Link
          href="/browse"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to browse
        </Link>
        <div className="mb-2 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            Apple Silicon
          </span>
          <span className="rounded-full border border-foreground/15 bg-foreground/[0.04] px-2 py-0.5 font-mono tracking-[0.12em] text-foreground/70">
            {WORKLOAD_LABEL[offering.workload]} agent
          </span>
        </div>
        <h1 className="mb-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {offering.title}
        </h1>
        <div className="mb-6 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight">${usdHr}</span>
          <span className="text-sm uppercase tracking-wider text-muted-foreground">
            / hour
          </span>
        </div>
        {offering.capability_tags.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-1">
            {offering.capability_tags.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
          </div>
        )}
        <div className="prose prose-sm dark:prose-invert mb-12 max-w-none">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
            {offering.description || "No description provided."}
          </p>
        </div>
        <div className="mb-6 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          Starting this agent opens a booking and locks the first hour of USDC
          in escrow on <span className="text-foreground">Arc</span>. You&rsquo;re
          only charged for the seconds you actually use — the rest is released
          when you end the session, and every settlement is public on the{" "}
          <Link href="/ledger" className="text-foreground underline underline-offset-2">
            ledger
          </Link>
          .
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={`/auth/login?next=/offerings/${offering.id}`}>
              Sign in to start agent
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/browse">Keep browsing</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
