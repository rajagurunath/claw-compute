import type { Metadata } from "next";
import { Lock, Timer, Coins } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ChainCard } from "@/components/ledger/ChainCard";
import { LedgerStats } from "@/components/ledger/LedgerStats";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import type { LedgerOut } from "@/lib/api-types";
import { safeGet } from "@/lib/safe-api";
import { EMPTY_LEDGER } from "@/lib/usdc";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settlement ledger — Claw",
  description:
    "Every booking on Claw locks USDC in escrow and settles on-chain. The full record — usage, payouts, commission — is public.",
};

export default async function LedgerPage() {
  const ledger = await safeGet<LedgerOut>("/v1/ledger?limit=100", EMPTY_LEDGER, {
    label: "ledger",
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14">
        <div className="mb-10 max-w-2xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent-crimson">
            Public record
          </div>
          <h1 className="mt-3 font-heading text-4xl tracking-tight md:text-5xl">
            Every hour, on the record.
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            When a booking starts, the consumer&apos;s USDC is locked in the
            ClawEscrow contract. When it ends, the machine&apos;s actual usage is
            settled on-chain — supplier payout, marketplace commission, and
            every transaction hash below. No invoices to trust; a ledger to
            check.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <LedgerStats stats={ledger.stats} />
          <ChainCard chain={ledger.chain} />
        </div>

        <div className="mt-8">
          {ledger.items.length > 0 ? (
            <LedgerTable entries={ledger.items} chain={ledger.chain} />
          ) : (
            <EmptyLedger />
          )}
        </div>

        {ledger.total > ledger.items.length && (
          <p className="mt-4 text-center font-mono text-[11px] text-muted-foreground">
            showing {ledger.items.length} of {ledger.total} settlements
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function EmptyLedger() {
  return (
    <div className="surface-card rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        No settlements yet
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        The first booking to run on the USDC rail will appear here — lock,
        usage, and payout.
      </p>
      <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        <Step
          icon={<Lock className="h-4 w-4 text-accent-gold" />}
          title="Lock"
          body="Booking goes active — the worst-case cost is reserved from the consumer's escrow."
        />
        <Step
          icon={<Timer className="h-4 w-4 text-foreground" />}
          title="Use"
          body="The Mac runs the agent. Usage is metered off started/ended timestamps."
        />
        <Step
          icon={<Coins className="h-4 w-4 text-settle" />}
          title="Settle"
          body="Actual usage is charged, the split pays out, the rest unlocks instantly."
        />
      </div>
    </div>
  );
}

function Step({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-background/40 px-4 py-3.5">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-foreground">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
