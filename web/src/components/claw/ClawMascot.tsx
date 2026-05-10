"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Headline mascot. Two modes:
 *
 *   • idle      — anchored bottom-right, gentle bob + soft glow,
 *                 spring-follows the cursor by ±50px.
 *   • walking   — on every route change a single hero claw walks SLOWLY
 *                 across the bottom of the viewport, leaving a footprint
 *                 trail. ~5 seconds for a single traversal so it's clearly
 *                 visible, not a flash.
 *
 * The continuous "small claws walking through free space" effect lives in
 * AmbientClaws.tsx — that component is always-on, this one is event-driven.
 */
export function ClawMascot() {
  const pathname = usePathname();
  const [walking, setWalking] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  // Trigger a slow, deliberate walk-across on pathname change.
  useEffect(() => {
    setWalking(true);
    const t = setTimeout(() => setWalking(false), 5400);
    return () => clearTimeout(t);
  }, [pathname]);

  // Cursor-follow lerp (idle only).
  useEffect(() => {
    if (walking) return;
    function onMove(e: MouseEvent) {
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
      {/* Hero walk — slow, takes the full bottom band. */}
      {walking && <HeroWalk />}

      {/* Idle pet */}
      {!walking && (
        <div
          ref={ref}
          className="pointer-events-auto fixed bottom-6 right-6 z-40 hidden select-none md:block"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        >
          {showTip && (
            <div className="absolute bottom-full right-0 mb-3 w-72 rounded-xl border border-border/70 bg-popover/95 p-3.5 text-xs leading-relaxed text-popover-foreground shadow-2xl backdrop-blur">
              <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-crimson">
                <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[rgb(var(--crimson))]" />
                claw // tip
              </div>
              {tip}
              <div className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 border-b border-r border-border/70 bg-popover/95" />
            </div>
          )}
          <button
            type="button"
            aria-label="Toggle Claw companion tip"
            onClick={() => setShowTip((v) => !v)}
            className="group relative grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-card/60 backdrop-blur-md transition hover:scale-105 hover:border-[rgb(var(--crimson))/0.6]"
          >
            {/* concentric pulse ring */}
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full border border-[rgb(var(--crimson))/0.5] motion-safe:animate-pulse-ring" />
            {/* soft warmth */}
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(var(--crimson)/0.18),transparent)]" />
            <div className="motion-safe:animate-claw-bob">
              <Image
                src="/openclaw.svg"
                alt=""
                aria-hidden
                width={64}
                height={64}
                className="h-14 w-14 motion-safe:animate-glow-soft"
              />
            </div>
          </button>
        </div>
      )}
    </>
  );
}

function HeroWalk() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-28 overflow-hidden"
    >
      {/* footprint trail — staggered fading copies behind the walking claw */}
      <div className="relative h-full w-full">
        <Walker delay={0} size={64} opacity={1} />
        <Walker delay={0.35} size={48} opacity={0.45} />
        <Walker delay={0.7}  size={36} opacity={0.25} />
        <Walker delay={1.05} size={28} opacity={0.15} />
      </div>
    </div>
  );
}

function Walker({ delay, size, opacity }: { delay: number; size: number; opacity: number }) {
  return (
    <div
      className="absolute bottom-3 left-0"
      style={{
        animation: "claw-stroll 5s linear forwards",
        animationDelay: `${delay}s`,
        opacity,
      }}
    >
      <div className="motion-safe:animate-claw-stride" style={{ animationDuration: "0.8s" }}>
        <Image
          src="/openclaw.svg"
          alt=""
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            filter: "drop-shadow(0 4px 12px rgb(var(--crimson-glow) / 0.4))",
          }}
        />
      </div>
    </div>
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
    return "Pick an offering to hire. Live availability is pulled directly from each worker's heartbeat.";
  }
  if (pathname.startsWith("/pricing")) {
    return "Suppliers keep 88%. Marketplace takes 12%. No spread on inference, no hidden GPU markup.";
  }
  return "Hi — I'm the Claw. Hire compute on the right, or plug in your own Mac to start earning.";
}
