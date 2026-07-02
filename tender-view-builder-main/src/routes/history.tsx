import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/page-shell";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkflowDetail } from "@/lib/api";
import type { GeneratorOutput } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Story Details · BRD Accelerator" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    workflowId: search.workflowId as string | undefined,
    usId: search.usId as string | undefined,
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { workflowId, usId } = Route.useSearch();

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowId ? fetchWorkflowDetail(workflowId) : Promise.reject('No workflow ID'),
    enabled: !!workflowId,
  });

  let story: any = null;
  let allStoryIds: string[] = [];

  if (workflow) {
    const genArts = workflow.artifacts.filter(a => a.artifact_type === 'generator_output');
    const genArt = genArts[genArts.length - 1];
    if (genArt) {
      try {
        const gen = JSON.parse(genArt.content_json) as GeneratorOutput;
        allStoryIds = gen.stories.map(s => s.us_id);
        story = gen.stories.find(s => s.us_id === usId) || gen.stories[0];
      } catch (e) {}
    }
  }

  const currentIndex = story ? allStoryIds.indexOf(story.us_id) : -1;
  const prevId = currentIndex > 0 ? allStoryIds[currentIndex - 1] : null;
  const nextId = currentIndex < allStoryIds.length - 1 ? allStoryIds[currentIndex + 1] : null;

  return (
    <>
      <PageHeader title="Story Details & Review" subtitle={story ? `Detailed view of ${story.us_id}` : "Detailed view of an individual story."} />
      <div className="p-8">
        {!workflowId && (
          <div className="p-10 text-center rounded-xl border border-border bg-card text-muted-foreground">
            Please select a workflow to view story details.
          </div>
        )}
        {isLoading && <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>}

        {!isLoading && workflowId && !story && (
          <div className="p-10 text-center rounded-xl border border-border bg-card text-muted-foreground">
            Story not found.
          </div>
        )}

        {!isLoading && workflowId && story && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{story.us_id}</span>
                <span className="text-base font-semibold">{story.us_summary}</span>
                <StatusBadge status={story.state} />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => prevId && window.location.assign(`/history?workflowId=${workflowId}&usId=${prevId}`)}
                  disabled={!prevId}
                  className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => nextId && window.location.assign(`/history?workflowId=${workflowId}&usId=${nextId}`)}
                  disabled={!nextId}
                  className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={() => window.open(window.location.href, '_blank')} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90">
                  Open in Full View <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid gap-8 p-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Story</div>
                  <p className="mt-2 text-sm leading-relaxed">
                    {story.user_story_description}
                  </p>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Acceptance Criteria</div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr><th className="w-8 px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Criteria</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {story.acceptance_criteria.length === 0 ? (
                          <tr><td colSpan={2} className="p-4 text-center">No acceptance criteria defined</td></tr>
                        ) : (
                          story.acceptance_criteria.map((c: string, i: number) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-muted-foreground">{i+1}</td>
                              <td className="px-3 py-2">{c}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Business Rules</div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <ul className="divide-y divide-border text-sm">
                      {story.business_rules.length === 0 ? (
                        <li className="px-4 py-2 text-muted-foreground">No business rules</li>
                      ) : (
                        story.business_rules.map((br: string, i: number) => (
                          <li key={i} className="px-4 py-2">{br}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-5 h-fit">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Details</div>
                <dl className="space-y-3 text-sm">
                  <Row label="Epic" value={story.epic} />
                  <Row label="Feature" value={story.feature} />
                  <Row label="Status"><StatusBadge status={story.state} /></Row>
                  <Row label="Dependencies" value={story.dependencies?.join(', ') || 'None'} />
                  <Row label="Comments" value={story.comments || 'None'} />
                  <Row label="Created" value={workflow?.created_at ? new Date(workflow.created_at).toLocaleDateString() : ''} />
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-right">{children ?? value}</dd>
    </div>
  );
}
