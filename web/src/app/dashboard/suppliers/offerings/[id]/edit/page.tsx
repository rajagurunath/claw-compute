import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import type { OfferingOut } from "@/lib/api-types";

import { archiveOffering, updateOffering } from "../../actions";
import { OfferingForm } from "../../new/OfferingForm";

export const dynamic = "force-dynamic";

export default async function EditOfferingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let offering: OfferingOut;
  try {
    offering = await api.get<OfferingOut>(`/v1/offerings/${id}`, { auth: false });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const updateBound = updateOffering.bind(null, id);
  const archiveBound = archiveOffering.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Edit offering
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight md:text-4xl">
        {offering.title}
      </h1>
      <p className="mb-8 text-muted-foreground">
        Edits go live immediately for new bookings. Existing bookings keep
        their original price.
      </p>
      <OfferingForm
        action={updateBound}
        initial={offering}
        submitLabel="Save changes"
      />
      <div className="mt-12 border-t border-border/60 pt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Danger zone
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Archiving removes this offering from browse. Existing bookings on it
          keep running.
        </p>
        <form action={archiveBound}>
          <Button type="submit" variant="destructive">
            Archive offering
          </Button>
        </form>
      </div>
    </div>
  );
}
