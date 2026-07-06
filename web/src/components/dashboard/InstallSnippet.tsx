"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function InstallSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-4 pr-14 font-mono text-sm">
        <code>{snippet}</code>
      </pre>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        onClick={async () => {
          await navigator.clipboard.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-md border border-border/60 bg-background p-2 text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
      >
        {copied ? (
          <Check className="h-4 w-4 text-settle" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
