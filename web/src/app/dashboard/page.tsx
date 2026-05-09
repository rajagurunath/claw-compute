import Link from "next/link";
import { ArrowRight, Box, Calendar, Cpu, Server } from "lucide-react";

import { api } from "@/lib/api";
import type { RoleResponse } from "@/lib/api-types";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const role = await api.get<RoleResponse>("/v1/me/role");
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Dashboard
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Welcome back
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          href="/browse"
          icon={Box}
          title="Browse offerings"
          body="Find an idle Mac, hire it by the hour, get a sandboxed agent."
        />
        {role.is_consumer && (
          <ActionCard
            href="/dashboard/bookings"
            icon={Calendar}
            title="My bookings"
            body="See active and past sessions, jump into chat with the agent."
          />
        )}
        {role.is_supplier ? (
          <>
            <ActionCard
              href="/dashboard/suppliers/workers"
              icon={Cpu}
              title="Manage workers"
              body="Add new machines, copy install commands, monitor heartbeats."
            />
            <ActionCard
              href="/dashboard/suppliers/offerings"
              icon={Server}
              title="Manage offerings"
              body="Create offerings, set hourly rates, edit capability tags."
            />
          </>
        ) : (
          <ActionCard
            href="/dashboard/become-supplier"
            icon={Server}
            title="Become a supplier"
            body="Got an idle Mac? Earn from compute that would sit unused."
            variant="highlight"
          />
        )}
      </div>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  body,
  variant = "default",
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  variant?: "default" | "highlight";
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border p-6 transition hover:shadow-lg ${
        variant === "highlight"
          ? "border-foreground/30 bg-gradient-to-br from-card to-muted/30"
          : "border-border/60 bg-card hover:border-foreground/20"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <h3 className="mb-1 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Link>
  );
}

