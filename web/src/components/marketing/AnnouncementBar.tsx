"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "claw.pricehike.dismissed";
const WHY_URL =
  "https://9to5mac.com/2026/06/17/apple-confirms-price-increases-are-coming-to-its-products-due-to-ram-shortage/";

// Tiny external store so the dismiss button re-renders subscribers in-tab
// (the native "storage" event only fires across tabs).
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function isDismissed() {
  return localStorage.getItem(DISMISS_KEY) === "1";
}
function dismiss() {
  localStorage.setItem(DISMISS_KEY, "1");
  listeners.forEach((l) => l());
}

export function AnnouncementBar() {
  // Server renders the bar (getServerSnapshot=false); after hydration the
  // client snapshot hides it for anyone who dismissed it before.
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);

  if (dismissed) return null;

  return (
    <div className="relative z-40 border-b border-[rgb(var(--crimson))/0.2] bg-[rgb(var(--crimson))/0.08]">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-2.5 gap-y-1 px-6 py-2 pr-10 text-center font-mono text-[11px] leading-tight tracking-tight text-foreground/85 sm:pr-6">
        <span className="hidden shrink-0 rounded bg-[rgb(var(--crimson))/0.15] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-crimson sm:inline">
          Jun 25 2026
        </span>
        <span className="text-balance">
          Apple hiked Mac prices up to{" "}
          <span className="text-accent-crimson">$300</span>{" "}
          <span className="text-muted-foreground">
            (Mac Studio $3,999&thinsp;&rarr;&thinsp;$5,299)
          </span>{" "}
          &mdash; rent capacity, don&apos;t buy.
        </span>
        <Link
          href={WHY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 whitespace-nowrap font-semibold text-accent-crimson underline-offset-2 hover:underline"
        >
          why?
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
