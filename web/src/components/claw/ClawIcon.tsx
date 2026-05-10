import { cn } from "@/lib/utils";

type Variant = "cyan" | "magenta" | "amber" | "duotone";

interface Props {
  className?: string;
  variant?: Variant;
  /** When true, the gripper "pinches" via CSS animation. */
  gripping?: boolean;
}

/**
 * Stylized claw icon — a 3-finger crane-game claw with neon stroke.
 * Built ground-up (not the dashboard-icons paw) so it animates cleanly.
 */
export function ClawIcon({ className, variant = "duotone", gripping = false }: Props) {
  const id = `claw-${variant}`;
  const stroke = "rgb(var(--claw-cyan-rgb))";
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          {variant === "cyan" && (
            <>
              <stop offset="0" stopColor="rgb(var(--claw-cyan-rgb))" />
              <stop offset="1" stopColor="rgb(var(--claw-cyan-rgb) / 0.4)" />
            </>
          )}
          {variant === "magenta" && (
            <>
              <stop offset="0" stopColor="rgb(var(--claw-magenta-rgb))" />
              <stop offset="1" stopColor="rgb(var(--claw-magenta-rgb) / 0.4)" />
            </>
          )}
          {variant === "amber" && (
            <>
              <stop offset="0" stopColor="rgb(var(--claw-amber-rgb))" />
              <stop offset="1" stopColor="rgb(var(--claw-amber-rgb) / 0.4)" />
            </>
          )}
          {variant === "duotone" && (
            <>
              <stop offset="0" stopColor="rgb(var(--claw-cyan-rgb))" />
              <stop offset="1" stopColor="rgb(var(--claw-magenta-rgb))" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`${id}-eye`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="white" />
          <stop offset="0.6" stopColor={stroke} />
          <stop offset="1" stopColor="rgb(var(--claw-magenta-rgb))" />
        </radialGradient>
      </defs>

      {/* cable */}
      <line x1="32" y1="2" x2="32" y2="14" stroke={`url(#${id}-body)`} strokeWidth="2" strokeLinecap="round" />

      {/* head/housing */}
      <rect
        x="20"
        y="12"
        width="24"
        height="14"
        rx="4"
        fill={`url(#${id}-body)`}
        stroke="rgb(255 255 255 / 0.25)"
        strokeWidth="1"
      />
      {/* glowing eye */}
      <circle cx="32" cy="19" r="2.6" fill={`url(#${id}-eye)`} />

      {/* fingers — three claws fanning out, the wrapper class drives the grip animation */}
      <g
        style={{ transformOrigin: "32px 26px" }}
        className={gripping ? "motion-safe:animate-claw-grip" : ""}
      >
        {/* left finger */}
        <path
          d="M22 26 C 18 36, 16 46, 18 56 L 22 56 C 22 48, 24 38, 26 30 Z"
          fill={`url(#${id}-body)`}
          stroke="rgb(0 0 0 / 0.3)"
          strokeWidth="0.8"
        />
        {/* right finger */}
        <path
          d="M42 26 C 46 36, 48 46, 46 56 L 42 56 C 42 48, 40 38, 38 30 Z"
          fill={`url(#${id}-body)`}
          stroke="rgb(0 0 0 / 0.3)"
          strokeWidth="0.8"
        />
        {/* middle finger */}
        <path
          d="M30 26 L 34 26 L 35 58 L 29 58 Z"
          fill={`url(#${id}-body)`}
          stroke="rgb(0 0 0 / 0.3)"
          strokeWidth="0.8"
        />
        {/* knuckles */}
        <circle cx="22" cy="28" r="2" fill="rgb(255 255 255 / 0.5)" />
        <circle cx="42" cy="28" r="2" fill="rgb(255 255 255 / 0.5)" />
        <circle cx="32" cy="28" r="2" fill="rgb(255 255 255 / 0.5)" />
      </g>
    </svg>
  );
}
