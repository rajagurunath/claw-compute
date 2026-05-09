export type UserOut = { id: string; email: string };

export type SupplierOut = {
  id: string;
  display_name: string;
  payout_email: string;
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
