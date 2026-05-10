import Link from "next/link";

import { ClawIcon } from "@/components/claw/ClawIcon";

export function SiteFooter() {
  return (
    <footer className="relative mt-auto border-t border-white/5 bg-card/30">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-lines opacity-20" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5 font-heading text-lg">
            <ClawIcon className="h-7 w-7" gripping />
            claw
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[rgb(var(--claw-cyan-rgb))]">
              ::marketplace
            </span>
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            A peer-to-peer arcade for idle Apple Silicon. Suppliers earn from
            compute that would otherwise sit idle.
          </p>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            © {new Date().getFullYear()} · v0.1 · open core
          </p>
        </div>
        <FooterCol title="Marketplace">
          <FooterLink href="/browse">Browse hosts</FooterLink>
          <FooterLink href="/pricing">Pricing</FooterLink>
          <FooterLink href="/#offerings">Offerings</FooterLink>
          <FooterLink href="/#how">How it works</FooterLink>
        </FooterCol>
        <FooterCol title="Suppliers">
          <FooterLink href="/auth/login?next=/dashboard/become-supplier">Start earning</FooterLink>
          <FooterLink href="/dashboard/suppliers/workers">Worker console</FooterLink>
          <FooterLink href="/dashboard/suppliers/offerings">Offerings</FooterLink>
        </FooterCol>
        <FooterCol title="Build">
          <FooterLink href="https://github.com/claw-marketplace" external>GitHub</FooterLink>
          <FooterLink href="/docs">Docs (soon)</FooterLink>
          <FooterLink href="/changelog">Changelog</FooterLink>
        </FooterCol>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-[rgb(var(--claw-cyan-rgb))]">
        {title}
      </p>
      <ul className="space-y-2 text-sm text-muted-foreground">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="transition hover:text-foreground"
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
      >
        {children}
      </Link>
    </li>
  );
}
