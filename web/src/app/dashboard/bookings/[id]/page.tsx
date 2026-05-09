import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ChatThread } from "@/components/dashboard/ChatThread";
import { Badge } from "@/components/ui/badge";
import { ApiError, api } from "@/lib/api";
import type { BookingOut, BookingStatus, MessageOut } from "@/lib/api-types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  active:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  completed:
    "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
  cancelled:
    "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
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
    </div>
  );
}
