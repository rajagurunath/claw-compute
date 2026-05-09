"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console for ad-hoc debugging; the digest is the
    // server-side correlation id when the error came from an RSC.
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <main className="relative mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">
        Something broke.
      </h1>
      <p className="mb-2 max-w-md text-balance text-sm text-muted-foreground">
        {error.message || "Unknown error."}
      </p>
      {error.digest && (
        <p className="mb-6 font-mono text-xs text-muted-foreground/70">
          digest: {error.digest}
        </p>
      )}
      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <a href="/">Go home</a>
        </Button>
      </div>
    </main>
  );
}
