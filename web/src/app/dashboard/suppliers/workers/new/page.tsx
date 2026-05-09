"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, KeyRound, Terminal } from "lucide-react";

import { InstallSnippet } from "@/components/dashboard/InstallSnippet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createWorker } from "../actions";

export default function NewWorkerPage() {
  const [stage, setStage] = useState<"name" | "snippet">("name");
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  async function onSubmit(fd: FormData) {
    setError(null);
    setPending(true);
    const r = await createWorker(fd);
    setPending(false);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setToken(r.provisioning_token);
    setName((fd.get("name") as string) ?? "");
    setStage("snippet");
  }

  if (stage === "name") {
    return (
      <div className="mx-auto max-w-md">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          New worker
        </p>
        <h1 className="mb-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Name your machine
        </h1>
        <p className="mb-8 text-muted-foreground">
          Pick something you&apos;ll recognise — e.g. <code className="font-mono text-xs">mac-studio-1</code>.
        </p>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Worker name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              placeholder="mac-studio-1"
              autoFocus
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Issuing token…" : (
              <>
                Get install command
                <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  const install = `curl -fsSL ${apiUrl}/install.sh | CLAW_API_URL=${apiUrl} bash`;
  const register = `claw-worker register --api-url ${apiUrl} --provisioning-token ${token}
claw-worker run --api-url ${apiUrl}`;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Run on your Mac
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Three commands. You&apos;re online.
      </h1>
      <p className="mb-10 text-muted-foreground">
        Worker <span className="font-medium text-foreground">{name}</span> is
        provisioned. Run these on the Mac you want to share.
      </p>
      <ol className="space-y-8">
        <li>
          <header className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
              1
            </span>
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium">Install the worker</p>
          </header>
          <InstallSnippet snippet={install} />
        </li>
        <li>
          <header className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
              2
            </span>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium">Register and run</p>
          </header>
          <InstallSnippet snippet={register} />
          <p className="mt-3 rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
            <strong>Save the token now.</strong> It&apos;s shown once and discarded
            server-side after register succeeds. If you lose it, just create a
            new worker.
          </p>
        </li>
      </ol>
      <div className="mt-10 flex gap-3">
        <Button asChild>
          <Link href="/dashboard/suppliers/workers">
            Back to workers
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard/suppliers/offerings/new">
            Add an offering
          </Link>
        </Button>
      </div>
    </div>
  );
}
