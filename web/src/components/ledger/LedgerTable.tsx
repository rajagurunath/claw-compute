import { ArrowUpRight } from "lucide-react";

import { KindChip } from "@/components/ledger/KindChip";
import type { ChainInfo, LedgerEntry } from "@/lib/api-types";
import { formatDuration, formatUsdc, shortHash, txUrl } from "@/lib/usdc";

export function LedgerTable({
  entries,
  chain,
}: {
  entries: LedgerEntry[];
  chain: ChainInfo;
}) {
  return (
    <div className="surface-card overflow-hidden rounded-2xl border border-white/8">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-white/8 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Th className="pl-5">Time</Th>
              <Th>Event</Th>
              <Th>Booking</Th>
              <Th className="text-right">Usage</Th>
              <Th className="text-right">Amount</Th>
              <Th>Split</Th>
              <Th className="pr-5 text-right">Tx</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <Row key={e.id} entry={e} explorer={chain.explorer_url} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ entry: e, explorer }: { entry: LedgerEntry; explorer: string }) {
  const failed = e.status === "failed";
  return (
    <tr
      className={`border-b border-white/5 transition last:border-b-0 hover:bg-white/[0.025] ${
        failed ? "bg-[rgb(var(--crimson))]/[0.04]" : ""
      }`}
    >
      <td className="py-3.5 pl-5 pr-3 align-top">
        <time
          dateTime={e.created_at}
          className="tabular font-mono text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          {new Date(e.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </td>
      <td className="py-3.5 pr-3 align-top">
        <KindChip kind={e.kind} status={e.status} />
        {failed && e.error && (
          <p className="mt-1.5 max-w-56 truncate font-mono text-[10px] text-muted-foreground" title={e.error}>
            {e.error}
          </p>
        )}
      </td>
      <td className="py-3.5 pr-3 align-top">
        <div className="text-foreground">{e.offering_title ?? "—"}</div>
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {e.supplier_name ?? "unknown supplier"}
          {e.rate_per_hour_cents != null && (
            <span className="tabular"> · ${(e.rate_per_hour_cents / 100).toFixed(2)}/hr</span>
          )}
        </div>
      </td>
      <td className="tabular py-3.5 pr-3 text-right align-top font-mono text-xs text-muted-foreground">
        {e.kind === "open" ? "—" : formatDuration(e.usage_seconds)}
      </td>
      <td className="py-3.5 pr-3 text-right align-top">
        <span
          className={`tabular font-mono text-sm ${
            failed
              ? "text-muted-foreground line-through"
              : e.kind === "open"
                ? "text-accent-gold"
                : "text-settle"
          }`}
        >
          {formatUsdc(e.amount_usdc)}
        </span>
        {e.kind === "open" && !failed && (
          <div className="font-mono text-[10px] text-muted-foreground">locked</div>
        )}
      </td>
      <td className="py-3.5 pr-3 align-top">
        <SplitBar entry={e} />
      </td>
      <td className="py-3.5 pl-3 pr-5 text-right align-top">
        {e.tx_hash ? (
          <a
            href={txUrl(explorer, e.tx_hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition hover:text-foreground"
          >
            {shortHash(e.tx_hash)}
            <ArrowUpRight className="h-3 w-3" />
          </a>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

/** Supplier share vs marketplace commission, as one thin bar. */
function SplitBar({ entry: e }: { entry: LedgerEntry }) {
  if (
    e.kind === "open" ||
    e.status === "failed" ||
    e.amount_usdc == null ||
    e.amount_usdc === 0 ||
    e.commission_usdc == null
  ) {
    return <span className="font-mono text-[10px] text-muted-foreground">—</span>;
  }
  const supplierShare = e.amount_usdc - e.commission_usdc;
  const supplierPct = (supplierShare / e.amount_usdc) * 100;
  return (
    <div className="w-28">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="bg-[rgb(var(--settle))]"
          style={{ width: `${supplierPct}%` }}
        />
        <div className="flex-1 bg-[rgb(var(--slate))]/70" />
      </div>
      <div className="tabular mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{formatUsdc(supplierShare)}</span>
        <span title="marketplace commission">{formatUsdc(e.commission_usdc)}</span>
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`py-3 pr-3 text-left font-medium ${className}`}>{children}</th>
  );
}
