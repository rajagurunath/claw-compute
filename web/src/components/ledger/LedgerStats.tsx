import type { LedgerStats as Stats } from "@/lib/api-types";
import { formatUsdc } from "@/lib/usdc";

export function LedgerStats({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile
        label="Settled to suppliers"
        value={formatUsdc(stats.settled_volume_usdc - stats.commission_usdc)}
        tone="settle"
        hint={`${stats.settlements} settlement${stats.settlements === 1 ? "" : "s"}`}
      />
      <Tile
        label="Locked in escrow"
        value={formatUsdc(stats.locked_volume_usdc)}
        tone="gold"
        hint={`${stats.open_bookings} open booking${stats.open_bookings === 1 ? "" : "s"}`}
      />
      <Tile
        label="Marketplace commission"
        value={formatUsdc(stats.commission_usdc)}
        hint="to treasury"
      />
      <Tile
        label="Total settled volume"
        value={formatUsdc(stats.settled_volume_usdc)}
        hint="all time"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "settle" | "gold";
}) {
  const color =
    tone === "settle"
      ? "text-settle"
      : tone === "gold"
        ? "text-accent-gold"
        : "text-foreground";
  return (
    <div className="surface-card rounded-2xl border border-white/8 px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`tabular mt-2 font-mono text-2xl ${color}`}>{value}</div>
      {hint && (
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
