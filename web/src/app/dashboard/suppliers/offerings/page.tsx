import Link from "next/link";
import { Plus } from "lucide-react";

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
import { ApiError, api } from "@/lib/api";
import type { OfferingList } from "@/lib/api-types";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-[rgb(var(--gold))]/10 text-accent-gold border-[rgb(var(--gold))]/35",
  active: "bg-[rgb(var(--settle))]/10 text-settle border-[rgb(var(--settle))]/35",
  archived: "bg-[rgb(var(--slate))]/10 text-[rgb(var(--slate))] border-[rgb(var(--slate))]/30",
};

export default async function OfferingsPage() {
  let items: OfferingList["items"] = [];
  try {
    const data = await api.get<OfferingList>("/v1/offerings");
    items = data.items;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Supplier
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Offerings
          </h1>
        </div>
        <Button asChild>
          <Link href="/dashboard/suppliers/offerings/new">
            <Plus className="h-4 w-4" />
            New offering
          </Link>
        </Button>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <h2 className="mb-2 text-lg font-semibold tracking-tight">
            No offerings yet
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            List a sandbox + inference capability and set your hourly rate. You
            can edit or archive any offering later.
          </p>
          <Button asChild>
            <Link href="/dashboard/suppliers/offerings/new">
              <Plus className="h-4 w-4" />
              Create your first offering
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Price/hr</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell>
                    ${(o.price_per_hour_cents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {o.capability_tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="font-normal">
                          {t}
                        </Badge>
                      ))}
                      {o.capability_tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{o.capability_tags.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-normal capitalize ${STATUS_COLOR[o.status] ?? ""}`}
                    >
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/dashboard/suppliers/offerings/${o.id}/edit`}
                      >
                        Edit
                      </Link>
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
