export type UserOut = { id: string; email: string; wallet_address: string | null };

export type SupplierOut = {
  id: string;
  display_name: string;
  payout_email: string;
  payout_wallet: string | null;
};

export type OfferingStatus = "draft" | "active" | "archived";

export type OfferingOut = {
  id: string;
  supplier_id: string;
  title: string;
  description: string;
  price_per_hour_cents: number;
  capability_tags: string[];
  status: OfferingStatus;
};

export type OfferingList = { items: OfferingOut[]; total: number };

export type WorkerStatus = "pending" | "active" | "offline" | "disabled";

export type WorkerOut = {
  id: string;
  name: string;
  status: WorkerStatus;
  last_seen_at: string | null;
  machine_info: Record<string, unknown>;
};

export type ProvisioningTokenResponse = {
  provisioning_token: string;
  worker: WorkerOut;
};

export type BookingStatus = "pending" | "active" | "completed" | "cancelled";

export type BookingOut = {
  id: string;
  consumer_user_id: string;
  offering_id: string;
  worker_id: string;
  status: BookingStatus;
  started_at: string | null;
  ended_at: string | null;
};

export type RoleResponse = {
  is_supplier: boolean;
  is_consumer: boolean;
};

export type MessageOut = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/* --- public settlement ledger ------------------------------------- */

export type SettlementKind = "open" | "settle" | "cancel";
export type SettlementStatus = "confirmed" | "failed";

export type LedgerEntry = {
  id: string;
  booking_id: string;
  kind: SettlementKind;
  status: SettlementStatus;
  tx_hash: string | null;
  block_number: number | null;
  consumer_wallet: string | null;
  supplier_wallet: string | null;
  supplier_name: string | null;
  offering_title: string | null;
  rate_per_hour_cents: number | null;
  usage_seconds: number | null;
  /** 6-decimal USDC base units: the lock for `open`, the cost for `settle`/`cancel`. */
  amount_usdc: number | null;
  commission_usdc: number | null;
  error: string | null;
  created_at: string;
};

export type ChainInfo = {
  enabled: boolean;
  chain_name: string;
  chain_id: number;
  explorer_url: string;
  escrow_address: string;
  usdc_address: string;
  commission_bps: number;
};

export type LedgerStats = {
  settled_volume_usdc: number;
  commission_usdc: number;
  locked_volume_usdc: number;
  settlements: number;
  open_bookings: number;
};

export type LedgerOut = {
  chain: ChainInfo;
  stats: LedgerStats;
  items: LedgerEntry[];
  total: number;
};
