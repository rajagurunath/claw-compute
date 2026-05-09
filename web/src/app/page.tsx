import { Features } from "@/components/marketing/Features";
import { Hero } from "@/components/marketing/Hero";
import { SupplierCTA } from "@/components/marketing/SupplierCTA";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <SupplierCTA />
      </main>
      <SiteFooter />
    </>
  );
}
