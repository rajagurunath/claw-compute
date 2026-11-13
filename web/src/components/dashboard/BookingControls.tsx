"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  cancelBooking,
  endSession,
  startAgent,
  type TransitionResult,
} from "@/app/dashboard/bookings/[id]/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/lib/api-types";

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function BookingControls({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [startState, start] = useActionState<TransitionResult | null, FormData>(
    startAgent,
    null,
  );
  const [endState, end] = useActionState<TransitionResult | null, FormData>(
    endSession,
    null,
  );
  const [cancelState, cancel] = useActionState<TransitionResult | null, FormData>(
    cancelBooking,
    null,
  );
  const error = startState?.error ?? endState?.error ?? cancelState?.error;

  if (status === "completed" || status === "cancelled") return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <form action={start}>
            <input type="hidden" name="id" value={bookingId} />
            <SubmitButton label="Start agent" pendingLabel="Paying on Arc…" />
          </form>
        )}
        {status === "active" && (
          <>
            <form action={end}>
              <input type="hidden" name="id" value={bookingId} />
              <SubmitButton label="End session" pendingLabel="Settling on Arc…" />
            </form>
            <form action={cancel}>
              <input type="hidden" name="id" value={bookingId} />
              <SubmitButton
                label="Cancel"
                pendingLabel="Cancelling…"
                variant="outline"
              />
            </form>
          </>
        )}
      </div>
      {status === "pending" && !error && (
        <p className="text-xs text-muted-foreground">
          Starting locks the first hour of USDC in escrow on Arc. You&rsquo;re
          charged only for the seconds you use.
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
