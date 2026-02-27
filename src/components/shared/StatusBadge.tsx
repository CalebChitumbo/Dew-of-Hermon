import { Badge } from "@/components/ui/badge";
import { AssignmentStatus } from "@/types";

interface StatusBadgeProps {
  status: AssignmentStatus | "UNASSIGNED";
}

const statusConfig: Record<
  AssignmentStatus | "UNASSIGNED",
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }
> = {
  CONFIRMED: { label: "Confirmed", variant: "success" },
  PENDING: { label: "Pending", variant: "warning" },
  DECLINED: { label: "Declined", variant: "destructive" },
  NO_RESPONSE: { label: "No Response", variant: "secondary" },
  UNASSIGNED: { label: "Unassigned", variant: "outline" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant}>
      {status === "CONFIRMED" && <span className="mr-1">&#x1F7E2;</span>}
      {status === "PENDING" && <span className="mr-1">&#x1F7E1;</span>}
      {(status === "DECLINED" || status === "UNASSIGNED") && (
        <span className="mr-1">&#x1F534;</span>
      )}
      {config.label}
    </Badge>
  );
}
