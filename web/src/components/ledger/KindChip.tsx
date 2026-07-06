import type { SettlementKind, SettlementStatus } from "@/lib/api-types";

const KIND_LABEL: Record<SettlementKind, string> = {
  open: "escrow lock",
  settle: "settled",
  cancel: "cancelled",
};

/** Money-state chip: amber = funds locked, green = paid out, slate = released. */
export function KindChip({
  kind,
  status,
}: {
  kind: SettlementKind;
  status: SettlementStatus;
}) {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--crimson))]/40 bg-[rgb(var(--crimson))]/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-crimson">
        <Dot className="bg-[rgb(var(--crimson))]" />
        {KIND_LABEL[kind]} failed
      </span>
    );
  }
  if (kind === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--gold))]/35 bg-[rgb(var(--gold))]/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-gold">
        <Dot className="bg-[rgb(var(--gold))]" />
        escrow lock
      </span>
    );
  }
  if (kind === "settle") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--settle))]/35 bg-[rgb(var(--settle))]/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-settle">
        <Dot className="bg-[rgb(var(--settle))]" />
        settled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      <Dot className="bg-[rgb(var(--slate))]" />
      cancelled
    </span>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${className}`} />;
}
