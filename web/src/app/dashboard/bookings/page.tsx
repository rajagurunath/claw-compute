import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { BookingOut, BookingStatus } from "@/lib/api-types";

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

export default async function BookingsPage() {
  const data = await api.get<{ items: BookingOut[] }>("/v1/bookings/me");
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Consumer
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            My bookings
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/browse">
            Browse offerings
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </header>

      {data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <h2 className="mb-2 text-lg font-semibold tracking-tight">
            No bookings yet
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Find an idle Mac and hire it by the hour. Sandboxed agent, ready in
            seconds.
          </p>
          <Button asChild>
            <Link href="/browse">Browse offerings</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    {b.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-normal capitalize ${STATUS_STYLES[b.status]}`}
                    >
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.started_at
                      ? new Date(b.started_at).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.ended_at ? new Date(b.ended_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/dashboard/bookings/${b.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
