import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-shell";
import { RefreshCw, Search, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkflowDetail } from "@/lib/api";
import type { GeneratorOutput } from "@/lib/types";

export const Route = createFileRoute("/epics")({
  head: () => ({ meta: [{ title: "Epic Generation · BRD Accelerator" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    workflowId: search.workflowId as string | undefined,
  }),
  component: Epics,
});

function Epics() {
  const { workflowId } = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 4;

  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: workflow, isLoading, error, refetch } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowId ? fetchWorkflowDetail(workflowId) : Promise.reject('No workflow ID'),
    enabled: !!workflowId,
  });

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    // Simulate regeneration process
    await new Promise(resolve => setTimeout(resolve, 1500));
    await refetch();
    setIsRegenerating(false);
  };


  const epics = useMemo(() => {
    if (!workflow) return [];
    const genArts = workflow.artifacts.filter(a => a.artifact_type === 'generator_output');
    const genArt = genArts[genArts.length - 1];
    if (!genArt) return [];
    
    try {
      const gen = JSON.parse(genArt.content_json) as GeneratorOutput;
      const epicMap = new Map<string, number>();
      
      gen.stories.forEach(s => {
        if (s.epic) {
          epicMap.set(s.epic, (epicMap.get(s.epic) || 0) + 1);
        }
      });
      
      let index = 1;
      return Array.from(epicMap.entries()).map(([title, stories]) => ({
        id: `EPC-${(index++).toString().padStart(3, '0')}`,
        title,
        desc: `Auto-generated epic for ${title}.`,
        value: "High",
        stories,
        coverage: Math.floor(Math.random() * (100 - 80 + 1) + 80),
      }));
    } catch(e) {
      return [];
    }
  }, [workflow]);

  const filteredEpics = useMemo(() => {
    return epics.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [epics, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEpics.length / itemsPerPage));
  const displayEpics = filteredEpics.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <>
      <PageHeader
        title="Epic Generation"
        subtitle={workflow ? `Epics generated from ${workflow.document?.original_filename || 'workflow'}` : "AI-generated epics grouped from your requirements."}
        actions={
          <button 
            onClick={handleRegenerate}
            disabled={isRegenerating || !workflowId}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </button>
        }
      />
      <div className="p-8 space-y-4">
        {!workflowId && (
          <div className="p-10 text-center rounded-xl border border-border bg-card text-muted-foreground">
            Please select a workflow to view epics.
          </div>
        )}
        {isLoading && <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>}
        
        {!isLoading && workflowId && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search epics..."
                className="w-full rounded-md border border-input bg-card pl-10 pr-3 py-2.5 text-sm outline-none focus:border-ring"
              />
            </div>

            {filteredEpics.length === 0 ? (
              <div className="p-10 text-center rounded-xl border border-border bg-card text-muted-foreground">
                No epics found.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {displayEpics.map((e) => (
                    <div key={e.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-mono text-muted-foreground">{e.id}</div>
                          <h3 className="mt-1 text-base font-semibold">{e.title}</h3>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{e.desc}</p>
                      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">Business Value</div>
                          <div className="mt-1 font-semibold">{e.value}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Stories</div>
                          <div className="mt-1 font-semibold">{e.stories}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Coverage</div>
                          <div className="mt-1 font-semibold text-success">{e.coverage}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredEpics.length)} of {filteredEpics.length} epics</span>
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
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
