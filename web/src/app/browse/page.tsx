import { OfferingCard } from "@/components/browse/OfferingCard";
import { OfferingFilters } from "@/components/browse/OfferingFilters";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { OfferingList } from "@/lib/api-types";
import { safeGet } from "@/lib/safe-api";
import { SEED_OFFERING_LIST, SEED_OFFERINGS } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ capability?: string }>;
}) {
  const { capability } = await searchParams;
  const qs = new URLSearchParams();
  if (capability) qs.set("capability", capability);
  // Filter the seed list by capability when API is unreachable so the demo
  // still feels like a real filter.
  const seedFiltered = capability
    ? {
        items: SEED_OFFERINGS.filter((o) => o.capability_tags.includes(capability)),
        total: SEED_OFFERINGS.filter((o) => o.capability_tags.includes(capability)).length,
      }
    : SEED_OFFERING_LIST;
  const data = await safeGet<OfferingList>(
    `/v1/offerings?${qs.toString()}`,
    seedFiltered,
    { label: "browse" },
  );
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Marketplace
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Browse offerings
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Hire idle Apple Silicon. Filter by capability tag, pick a price you
            like, sign in to book.
          </p>
        </header>
        <div className="mb-8">
          <OfferingFilters />
        </div>
        {data.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
            <p className="text-muted-foreground">
              {capability
                ? `No offerings match "${capability}" yet.`
                : "No offerings yet — be the first supplier."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((o) => (
              <OfferingCard key={o.id} offering={o} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
