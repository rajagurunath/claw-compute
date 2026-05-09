"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { OfferingOut } from "@/lib/api-types";

import { type OfferingFormResult } from "./../actions";

type Action = (
  prev: OfferingFormResult | null,
  fd: FormData,
) => Promise<OfferingFormResult>;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function OfferingForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: Partial<OfferingOut>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<OfferingFormResult | null, FormData>(
    action,
    null,
  );
  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={initial?.title ?? ""}
          placeholder="M3 Max sandbox + Qwen3.5-7B"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={initial?.description ?? ""}
          placeholder="What's special about this machine — chip, RAM, network, model preloaded, etc."
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price_per_hour_cents">Price (cents/hour)</Label>
          <Input
            id="price_per_hour_cents"
            name="price_per_hour_cents"
            type="number"
            min={0}
            required
            defaultValue={initial?.price_per_hour_cents ?? 200}
          />
          <p className="text-xs text-muted-foreground">
            200 = $2.00/hr. Marketplace takes 12%; you keep 88%.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={initial?.status ?? "active"}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft (hidden from browse)</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="capability_tags">Capability tags</Label>
        <Input
          id="capability_tags"
          name="capability_tags"
          placeholder="macos, mlx, m3-max, qwen3.5"
          defaultValue={initial?.capability_tags?.join(", ") ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated. Consumers filter by these on the browse page.
        </p>
      </div>
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="pt-2">
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
