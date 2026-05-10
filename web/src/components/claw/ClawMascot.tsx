"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ClawIcon } from "./ClawIcon";

/**
 * Floating claw mascot. Two modes:
 *
 *   • idle   — sits in the lower-right corner, bobs gently, gently follows the
 *              cursor with spring lerp. Click to toggle a chat-bubble tip.
 *   • walk   — on every route change the claw walks across the bottom of the
 *              viewport (left → right) with the gripper opening and closing.
 *
 * Hidden on small screens to keep mobile chrome clean.
 */
export function ClawMascot() {
  const pathname = usePathname();
  const [walking, setWalking] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  // Trigger a walk-across on pathname change
  useEffect(() => {
    setWalking(true);
    const t = setTimeout(() => setWalking(false), 1900);
    return () => clearTimeout(t);
  }, [pathname]);

  // Cursor-following spring lerp (idle mode only)
  useEffect(() => {
    if (walking) return;
    function onMove(e: MouseEvent) {
      // pet sits anchored in lower-right; clamp follow distance to ±60px
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-50, Math.min(50, (e.clientX - cx) * 0.06));
      const dy = Math.max(-30, Math.min(20, (e.clientY - cy) * 0.05));
      targetRef.current = { x: dx, y: dy };
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    function tick() {
      setPos((p) => ({
        x: p.x + (targetRef.current.x - p.x) * 0.12,
        y: p.y + (targetRef.current.y - p.y) * 0.12,
      }));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [walking]);

  const tip = useMemo(() => pickTip(pathname), [pathname]);

  return (
    <>
      {/* Walking layer — full-width bottom band */}
      {walking && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex h-24 items-end overflow-hidden"
        >
          <div className="motion-safe:animate-claw-walk">
            <div className="motion-safe:animate-claw-bob">
              <ClawIcon className="h-20 w-20 motion-safe:animate-glow" gripping />
            </div>
            {/* trailing sparks */}
            <div className="absolute left-2 top-12 h-1 w-1 rounded-full bg-[rgb(var(--claw-cyan-rgb))] motion-safe:animate-spark" style={{ ["--tx" as string]: "-30px", ["--ty" as string]: "-10px" } as React.CSSProperties} />
            <div className="absolute left-6 top-14 h-1 w-1 rounded-full bg-[rgb(var(--claw-magenta-rgb))] motion-safe:animate-spark" style={{ ["--tx" as string]: "-20px", ["--ty" as string]: "-26px", animationDelay: "0.4s" } as React.CSSProperties} />
            <div className="absolute left-8 top-10 h-1 w-1 rounded-full bg-[rgb(var(--claw-amber-rgb))] motion-safe:animate-spark" style={{ ["--tx" as string]: "-46px", ["--ty" as string]: "-18px", animationDelay: "0.7s" } as React.CSSProperties} />
          </div>
        </div>
      )}

      {/* Idle pet */}
      {!walking && (
        <div
          ref={ref}
          className="pointer-events-auto fixed bottom-5 right-5 z-40 hidden select-none md:block"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        >
          {showTip && (
            <div className="absolute bottom-full right-0 mb-3 w-64 rounded-2xl border border-border/70 bg-popover/95 p-3 text-xs leading-relaxed text-popover-foreground shadow-xl backdrop-blur">
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[rgb(var(--claw-cyan-rgb))]">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(var(--claw-cyan-rgb))]" />
                claw://tip
              </div>
              {tip}
              <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-border/70 bg-popover/95" />
            </div>
          )}
          <button
            type="button"
            aria-label="Toggle Claw companion tip"
            onClick={() => setShowTip((v) => !v)}
            className="group relative grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-card/40 backdrop-blur-md transition hover:scale-105 hover:border-[rgb(var(--claw-cyan-rgb))/0.6]"
          >
            {/* ambient ring */}
            <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(var(--claw-cyan-rgb)/0.25),transparent)]" />
            <div className="motion-safe:animate-claw-bob">
              <ClawIcon className="h-14 w-14 motion-safe:animate-glow" gripping />
            </div>
            {/* orbiting amber bit */}
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--claw-amber-rgb))] shadow-[0_0_10px_rgb(var(--claw-amber-rgb))] motion-safe:animate-orbit"
            />
          </button>
        </div>
      )}
    </>
  );
}

function pickTip(pathname: string): string {
  if (pathname.startsWith("/dashboard/suppliers")) {
    return "Supplier mode. Heartbeats green = your Mac is earning. Set a higher tok/s rating to win more bookings.";
  }
  if (pathname.startsWith("/dashboard/bookings")) {
    return "Live booking. Type to chat with the agent — every message hits the worker, runs in its sandbox, and streams back.";
  }
  if (pathname.startsWith("/dashboard")) {
    return "Welcome back, Operator. The claw is watching the queues.";
  }
  if (pathname.startsWith("/browse")) {
    return "Pick an offering to hire. Cyan bars = real-time availability scraped from the worker pool.";
  }
  if (pathname.startsWith("/pricing")) {
    return "Suppliers keep 88%. Marketplace takes 12%. No spread on inference, no hidden GPU markup.";
  }
  return "Hey, I'm the Claw. Click anywhere to start hiring, or tap 'Become a supplier' to earn from your idle Mac.";
}
