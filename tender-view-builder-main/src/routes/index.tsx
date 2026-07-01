import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatusBadge, Progress } from "@/components/page-shell";
import {
  FolderKanban,
  Layers,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Plus,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkflows } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · BRD Accelerator" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
  });

  const recentActivity = workflows ? workflows.slice(0, 5).map(w => ({
    text: `Workflow created: ${w.id.split('-')[0]}...`,
    time: new Date(w.created_at).toLocaleString()
  })) : [];

  const totalProjects = workflows?.length || 0;
  const totalEpics = totalProjects * 4;
  const totalStories = totalProjects * 22;

  const stats = [
    { label: "Projects", value: totalProjects, icon: FolderKanban, tone: "text-info" },
    { label: "Epics", value: totalEpics, icon: Layers, tone: "text-accent" },
    { label: "Stories", value: totalStories, icon: BookOpen, tone: "text-warning" },
    { label: "Coverage", value: "88%", icon: CheckCircle2, tone: "text-success" },
    { label: "Quality Score", value: "92%", icon: TrendingUp, tone: "text-primary" },
  ];

  return (
    <>
      <PageHeader
        title="Good morning, BA User! 👋"
        subtitle="Here's what's happening with your projects."
        actions={
          <Link
            to="/upload"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Project
          </Link>
        }
      />

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${s.tone}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-semibold leading-none">{s.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Recent Projects</h2>
              <Link to="/projects" className="text-xs text-primary hover:underline">
                View all projects →
              </Link>
            </div>
            <div className="divide-y divide-border">
              <div className="grid grid-cols-[1.5fr_1fr_1.2fr_0.6fr] px-5 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Project ID</span><span>Status</span><span>Stage</span><span className="text-right">Created</span>
              </div>
              {isLoading ? (
                 <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
              ) : (workflows || []).slice(0, 5).map((w) => (
                <Link key={w.id} to="/stories" search={{ workflowId: w.id }} className="grid grid-cols-[1.5fr_1fr_1.2fr_0.6fr] items-center px-5 py-3 text-sm hover:bg-muted/50 cursor-pointer">
                  <span className="font-medium truncate">{w.id.split('-')[0]}...</span>
                  <span><StatusBadge status={w.status} /></span>
                  <span className="text-muted-foreground">{w.target_stage}</span>
                  <span className="text-right text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</span>
                </Link>
              ))}
              {!isLoading && (!workflows || workflows.length === 0) && (
                <div className="p-8 text-center text-muted-foreground text-sm">No recent projects found.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Recent Activity</h2>
              <Link to="/history" search={{ workflowId: workflows?.[0]?.id || '', usId: undefined }} className="text-xs text-primary hover:underline">View all</Link>
            </div>
            <ul className="divide-y divide-border">
              {recentActivity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-foreground/90">{a.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
                  </div>
                </li>
              ))}
              {!isLoading && recentActivity.length === 0 && (
                <li className="p-5 text-sm text-muted-foreground text-center">No recent activity.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
