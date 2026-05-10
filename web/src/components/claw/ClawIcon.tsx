import Image from "next/image";

import { cn } from "@/lib/utils";

type Variant = "default" | "cyan" | "magenta" | "amber" | "duotone";

interface Props {
  className?: string;
  variant?: Variant;
  /**
   * When true, the gripper "pinches" via a small CSS scale-Y on the wrapper.
   * (The real openclaw SVG is one piece — we animate the whole thing.)
   */
  gripping?: boolean;
  /**
   * Render bigger pixel size internally so the SVG isn't blurry on retina at
   * larger displayed sizes. Defaults to 128px square.
   */
  size?: number;
}

/**
 * The openclaw icon (homarr-labs/dashboard-icons), used as the universal
 * mascot. We ship it as a static asset and apply CSS filters / wrapper
 * transforms for variants and animations.
 *
 * Variant tinting uses hue-rotate; the source asset is red (~#ef0011), so:
 *    cyan    ≈ +180°    magenta ≈ +300°    amber ≈ +60°
 * For "default" / "duotone" we keep the original red and add a colored neon
 * drop-shadow so it harmonizes with the rest of the UI.
 */
export function ClawIcon({
  className,
  variant = "default",
  gripping = false,
  size = 128,
}: Props) {
  const filter = filterFor(variant);
  return (
    <span
      className={cn(
        "relative inline-grid place-items-center",
        gripping && "motion-safe:animate-claw-grip",
        className,
      )}
      style={{ filter }}
    >
      <Image
        src="/openclaw.svg"
        alt=""
        aria-hidden
        width={size}
        height={size}
        priority={false}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

function filterFor(variant: Variant): string | undefined {
  switch (variant) {
    case "cyan":
      return "hue-rotate(170deg) saturate(1.2) drop-shadow(0 0 10px rgb(var(--claw-cyan-rgb) / 0.55))";
    case "magenta":
      return "hue-rotate(310deg) saturate(1.15) drop-shadow(0 0 10px rgb(var(--claw-magenta-rgb) / 0.55))";
    case "amber":
      return "hue-rotate(40deg) saturate(1.3) brightness(1.05) drop-shadow(0 0 10px rgb(var(--claw-amber-rgb) / 0.55))";
    case "duotone":
      return "drop-shadow(0 0 10px rgb(var(--claw-cyan-rgb) / 0.5)) drop-shadow(0 0 18px rgb(var(--claw-magenta-rgb) / 0.35))";
    case "default":
    default:
      return "drop-shadow(0 0 8px rgb(255 60 80 / 0.45)) drop-shadow(0 0 18px rgb(255 100 120 / 0.25))";
  }
}
