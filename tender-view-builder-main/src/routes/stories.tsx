import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/page-shell";
import { Filter, LayoutGrid, Table as TableIcon, Plus, Eye, Pencil, Loader2, Search, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkflowDetail, updateWorkflowStories } from "@/lib/api";
import type { GeneratorOutput, UserStoryRow } from "@/lib/types";
import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/stories")({
  head: () => ({ meta: [{ title: "User Stories · BRD Accelerator" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    workflowId: search.workflowId as string | undefined,
  }),
  component: Stories,
});

function Stories() {
  const { workflowId } = Route.useSearch();
  const navigate = useNavigate();
  const [stories, setStories] = useState<UserStoryRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [activeModal, setActiveModal] = useState<{ type: 'edit' | 'add', story?: UserStoryRow } | null>(null);
  const [editForm, setEditForm] = useState({ summary: '', state: '', epic: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowId ? fetchWorkflowDetail(workflowId) : Promise.reject('No workflow ID'),
    enabled: !!workflowId,
  });

  useEffect(() => {
    if (workflow) {
      const generatorArtifacts = workflow.artifacts.filter(a => a.artifact_type === 'generator_output');
      const generatorArtifact = generatorArtifacts[generatorArtifacts.length - 1];
      if (generatorArtifact) {
        try {
          const output = JSON.parse(generatorArtifact.content_json) as GeneratorOutput;
          setStories(output.stories || []);
        } catch (e) {
          console.error("Failed to parse generator_output artifact", e);
        }
      }
    }
  }, [workflow]);

  const filteredStories = useMemo(() => {
    if (!searchQuery) return stories;
    return stories.filter(s => 
      s.us_summary.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.us_id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stories, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredStories.length / itemsPerPage));
  const rows = filteredStories.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  
  const handleSaveModal = async () => {
    if (!workflowId) return;
    setIsSaving(true);
    try {
      let newStories = [...stories];
      if (activeModal?.type === 'edit' && activeModal.story) {
        newStories = stories.map(s => 
          s.us_id === activeModal.story!.us_id 
            ? { ...s, us_summary: editForm.summary, state: editForm.state as any, epic: editForm.epic, user_story_description: editForm.description } 
            : s
        );
      } else if (activeModal?.type === 'add') {
        const timestamp = Date.now().toString().slice(-4);
        const newStory: UserStoryRow = {
          serial_number: stories.length + 1,
          us_id: `US-CUST-${timestamp}`,
          epic: editForm.epic || 'Custom Epic',
          feature: 'Custom Feature',
          us_summary: editForm.summary,
          user_story_description: editForm.description,
          acceptance_criteria: [],
          business_rules: [],
          dependencies: [],
          state: editForm.state || 'Draft',
          comments: '',
          reference_link: ''
        };
        newStories.push(newStory);
      }
      
      await updateWorkflowStories(workflowId, newStories);
      setStories(newStories);
      setActiveModal(null);
    } catch (err) {
      alert("Failed to save story");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="User Stories"
        subtitle={workflow ? `Stories generated from ${workflow.document?.original_filename || 'upload'}` : "All user stories generated from your epics."}
        actions={
          <>
            <button 
              onClick={() => setViewMode("board")} 
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm ${viewMode === 'board' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
            >
              <LayoutGrid className="h-4 w-4" /> Board
            </button>
            <button 
              onClick={() => setViewMode("table")} 
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm ${viewMode === 'table' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
            >
              <TableIcon className="h-4 w-4" /> Table
            </button>
            <button 
              onClick={() => {
                setEditForm({ summary: '', state: 'Draft', epic: '', description: '' });
                setActiveModal({ type: 'add' });
              }} 
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Story
            </button>
          </>
        }
      />
      <div className="p-8 space-y-4">
        {!workflowId && (
          <div className="p-10 text-center rounded-xl border border-border bg-card text-muted-foreground">
            Please select a workflow from Projects to view its stories.
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="text-destructive p-4 border border-destructive/20 rounded-md bg-destructive/10">
            Error loading stories. {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && workflowId && (
          <>
            <div className="flex gap-4 items-center">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Filter stories..."
                  className="w-full rounded-md border border-input bg-card pl-10 pr-3 py-2 text-sm outline-none focus:border-ring"
                />
              </div>
            </div>

            {viewMode === "table" ? (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">ID</th>
                      <th className="px-5 py-3 text-left font-medium">Title</th>
                      <th className="px-5 py-3 text-left font-medium">Epic</th>
                      <th className="px-5 py-3 text-left font-medium">Story Points</th>
                      <th className="px-5 py-3 text-left font-medium">Priority</th>
                      <th className="px-5 py-3 text-left font-medium">Status</th>
                      <th className="px-5 py-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                          No stories found for this workflow.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, idx) => (
                        <tr key={r.us_id || idx} className="hover:bg-muted/30">
                          <td className="px-5 py-3 font-mono text-xs">{r.us_id}</td>
                          <td className="px-5 py-3 font-medium">{r.us_summary}</td>
                          <td className="px-5 py-3 text-muted-foreground text-xs">{r.epic}</td>
                          <td className="px-5 py-3 tabular-nums">3</td>
                          <td className="px-5 py-3"><StatusBadge status="High" /></td>
                          <td className="px-5 py-3"><StatusBadge status={r.state || 'Generated'} /></td>
                          <td className="px-5 py-3">
                            <div className="flex gap-2 text-muted-foreground">
                              <button 
                                onClick={() => navigate({ to: '/history', search: { workflowId, usId: r.us_id }})}
                                className="hover:text-foreground"
                                title="View Details"
                              ><Eye className="h-4 w-4" /></button>
                              <button 
                                onClick={() => {
                                  setEditForm({ 
                                    summary: r.us_summary, 
                                    state: r.state || 'Generated',
                                    epic: r.epic,
                                    description: r.user_story_description
                                  });
                                  setActiveModal({ type: 'edit', story: r });
                                }} 
                                className="hover:text-foreground" 
                                title="Edit Story"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {filteredStories.length > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                    <span>Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredStories.length)} of {filteredStories.length} stories</span>
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {["Generated", "Refined", "Approved"].map(col => {
                  const colStories = filteredStories.filter(s => (s.state || 'Generated') === col);
                  return (
                    <div key={col} className="rounded-xl border border-border bg-card p-4">
                      <h3 className="font-semibold text-sm mb-4 flex items-center justify-between">
                        {col}
                        <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                          {colStories.length}
                        </span>
                      </h3>
                      <div className="space-y-3">
                        {colStories.map(s => (
                          <div key={s.us_id} className="p-3 border border-border rounded-lg bg-background shadow-sm hover:border-primary/40 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs font-mono text-muted-foreground">{s.us_id}</span>
                              <StatusBadge status="High" />
                            </div>
                            <p className="text-sm font-medium mb-3">{s.us_summary}</p>
                            <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                              <span className="truncate max-w-[120px]">{s.epic}</span>
                              <div className="flex gap-2">
                                <button onClick={() => navigate({ to: '/history', search: { workflowId, usId: s.us_id }})} className="hover:text-foreground"><Eye className="h-3.5 w-3.5" /></button>
                                <button onClick={() => {
                                  setEditForm({ 
                                    summary: s.us_summary, 
                                    state: s.state || 'Generated',
                                    epic: s.epic,
                                    description: s.user_story_description
                                  });
                                  setActiveModal({ type: 'edit', story: s });
                                }} className="hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {colStories.length === 0 && (
                          <div className="text-xs text-center text-muted-foreground py-4 border border-dashed border-border rounded-lg">
                            No stories in this column
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-md bg-card text-card-foreground border border-border">
          <DialogHeader>
            <DialogTitle>{activeModal?.type === 'edit' ? `Edit Story: ${activeModal?.story?.us_id}` : 'Add New Story'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Epic</label>
              <input 
                value={editForm.epic}
                onChange={(e) => setEditForm(prev => ({ ...prev, epic: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring outline-none"
                placeholder="Epic name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Summary</label>
              <textarea 
                value={editForm.summary}
                onChange={(e) => setEditForm(prev => ({ ...prev, summary: e.target.value }))}
                className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <textarea 
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring outline-none"
                placeholder="I want to... so that..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <select
                value={editForm.state}
                onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring outline-none"
              >
                <option value="Draft">Draft</option>
                <option value="Generated">Generated</option>
                <option value="Refined">Refined</option>
                <option value="Approved">Approved</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveModal}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 
              {isSaving ? "Saving..." : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
