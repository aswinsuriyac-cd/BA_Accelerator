import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/page-shell";
import { Plus, Search, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkflows } from "@/lib/api";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects · BRD Accelerator" }] }),
  component: Projects,
});

function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const { data: workflows, isLoading, error } = useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
  });

  const filteredWorkflows = useMemo(() => {
    if (!workflows) return [];
    return workflows.filter(w => 
      w.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      w.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.target_stage.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [workflows, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredWorkflows.length / itemsPerPage));
  const displayWorkflows = filteredWorkflows.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Browse and manage your BRD projects."
        actions={
          <Link to="/upload" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> New Project
          </Link>
        }
      />
      <div className="p-8 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search projects..."
            className="w-full rounded-md border border-input bg-card pl-10 pr-3 py-2.5 text-sm outline-none focus:border-ring"
          />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Project ID</th>
                <th className="px-5 py-3 text-left font-medium">Stage</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Refines</th>
                <th className="px-5 py-3 text-left font-medium">Owner</th>
                <th className="px-5 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center">
                    <Loader2 className="animate-spin h-6 w-6 text-primary mx-auto" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-destructive">
                    Failed to load projects.
                  </td>
                </tr>
              ) : filteredWorkflows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    No projects found.
                  </td>
                </tr>
              ) : (
                displayWorkflows.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">
                      <Link to="/stories" search={{ workflowId: w.id }} className="hover:underline">
                        {w.id}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{w.target_stage}</td>
                    <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                    <td className="px-5 py-3">{w.refine_attempts} / {w.max_refine_attempts}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">BA</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(w.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filteredWorkflows.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground border-t border-border">
              <span>Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredWorkflows.length)} of {filteredWorkflows.length} projects</span>
              <div className="flex gap-1">
                {Array.from({length: totalPages}, (_, i) => i + 1).map(n => (
                  <button 
                    key={n} 
                    onClick={() => setPage(n)}
                    className={`h-7 w-7 rounded-md text-xs ${n === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
