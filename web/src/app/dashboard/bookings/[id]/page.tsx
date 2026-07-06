import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ChatThread } from "@/components/dashboard/ChatThread";
import { KindChip } from "@/components/ledger/KindChip";
import { Badge } from "@/components/ui/badge";
import { ApiError, api } from "@/lib/api";
import type { BookingOut, BookingStatus, LedgerOut, MessageOut } from "@/lib/api-types";
import { safeGet } from "@/lib/safe-api";
import { EMPTY_LEDGER, formatDuration, formatUsdc, shortHash, txUrl } from "@/lib/usdc";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending:
    "bg-[rgb(var(--gold))]/10 text-accent-gold border-[rgb(var(--gold))]/35",
  active:
    "bg-[rgb(var(--settle))]/10 text-settle border-[rgb(var(--settle))]/35",
  completed: "bg-white/5 text-foreground border-white/15",
  cancelled:
    "bg-[rgb(var(--slate))]/10 text-[rgb(var(--slate))] border-[rgb(var(--slate))]/30",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let booking: BookingOut;
  let messages: { items: MessageOut[] };
  try {
    [booking, messages] = await Promise.all([
      api.get<BookingOut>(`/v1/bookings/${id}`),
      api.get<{ items: MessageOut[] }>(`/v1/bookings/${id}/messages`),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const ledger = await safeGet<LedgerOut>(
    `/v1/ledger?booking_id=${id}`,
    EMPTY_LEDGER,
    { fallbackOn4xx: true, label: "booking ledger" },
  );
  return (
    <div className="mx-auto flex h-[calc(100svh-5rem)] max-w-3xl flex-col">
      <header className="mb-6">
        <Link
          href="/dashboard/bookings"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All bookings
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Booking{" "}
              <span className="font-mono text-base text-muted-foreground">
                {booking.id.slice(0, 8)}…
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {booking.started_at
                ? `Started ${new Date(booking.started_at).toLocaleString()}`
                : "Not yet started"}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`font-normal capitalize ${STATUS_STYLES[booking.status]}`}
          >
            {booking.status}
          </Badge>
        </div>
      </header>
      {booking.status === "active" ? (
        <div className="flex-1 min-h-0">
          <ChatThread bookingId={booking.id} initialMessages={messages.items} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <p className="text-muted-foreground">
            Chat is available once the booking is active. The supplier accepts
            and provisions a sandbox; you&apos;ll see the conversation here as
            soon as it&apos;s ready.
          </p>
        </div>
      )}
      <section className="mt-6 shrink-0">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          settlement
        </p>
        {ledger.items.length > 0 ? (
          <div className="surface-card max-h-64 overflow-y-auto rounded-2xl border border-white/8">
            <ul className="divide-y divide-white/5">
              {ledger.items.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 text-sm"
                >
                  <KindChip kind={entry.kind} status={entry.status} />
                  <span
                    className={`tabular font-mono ${
                      entry.kind === "settle"
                        ? "text-settle"
                        : entry.kind === "open"
                          ? "text-accent-gold"
                          : "text-muted-foreground"
                    }`}
                  >
                    {formatUsdc(entry.amount_usdc)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDuration(entry.usage_seconds)}
                  </span>
                  {entry.tx_hash && (
                    <a
                      href={txUrl(ledger.chain.explorer_url, entry.tx_hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto font-mono text-xs text-muted-foreground underline decoration-white/15 underline-offset-4 transition hover:text-foreground"
                    >
                      {shortHash(entry.tx_hash)}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No on-chain settlement for this booking (off-chain rail).
          </p>
        )}
      </section>
    </div>
  );
}
