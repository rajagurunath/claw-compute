"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type AuthState, requestMagicLink } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Sending…" : "Email me a magic link"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, action] = useActionState<AuthState | null, FormData>(
    requestMagicLink,
    null,
  );
  return (
    <main className="mx-auto flex min-h-svh max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <Submit />
            {state?.ok && (
              <Alert>
                <AlertDescription>
                  Check your inbox for a sign-in link. (In dev, it&apos;s logged to the
                  API console.)
                </AlertDescription>
              </Alert>
            )}
            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
