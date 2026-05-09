import { createOffering } from "../actions";
import { OfferingForm } from "./OfferingForm";

export default function NewOfferingPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        New offering
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight md:text-4xl">
        List a new capability
      </h1>
      <p className="mb-8 text-muted-foreground">
        Tell consumers what your Mac is good at and what you charge per hour.
      </p>
      <OfferingForm action={createOffering} submitLabel="Create offering" />
    </div>
  );
}
