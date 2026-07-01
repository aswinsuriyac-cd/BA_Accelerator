import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/page-shell";
import { Pencil, Eye, Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWorkflowDetail, updateWorkflowDecision } from "@/lib/api";
import type { SpecialistOutput, GeneratorOutput } from "@/lib/types";

export const Route = createFileRoute("/requirements")({
  head: () => ({ meta: [{ title: "Requirements · BRD Accelerator" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    workflowId: search.workflowId as string | undefined,
  }),
  component: Requirements,
});

function Requirements() {
  const { workflowId } = Route.useSearch();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowId ? fetchWorkflowDetail(workflowId) : Promise.reject('No workflow ID'),
    enabled: !!workflowId,
  });

  const approveMutation = useMutation({
    mutationFn: () => updateWorkflowDecision(workflowId!, 'approve', 'Approved from requirements review'),
    onSuccess: () => {
      alert("Workflow approved!");
      navigate({ to: '/stories', search: { workflowId } });
    },
  });

  const [rows, setRows] = useState<any[]>([]);
  const [activeModal, setActiveModal] = useState<{ type: 'view' | 'edit', req: any } | null>(null);
  const [editForm, setEditForm] = useState({ req: '', priority: '' });

  useEffect(() => {
    if (!workflow) return;
    let extracted: any[] = [];
    
    // Parse Specialist Output (Actors, Constraints, Goals)
    const specArt = workflow.artifacts.find(a => a.artifact_type === 'specialist_output');
    if (specArt) {
      try {
        const spec = JSON.parse(specArt.content_json) as SpecialistOutput;
        spec.actors.forEach((a, i) => extracted.push({ id: `ACT-${i+1}`, req: a, type: "Actors", priority: "Medium", conf: 0.9 }));
        spec.constraints.forEach((c, i) => extracted.push({ id: `CT-${i+1}`, req: c, type: "Constraints", priority: "High", conf: 0.95 }));
        spec.goals.forEach((g, i) => extracted.push({ id: `GL-${i+1}`, req: g, type: "Business Rules", priority: "High", conf: 0.92 }));
      } catch (e) {}
    }

    // Parse Generator Output for Functional requirements (Stories)
    const genArt = workflow.artifacts.find(a => a.artifact_type === 'generator_output');
    if (genArt) {
      try {
        const gen = JSON.parse(genArt.content_json) as GeneratorOutput;
        gen.stories.forEach((s) => extracted.push({ id: s.us_id, req: s.us_summary, type: "Functional", priority: "High", conf: 0.99 }));
      } catch(e) {}
    }

    setRows(extracted);
  }, [workflow]);

  const handleSaveEdit = () => {
    if (!activeModal) return;
    setRows(rows.map(r => r.id === activeModal.req.id ? { ...r, req: editForm.req, priority: editForm.priority } : r));
    setActiveModal(null);
  };

  const tabs = [
    { name: "All", count: rows.length },
    { name: "Functional", count: rows.filter(r => r.type === "Functional").length },
    { name: "Constraints", count: rows.filter(r => r.type === "Constraints").length },
    { name: "Business Rules", count: rows.filter(r => r.type === "Business Rules").length },
    { name: "Actors", count: rows.filter(r => r.type === "Actors").length },
  ];

  const filteredRows = filter === "All" ? rows : rows.filter(r => r.type === filter);

  return (
    <>
      <PageHeader title="Requirement Review" subtitle="Review and approve extracted requirements." />
      <div className="p-8 space-y-4">
        {!workflowId && (
          <div className="p-10 text-center rounded-xl border border-border bg-card">
            Please select a workflow to view requirements.
          </div>
        )}
        {isLoading && <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>}
        
        {!isLoading && workflowId && (
          <>
            <div className="flex flex-wrap gap-2">
              {tabs.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => setFilter(t.name)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                    filter === t.name ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.name} ({t.count})
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">ID</th>
                    <th className="px-5 py-3 text-left font-medium">Requirement</th>
                    <th className="px-5 py-3 text-left font-medium">Type</th>
                    <th className="px-5 py-3 text-left font-medium">Priority</th>
                    <th className="px-5 py-3 text-left font-medium">Confidence</th>
                    <th className="px-5 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No requirements found.</td></tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3 font-mono text-xs">{r.id}</td>
                        <td className="px-5 py-3">{r.req}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">{r.type}</td>
                        <td className="px-5 py-3"><StatusBadge status={r.priority} /></td>
                        <td className="px-5 py-3 tabular-nums text-xs">{r.conf.toFixed(2)}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 text-muted-foreground">
                            <button 
                              onClick={() => {
                                setEditForm({ req: r.req, priority: r.priority });
                                setActiveModal({ type: 'edit', req: r });
                              }}
                              className="hover:text-foreground"
                              title="Edit Requirement"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => {
                                if (r.type === "Functional") {
                                  navigate({ to: '/history', search: { workflowId, usId: r.id }});
                                } else {
                                  setActiveModal({ type: 'view', req: r });
                                }
                              }} 
                              className="hover:text-foreground"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                <span>Showing {filteredRows.length} of {rows.length}</span>
                <button 
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending || rows.length === 0}
                  className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground font-medium disabled:opacity-50"
                >
                  {approveMutation.isPending ? 'Approving...' : 'Approve & Next'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl bg-card text-card-foreground border border-border">
          <DialogHeader>
            <DialogTitle>
              {activeModal?.type === 'edit' ? `Edit Requirement: ${activeModal?.req.id}` : `View Requirement Details`}
            </DialogTitle>
            {activeModal?.type === 'view' && (
              <DialogDescription>
                Full details for requirement {activeModal?.req.id}
              </DialogDescription>
            )}
          </DialogHeader>

          {activeModal?.type === 'view' && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">ID</h4>
                  <div className="text-sm font-mono">{activeModal.req.id}</div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Type</h4>
                  <div className="text-sm">{activeModal.req.type}</div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Priority</h4>
                  <div><StatusBadge status={activeModal.req.priority} /></div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Confidence Score</h4>
                  <div className="text-sm tabular-nums">{activeModal.req.conf.toFixed(2)}</div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Requirement Text</h4>
                <div className="rounded-md bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {activeModal.req.req}
                </div>
              </div>
            </div>
          )}

          {activeModal?.type === 'edit' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Requirement Text</label>
                <textarea 
                  value={editForm.req}
                  onChange={(e) => setEditForm(prev => ({ ...prev, req: e.target.value }))}
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring outline-none"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted"
            >
              Close
            </button>
            {activeModal?.type === 'edit' && (
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
              >
                <Save className="h-4 w-4" /> Save Changes
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
