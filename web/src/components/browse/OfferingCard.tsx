import Link from "next/link";
import { ArrowUpRight, Cpu } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { OfferingOut } from "@/lib/api-types";

export function OfferingCard({ offering }: { offering: OfferingOut }) {
  const usdHr = (offering.price_per_hour_cents / 100).toFixed(2);
  return (
    <Link
      href={`/offerings/${offering.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition hover:border-foreground/20 hover:shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" />
          Apple Silicon
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
      </div>
      <h3 className="line-clamp-2 text-lg font-semibold tracking-tight">
        {offering.title}
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {offering.description || "—"}
      </p>
      <div className="mt-4 flex flex-wrap gap-1">
        {offering.capability_tags.slice(0, 4).map((t) => (
          <Badge key={t} variant="secondary" className="font-normal">
            {t}
          </Badge>
        ))}
      </div>
      <div className="mt-5 flex items-baseline justify-between border-t border-border/60 pt-4">
        <span className="text-2xl font-semibold tracking-tight">${usdHr}</span>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          / hour
        </span>
      </div>
    </Link>
  );
}
