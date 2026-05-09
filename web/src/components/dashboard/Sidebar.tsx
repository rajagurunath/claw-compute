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

import type { RoleResponse } from "@/lib/api-types";

export function Sidebar({
  role,
  email,
}: {
  role: RoleResponse;
  email?: string;
}) {
  return (
    <aside className="border-r border-border/40 bg-muted/20 px-4 py-6 md:sticky md:top-0 md:h-svh">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold tracking-tight"
      >
        <ClawMark className="h-5 w-5" />
        Claw
      </Link>
      <nav className="space-y-0.5 text-sm">
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
      <div className="mt-auto pt-8">
        {email && (
          <p className="mb-2 px-2 text-xs text-muted-foreground" title={email}>
            Signed in as <span className="font-medium text-foreground">{email}</span>
          </p>
        )}
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
    <p className="mt-4 mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
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
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-foreground/80 transition hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function ClawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient
          id="dash-claw-grad"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        d="M6 22c4-8 12-12 20-12-2 6-6 10-12 12 6-2 10 0 12 4-8 0-16-2-20-4z"
        fill="url(#dash-claw-grad)"
      />
    </svg>
  );
}
