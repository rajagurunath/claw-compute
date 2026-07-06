import { SettlementTape } from "@/components/ledger/SettlementTape";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Offerings } from "@/components/marketing/Offerings";
import { SupplierCTA } from "@/components/marketing/SupplierCTA";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { LedgerOut } from "@/lib/api-types";
import { safeGet } from "@/lib/safe-api";
import { EMPTY_LEDGER } from "@/lib/usdc";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const ledger = await safeGet<LedgerOut>("/v1/ledger?limit=20", EMPTY_LEDGER, {
    label: "ledger-tape",
  });

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero ledger={ledger} />
        <SettlementTape ledger={ledger} />
        <Offerings />
        <HowItWorks />
        <SupplierCTA />
      </main>
      <SiteFooter />
    </>
  );
}
