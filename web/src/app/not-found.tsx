import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-30"
      >
        <div className="aspect-square h-72 rounded-full bg-[rgb(var(--crimson))]/15 blur-3xl" />
      </div>
      <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="mb-3 bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-5xl font-semibold tracking-tight text-transparent">
        Lost in the cluster.
      </h1>
      <p className="mb-8 text-balance text-muted-foreground">
        The page you&apos;re looking for isn&apos;t running on any worker we
        know. Maybe it was archived, maybe the link is stale.
      </p>
      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/browse">
            <Search className="h-4 w-4" />
            Browse offerings
          </Link>
        </Button>
      </div>
    </main>
  );
}
