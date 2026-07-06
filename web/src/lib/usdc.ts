/** Formatting helpers for on-chain settlement data. USDC is 6-decimal. */

export function formatUsdc(baseUnits: number | null | undefined): string {
  if (baseUnits == null) return "—";
  const dollars = baseUnits / 1_000_000;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function shortHash(hash: string | null | undefined, chars = 6): string {
  if (!hash) return "—";
  return `${hash.slice(0, chars + 2)}…${hash.slice(-4)}`;
}

export function txUrl(explorer: string, hash: string): string {
  return `${explorer.replace(/\/$/, "")}/tx/${hash}`;
}

export function addressUrl(explorer: string, address: string): string {
  return `${explorer.replace(/\/$/, "")}/address/${address}`;
}

export const EMPTY_LEDGER = {
  chain: {
    enabled: false,
    chain_name: "Arc Testnet",
    chain_id: 5042002,
    explorer_url: "https://testnet.arcscan.app",
    escrow_address: "",
    usdc_address: "0x3600000000000000000000000000000000000000",
    commission_bps: 1500,
  },
  stats: {
    settled_volume_usdc: 0,
    commission_usdc: 0,
    locked_volume_usdc: 0,
    settlements: 0,
    open_bookings: 0,
  },
  items: [],
  total: 0,
};
