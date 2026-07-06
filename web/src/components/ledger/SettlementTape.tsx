import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { LedgerOut } from "@/lib/api-types";
import { formatDuration, formatUsdc } from "@/lib/usdc";

/** The signature strip: real on-chain settlements scrolling across the page.
    Falls back to the rail facts until the first settlement lands. */
export function SettlementTape({ ledger }: { ledger: LedgerOut }) {
  const settled = ledger.items.filter(
    (e) => e.status === "confirmed" && e.kind !== "open" && e.amount_usdc,
  );

  return (
    <div className="border-y border-white/5 bg-background/40">
      <div className="mx-auto flex max-w-6xl items-stretch">
        <Link
          href="/ledger"
          className="group flex shrink-0 items-center gap-2 border-r border-white/5 py-4 pl-6 pr-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--settle))]" />
          settlement ledger
          <ArrowUpRight className="h-3 w-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center overflow-hidden pl-8">
          {settled.length > 0 ? (
            <TapeRow entries={[...settled, ...settled]} />
          ) : (
            <FactsRow />
          )}
        </div>
      </div>
    </div>
  );
}

function TapeRow({ entries }: { entries: LedgerOut["items"] }) {
  return (
    <div className="flex shrink-0 items-center gap-12 pr-12 motion-safe:animate-tape">
      {entries.map((e, i) => (
        <span
          key={`${e.id}-${i}`}
          className="flex items-baseline gap-2.5 whitespace-nowrap font-mono text-xs"
        >
          <span className="tabular text-settle">{formatUsdc(e.amount_usdc)}</span>
          <span className="text-muted-foreground">
            {e.offering_title ?? "booking"} · {formatDuration(e.usage_seconds)}
          </span>
          <span className="ml-6 inline-block h-1 w-1 rotate-45 bg-[rgb(var(--settle))]/60" />
        </span>
      ))}
    </div>
  );
}

function FactsRow() {
  const facts = [
    "USDC escrow locked at booking start",
    "settled for actual usage, on-chain",
    "85% to suppliers · 15% commission",
    "withdraw unused escrow anytime",
    "public record — every tx linked",
  ];
  return (
    <div className="flex shrink-0 items-center gap-12 pr-12 motion-safe:animate-tape">
      {[...facts, ...facts].map((f, i) => (
        <span
          key={i}
          className="flex items-baseline gap-2.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground"
        >
          {f}
          <span className="ml-6 inline-block h-1 w-1 rotate-45 bg-[rgb(var(--crimson))]/60" />
        </span>
      ))}
    </div>
  );
}
