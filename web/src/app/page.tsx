import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Offerings } from "@/components/marketing/Offerings";
import { SupplierCTA } from "@/components/marketing/SupplierCTA";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Offerings />
        <HowItWorks />
        <SupplierCTA />
      </main>
      <SiteFooter />
    </>
  );
}
