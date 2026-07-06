import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ApiError, api } from "@/lib/api";
import type { SupplierOut, UserOut } from "@/lib/api-types";

import { saveEscrowWallet, savePayoutWallet } from "./actions";
import { WalletForm } from "./WalletForm";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const me = await api.get<UserOut>("/v1/me");

  let supplier: SupplierOut | null = null;
  try {
    supplier = await api.get<SupplierOut>("/v1/suppliers/me");
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
    // 404 → not a supplier; payout card is simply hidden.
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          usdc · on-chain
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Wallet
        </h1>
      </header>

      <div className="space-y-6">
        <section className="surface-card rounded-2xl border border-white/8 p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            all accounts
          </p>
          <h2 className="mb-2 text-xl font-semibold tracking-tight">
            Escrow wallet
          </h2>
          <p className="mb-5 max-w-xl text-sm text-muted-foreground">
            The address that deposits USDC into ClawEscrow and gets escrow locks
            charged when you book a machine. Fund it before booking.
          </p>
          <CurrentAddress address={me.wallet_address} />
          <WalletForm
            action={saveEscrowWallet}
            inputId="escrow-wallet"
            current={me.wallet_address}
          />
        </section>

        {supplier && (
          <section className="surface-card rounded-2xl border border-white/8 p-6">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              supplier
            </p>
            <h2 className="mb-2 text-xl font-semibold tracking-tight">
              Payout wallet
            </h2>
            <p className="mb-5 max-w-xl text-sm text-muted-foreground">
              85% of every settled hour lands here as claimable USDC on the
              escrow contract.
            </p>
            <CurrentAddress address={supplier.payout_wallet} />
            <WalletForm
              action={savePayoutWallet}
              inputId="payout-wallet"
              current={supplier.payout_wallet}
            />
          </section>
        )}

        <Link
          href="/ledger"
          className="group flex items-center justify-between rounded-2xl border border-white/5 px-6 py-4 text-sm text-muted-foreground transition hover:border-white/15 hover:text-foreground"
        >
          <span>
            All settlements are public —{" "}
            <span className="text-accent-crimson">see the ledger</span>.
          </span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function CurrentAddress({ address }: { address: string | null }) {
  return (
    <div className="mb-5 rounded-lg border border-white/8 bg-background/50 px-4 py-3">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        current address
      </p>
      {address ? (
        <p className="break-all font-mono text-sm">{address}</p>
      ) : (
        <p className="font-mono text-sm text-muted-foreground">not set</p>
      )}
    </div>
  );
}
