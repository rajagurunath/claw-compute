import Link from "next/link";
import {
  Box,
  Calendar,
  Cpu,
  Home,
  LogOut,
  Server,
  ShoppingBag,
} from "lucide-react";

import { ClawIcon } from "@/components/claw/ClawIcon";
import type { RoleResponse } from "@/lib/api-types";

export function Sidebar({
  role,
  email,
}: {
  role: RoleResponse;
  email?: string;
}) {
  return (
    <aside className="relative flex flex-col border-r border-white/5 bg-card/40 px-4 py-6 backdrop-blur-md md:sticky md:top-0 md:h-svh">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-lines opacity-20" />
      <Link
        href="/"
        className="relative mb-1 flex items-center gap-2.5 px-2 font-heading text-lg tracking-tight"
      >
        <ClawIcon className="h-7 w-7" gripping />
        claw
      </Link>
      <p className="mb-5 px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[rgb(var(--claw-cyan-rgb))]">
        ::operator
      </p>
      <nav className="relative space-y-0.5 text-sm">
        <Item href="/dashboard" icon={Home} label="Home" />
        {role.is_consumer && (
          <Item href="/dashboard/bookings" icon={Calendar} label="My bookings" />
        )}
        {role.is_supplier ? (
          <>
            <SectionLabel>Supplier</SectionLabel>
            <Item href="/dashboard/suppliers" icon={Server} label="Overview" />
            <Item
              href="/dashboard/suppliers/workers"
              icon={Cpu}
              label="Workers"
            />
            <Item
              href="/dashboard/suppliers/offerings"
              icon={ShoppingBag}
              label="Offerings"
            />
          </>
        ) : (
          <>
            <SectionLabel>Earn</SectionLabel>
            <Item
              href="/dashboard/become-supplier"
              icon={Box}
              label="Become a supplier"
            />
          </>
        )}
      </nav>

      {/* mascot status panel */}
      <div className="relative mt-6 rounded-xl border border-white/5 bg-background/60 p-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[rgb(var(--claw-cyan-rgb))]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(var(--claw-cyan-rgb))] shadow-[0_0_8px_rgb(var(--claw-cyan-rgb))]" />
          status: online
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The claw is on duty. Heartbeats green, queues warm.
        </p>
      </div>

      <div className="relative mt-auto pt-6">
        {email && (
          <p className="mb-2 truncate px-2 font-mono text-[10px] text-muted-foreground" title={email}>
            <span className="text-[rgb(var(--claw-cyan-rgb))]">@</span>
            {email}
          </p>
        )}
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 mb-1 px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[rgb(var(--claw-magenta-rgb))]">
      {children}
    </p>
  );
}

function Item({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-foreground/80 transition hover:bg-white/5 hover:text-foreground"
    >
      <Icon className="h-4 w-4 text-muted-foreground transition group-hover:text-[rgb(var(--claw-cyan-rgb))]" />
      {label}
    </Link>
  );
}
