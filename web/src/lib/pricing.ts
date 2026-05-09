// Single source of truth for pricing copy. Edit here, changes propagate to
// /pricing and any future marketing surface that references commission rates.

export type PricingTier = {
  id: "hire" | "supply" | "value-add";
  name: string;
  tagline: string;
  headline: string;
  highlight?: string;
  features: string[];
  cta: { label: string; href: string };
  badge?: string;
  variant: "default" | "highlight" | "muted";
};

export const COMMISSION_PERCENT = 12;
export const SUPPLIER_KEEP_PERCENT = 100 - COMMISSION_PERCENT;

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "hire",
    name: "Hire a worker",
    tagline: "For consumers",
    headline: "Pay per hour",
    highlight: "Supplier's listed rate",
    features: [
      "Hire any active offering by the hour",
      "Sandboxed agent in a fresh microVM per booking",
      "OpenAI-compatible chat endpoint",
      "Cancel any time — billed to the second",
      `Marketplace fee: ${COMMISSION_PERCENT}% of session cost`,
    ],
    cta: { label: "Browse offerings", href: "/browse" },
    variant: "default",
  },
  {
    id: "supply",
    name: "Become a supplier",
    tagline: "For Mac owners",
    headline: "Free to list",
    highlight: `Keep ${SUPPLIER_KEEP_PERCENT}%`,
    features: [
      "One-curl install, open-source worker binary",
      "Set your hourly rate — change it whenever",
      `${SUPPLIER_KEEP_PERCENT}% of consumer payment to you`,
      `Marketplace keeps ${COMMISSION_PERCENT}% (covers Stripe + ops)`,
      "Stripe Connect payouts on a schedule that suits you",
    ],
    cta: { label: "Start earning", href: "/auth/login?next=/dashboard/become-supplier" },
    badge: "Most popular",
    variant: "highlight",
  },
  {
    id: "value-add",
    name: "Marketplace value-add",
    tagline: "Coming v2",
    headline: "Add-on services",
    highlight: "Bundled with the bigger plans",
    features: [
      "Agent state migration across suppliers (S3-backed)",
      "End-to-end encrypted chat (Noise / Signal-style)",
      "Hardware-attested supplier identity (Apple MDA)",
      "Priority routing for high-availability bookings",
      "Dedicated support (email + Slack Connect)",
    ],
    cta: { label: "Join the waitlist", href: "/auth/login" },
    variant: "muted",
  },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "How does payment actually flow?",
    a: "Consumer pays the marketplace via Stripe. The marketplace withholds the 12% commission and pays the supplier the remainder via Stripe Connect on a schedule the supplier chooses (daily / weekly / monthly).",
  },
  {
    q: "Can I run the worker on a MacBook that I'm also using?",
    a: "Yes. The worker only accepts bookings while it's running and has spare resources. You can pause / resume from the supplier dashboard at any time.",
  },
  {
    q: "What's the v1 vs v2 security story?",
    a: "v1 ships under a documented Trust-but-verify model: open-source, code-signed binary; outbound-only network; transparent audit logs. v2 layers on Apple Hardened Runtime + Secure Enclave attestation + E2E encrypted chat for stronger guarantees.",
  },
  {
    q: "What happens if my Mac goes offline mid-session?",
    a: "Active bookings auto-cancel after 5 minutes of missed heartbeats and the consumer is refunded for the unused portion. Your reputation score takes a small hit per drop — keep your machine plugged in for higher rankings.",
  },
];
