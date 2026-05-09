"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Coins, ShieldCheck, Zap } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type BecomeSupplierState, becomeSupplier } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full">
      {pending ? "Creating account…" : "Create supplier account"}
    </Button>
  );
}

export default function BecomeSupplierPage() {
  const [state, action] = useActionState<BecomeSupplierState | null, FormData>(
    becomeSupplier,
    null,
  );
  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_24rem]">
      <section>
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Get started
        </p>
        <h1 className="mb-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Turn idle compute into income.
        </h1>
        <p className="mb-8 max-w-xl text-muted-foreground">
          Set your display name and payout email. After this, you&apos;ll get an
          install command to drop on your Mac and you can list your first offering.
        </p>
        <ul className="space-y-4 text-sm">
          <Perk icon={Coins} title="Keep 88%">
            Marketplace takes a flat 12%. No tiered fees, no monthly subscription.
          </Perk>
          <Perk icon={Zap} title="Three-minute setup">
            One curl command installs the worker. Register with a token from the
            dashboard. Done.
          </Perk>
          <Perk icon={ShieldCheck} title="Open-source worker">
            Audit every line on GitHub before running it on your hardware.
          </Perk>
        </ul>
      </section>

      <aside className="rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="mb-1 text-xl font-semibold tracking-tight">Account details</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          You can change these later in your supplier settings.
        </p>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              required
              maxLength={120}
              placeholder="Acme GPUs"
            />
            <p className="text-xs text-muted-foreground">
              Shown to consumers on your offerings.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payout_email">Payout email</Label>
            <Input
              id="payout_email"
              name="payout_email"
              type="email"
              required
              placeholder="payouts@acme.com"
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll use this to set up your Stripe Connect account in v1.5.
            </p>
          </div>
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Submit />
        </form>
      </aside>
    </div>
  );
}

function Perk({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
