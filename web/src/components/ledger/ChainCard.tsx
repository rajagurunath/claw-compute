import { ArrowUpRight } from "lucide-react";

import type { ChainInfo } from "@/lib/api-types";
import { addressUrl, shortHash } from "@/lib/usdc";

/** The contract facts, laid out like a spec sheet. */
export function ChainCard({ chain }: { chain: ChainInfo }) {
  return (
    <div className="surface-card rounded-2xl border border-white/8 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Settlement rail
        </div>
        {chain.enabled ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-settle">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--settle))]" />
            live · {chain.chain_name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--slate))]" />
            not configured
          </span>
        )}
      </div>
      <dl className="mt-3 space-y-2 font-mono text-xs">
        <Fact label="escrow contract">
          {chain.escrow_address ? (
            <ExplorerLink explorer={chain.explorer_url} address={chain.escrow_address} />
          ) : (
            <span className="text-muted-foreground">awaiting deployment</span>
          )}
        </Fact>
        <Fact label="usdc token">
          <ExplorerLink explorer={chain.explorer_url} address={chain.usdc_address} />
        </Fact>
        <Fact label="chain id">
          <span className="tabular text-foreground">{chain.chain_id}</span>
        </Fact>
        <Fact label="commission">
          <span className="tabular text-foreground">
            {(chain.commission_bps / 100).toFixed(1)}%
          </span>
          <span className="text-muted-foreground"> · snapshotted per booking</span>
        </Fact>
      </dl>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate text-right">{children}</dd>
    </div>
  );
}

function ExplorerLink({ explorer, address }: { explorer: string; address: string }) {
  return (
    <a
      href={addressUrl(explorer, address)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-foreground transition hover:text-accent-crimson"
    >
      {shortHash(address, 8)}
      <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}
