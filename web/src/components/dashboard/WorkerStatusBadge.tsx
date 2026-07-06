import { Badge } from "@/components/ui/badge";
import type { WorkerStatus } from "@/lib/api-types";

const styles: Record<
  WorkerStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  active: "default",
  offline: "secondary",
  disabled: "destructive",
};

const labels: Record<WorkerStatus, string> = {
  pending: "Pending",
  active: "Active",
  offline: "Offline",
  disabled: "Disabled",
};

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  return (
    <Badge variant={styles[status]} className="gap-1.5 font-normal">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor(status)}`}
        aria-hidden
      />
      {labels[status]}
    </Badge>
  );
}

function dotColor(status: WorkerStatus): string {
  switch (status) {
    case "active":
      return "bg-[rgb(var(--settle))] motion-safe:animate-pulse";
    case "pending":
      return "bg-[rgb(var(--gold))]";
    case "offline":
      return "bg-[rgb(var(--slate))]";
    case "disabled":
      return "bg-[rgb(var(--crimson))]";
  }
}
