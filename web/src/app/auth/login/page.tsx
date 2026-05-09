"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Info } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type AuthState, requestMagicLink } from "../actions";

const PUBLIC_PREVIEW = !process.env.NEXT_PUBLIC_API_URL;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || PUBLIC_PREVIEW} className="w-full">
      {PUBLIC_PREVIEW
        ? "Sign-in coming soon"
        : pending
          ? "Sending…"
          : "Email me a magic link"}
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
          {PUBLIC_PREVIEW && (
            <Alert className="mb-4">
              <AlertDescription className="flex items-start gap-2 text-sm">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  This is a public preview — the marketplace API isn&apos;t live
                  yet. Browse + pricing work; sign-in will go live as soon as
                  the backend is deployed.
                </span>
              </AlertDescription>
            </Alert>
          )}
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                disabled={PUBLIC_PREVIEW}
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
