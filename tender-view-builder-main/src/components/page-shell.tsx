import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "In Progress": "bg-info/15 text-info border-info/30",
    "In Review": "bg-warning/15 text-warning border-warning/30",
    Draft: "bg-muted text-muted-foreground border-border",
    Completed: "bg-success/15 text-success border-success/30",
    Approved: "bg-success/15 text-success border-success/30",
    Pending: "bg-warning/15 text-warning border-warning/30",
    High: "bg-destructive/15 text-destructive border-destructive/30",
    Medium: "bg-warning/15 text-warning border-warning/30",
    Low: "bg-info/15 text-info border-info/30",
    Good: "bg-success/15 text-success border-success/30",
    Fair: "bg-warning/15 text-warning border-warning/30",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function Progress({ value, tone = "primary" }: { value: number; tone?: "primary" | "warning" | "info" }) {
  const color =
    tone === "warning" ? "bg-warning" : tone === "info" ? "bg-info" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 tabular-nums">{value}%</span>
    </div>
  );
}
