"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { WalletFormState } from "./actions";

type Action = (
  prev: WalletFormState | null,
  fd: FormData,
) => Promise<WalletFormState>;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save wallet"}
    </Button>
  );
}

export function WalletForm({
  action,
  inputId,
  current,
}: {
  action: Action;
  inputId: string;
  current: string | null;
}) {
  const [state, formAction] = useActionState<WalletFormState | null, FormData>(
    action,
    null,
  );
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={inputId}>Address</Label>
        <Input
          id={inputId}
          name="wallet_address"
          required
          pattern="0x[0-9a-fA-F]{40}"
          title="0x followed by 40 hex characters"
          spellCheck={false}
          autoComplete="off"
          defaultValue={current ?? ""}
          placeholder="0x0000000000000000000000000000000000000000"
          className="font-mono"
        />
      </div>
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.saved && !state.error && (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-settle">
          wallet saved
        </p>
      )}
      <Submit />
    </form>
  );
}
