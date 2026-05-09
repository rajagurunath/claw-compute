"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export function OfferingFilters() {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        defaultValue={params.get("capability") ?? ""}
        placeholder="Filter by capability tag (e.g. macos, mlx, m3-max)"
        className="pl-9"
        onChange={(e) => {
          const sp = new URLSearchParams(params);
          if (e.target.value) sp.set("capability", e.target.value);
          else sp.delete("capability");
          router.replace(`/browse?${sp.toString()}`);
        }}
      />
    </div>
  );
}
