import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/40 bg-muted/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Claw Marketplace. Idle Macs, hired by the hour.</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/browse" className="hover:text-foreground">
            Browse
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/auth/login" className="hover:text-foreground">
            Sign in
          </Link>
          <a
            href="https://github.com/claw-marketplace"
            className="hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
