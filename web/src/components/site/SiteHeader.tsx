import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-heading text-lg tracking-tight"
        >
          <Image
            src="/openclaw.svg"
            alt=""
            aria-hidden
            width={28}
            height={28}
            className="h-7 w-7 transition group-hover:scale-110"
          />
          <span className="text-foreground">Claw</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:inline">
            · marketplace
          </span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          <NavLink href="/browse">Browse</NavLink>
          <NavLink href="/#offerings">Offerings</NavLink>
          <NavLink href="/#how">How</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-[rgb(var(--crimson))] text-[rgb(var(--ivory))] hover:brightness-110"
          >
            <Link href="/auth/login?next=/dashboard/become-supplier">List your Mac</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
    >
      {children}
    </Link>
  );
}
