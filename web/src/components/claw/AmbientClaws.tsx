"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

/**
 * A pool of small openclaw icons that perpetually stroll across the
 * viewport's empty space. Each claw lives on its own horizontal "lane"
 * with a unique speed, scale, opacity, and start delay so the motion
 * feels organic instead of choreographed.
 *
 * Rendered behind everything (z-index -10), pointer-events: none, and
 * masked away from the center column where most content lives so the
 * claws naturally inhabit the page margins / "free space" the user
 * called out. Hidden under prefers-reduced-motion.
 */
export function AmbientClaws({
  count = 9,
  seed = 7,
}: {
  count?: number;
  seed?: number;
}) {
  const claws = useMemo(() => generateClaws(count, seed), [count, seed]);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(m.matches);
    handler();
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, []);
  if (reduced) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        // Mask out the central reading column so claws prefer the page margins.
        maskImage:
          "radial-gradient(ellipse 38% 80% at 50% 50%, transparent 30%, black 90%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 38% 80% at 50% 50%, transparent 30%, black 90%)",
      }}
    >
      {claws.map((c, i) => (
        <Stroller key={i} {...c} />
      ))}
    </div>
  );
}

interface ClawProps {
  topPct: number;       // 0-100
  size: number;         // px
  duration: number;     // s, full traversal
  delay: number;        // s
  opacity: number;      // 0..1
  reverse: boolean;     // walk right→left instead of left→right
  flipY: boolean;       // mirror vertically (for variety, some claws hang from top)
}

function Stroller({ topPct, size, duration, delay, opacity, reverse, flipY }: ClawProps) {
  // Outer wrapper handles the long horizontal traversal.
  // Inner wrapper handles the gait (small bob/sway).
  const strollName = reverse ? "claw-stroll-rev" : "claw-stroll";
  const strideName = reverse ? "claw-stride-rev" : "claw-stride";
  return (
    <div
      className="absolute left-0"
      style={{
        top: `${topPct}%`,
        animationName: strollName,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        animationTimingFunction: "linear",
        animationIterationCount: "infinite",
        opacity,
      }}
    >
      <div
        style={{
          animationName: strideName,
          animationDuration: "0.9s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        }}
      >
        <Image
          src="/openclaw.svg"
          alt=""
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            transform: flipY ? "scaleY(-1)" : undefined,
            filter:
              "drop-shadow(0 0 6px rgb(var(--crimson-glow) / 0.35)) saturate(0.85)",
          }}
        />
      </div>
    </div>
  );
}

/* Deterministic pseudo-random so SSR and client agree without hydration warnings. */
function generateClaws(count: number, seed: number): ClawProps[] {
  const rand = mulberry32(seed);
  const lanes: number[] = [];
  // Pick well-distributed vertical lanes (avoiding very top / very bottom)
  for (let i = 0; i < count; i++) {
    const slot = (i + rand() * 0.6) / count; // jitter
    lanes.push(8 + slot * 84); // 8% .. 92%
  }
  return lanes.map((topPct) => {
    const size = 18 + Math.floor(rand() * 22);          // 18-40 px
    const duration = 38 + rand() * 32;                  // 38-70 s (very slow stroll)
    const delay = -rand() * duration;                   // negative delay so they're already mid-walk
    const opacity = 0.18 + rand() * 0.22;               // 0.18-0.40
    const reverse = rand() > 0.55;
    const flipY = rand() > 0.85;                        // a few hang from "above"
    return { topPct, size, duration, delay, opacity, reverse, flipY };
  });
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
