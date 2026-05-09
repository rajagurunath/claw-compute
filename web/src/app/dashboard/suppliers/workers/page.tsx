import Link from "next/link";
import { Plus } from "lucide-react";

import { WorkerStatusBadge } from "@/components/dashboard/WorkerStatusBadge";
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
import type { WorkerOut } from "@/lib/api-types";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  let items: WorkerOut[] = [];
  let suppliedYet = true;
  try {
    const data = await api.get<{ items: WorkerOut[] }>("/v1/suppliers/me/workers");
    items = data.items;
  } catch (e) {
    // Not yet a supplier — friendly empty state with link.
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
      suppliedYet = false;
    } else {
      throw e;
    }
  }
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Supplier
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Workers</h1>
        </div>
        {suppliedYet && (
          <Button asChild>
            <Link href="/dashboard/suppliers/workers/new">
              <Plus className="h-4 w-4" />
              Add worker
            </Link>
          </Button>
        )}
      </header>

      {!suppliedYet ? (
        <EmptyState />
      ) : items.length === 0 ? (
        <EmptyTable />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Chip</TableHead>
                <TableHead>RAM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => {
                const info = w.machine_info as {
                  chip?: string;
                  total_ram_gb?: number;
                };
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>
                      <WorkerStatusBadge status={w.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {w.last_seen_at
                        ? new Date(w.last_seen_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {info.chip ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {info.total_ram_gb
                        ? `${Math.round(info.total_ram_gb)} GB`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
      <h2 className="mb-2 text-lg font-semibold tracking-tight">
        Become a supplier first
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Set your display name and payout email, then add your first worker.
      </p>
      <Button asChild>
        <Link href="/dashboard/become-supplier">Become a supplier</Link>
      </Button>
    </div>
  );
}

function EmptyTable() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
      <h2 className="mb-2 text-lg font-semibold tracking-tight">
        No workers yet
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Add a worker to get a one-time install command for your Mac.
      </p>
      <Button asChild>
        <Link href="/dashboard/suppliers/workers/new">
          <Plus className="h-4 w-4" />
          Add your first worker
        </Link>
      </Button>
    </div>
  );
}
