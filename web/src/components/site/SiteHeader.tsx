import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <ClawMark className="h-5 w-5" />
          <span>Claw</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link
            href="/browse"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Browse
          </Link>
          <Link
            href="/pricing"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/auth/login?next=/dashboard/become-supplier">Start earning</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function ClawMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="claw-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        d="M6 22c4-8 12-12 20-12-2 6-6 10-12 12 6-2 10 0 12 4-8 0-16-2-20-4z"
        fill="url(#claw-grad)"
      />
    </svg>
  );
}
