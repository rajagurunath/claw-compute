import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COMMISSION_PERCENT, PRICING_FAQ, PRICING_TIERS, type PricingTier } from "@/lib/pricing";

export const metadata = {
  title: "Pricing — Claw Marketplace",
  description: `Pay-per-hour for consumers. ${100 - COMMISSION_PERCENT}% to suppliers. Marketplace takes ${COMMISSION_PERCENT}%.`,
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Tiers />
        <FAQ />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 -z-10 transform-gpu blur-3xl"
      >
        <div className="relative left-1/2 aspect-square h-72 -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-400/20 to-violet-500/20" />
      </div>
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-12 text-center md:pt-28">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Pricing
        </p>
        <h1 className="text-balance bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-6xl">
          Simple. Transparent. {100 - COMMISSION_PERCENT}/{COMMISSION_PERCENT}.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground md:text-lg">
          Suppliers keep {100 - COMMISSION_PERCENT}% of every dollar. The
          marketplace takes a flat {COMMISSION_PERCENT}% to cover Stripe fees,
          attestation infra, and ops. No tiers, no upsells, no monthly
          subscription.
        </p>
      </div>
    </section>
  );
}

function Tiers() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="grid gap-6 lg:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <TierCard key={tier.id} tier={tier} />
        ))}
      </div>
    </section>
  );
}

function TierCard({ tier }: { tier: PricingTier }) {
  const isHighlight = tier.variant === "highlight";
  const isMuted = tier.variant === "muted";
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6",
        isHighlight && "border-foreground/30 shadow-lg",
        !isHighlight && "border-border/60",
        isMuted && "opacity-95",
      )}
    >
      {isHighlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-px h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"
        />
      )}
      {tier.badge && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-background">
          <Sparkles className="h-3 w-3" /> {tier.badge}
        </span>
      )}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {tier.tagline}
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">{tier.name}</h3>
      </div>
      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight">{tier.headline}</span>
        </div>
        {tier.highlight && (
          <p className="mt-1 text-sm text-muted-foreground">{tier.highlight}</p>
        )}
      </div>
      <ul className="mt-6 flex-1 space-y-3 text-sm">
        {tier.features.map((feat) => (
          <li key={feat} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
            <span className={cn(isMuted && "text-muted-foreground")}>{feat}</span>
          </li>
        ))}
      </ul>
      <Button
        asChild
        size="lg"
        variant={isHighlight ? "default" : isMuted ? "outline" : "default"}
        className="mt-8 w-full"
      >
        <Link href={tier.cta.href}>{tier.cta.label}</Link>
      </Button>
    </div>
  );
}

function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <h2 className="mb-10 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        Common questions
      </h2>
      <dl className="space-y-8">
        {PRICING_FAQ.map(({ q, a }) => (
          <div key={q}>
            <dt className="mb-2 text-base font-semibold tracking-tight">{q}</dt>
            <dd className="text-sm leading-relaxed text-muted-foreground">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
