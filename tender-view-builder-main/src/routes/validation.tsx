import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/page-shell";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkflowDetail } from "@/lib/api";
import { Loader2 } from "lucide-react";
import type { CriticOutput } from "@/lib/types";

export const Route = createFileRoute("/validation")({
  head: () => ({ meta: [{ title: "Validation · BRD Accelerator" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    workflowId: search.workflowId as string | undefined,
  }),
  component: Validation,
});

function Validation() {
  const { workflowId } = Route.useSearch();

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowId ? fetchWorkflowDetail(workflowId) : Promise.reject('No workflow ID'),
    enabled: !!workflowId,
  });

  let criticOutput: CriticOutput | null = null;
  if (workflow) {
    const criticArtifact = workflow.artifacts.find(a => a.artifact_type === 'critic_output');
    if (criticArtifact) {
      try {
        criticOutput = JSON.parse(criticArtifact.content_json) as CriticOutput;
      } catch (e) {
        console.error("Failed to parse critic_output artifact", e);
      }
    }
  }

  const score = criticOutput?.verdict === 'pass' ? 100 : (criticOutput ? 60 : 0);
  const isPass = criticOutput?.verdict === 'pass';
  
  const dims = [
    { label: "Verdict", value: criticOutput?.verdict || "N/A", tone: isPass ? "Good" : "High" },
    { label: "Issues Count", value: criticOutput?.issues.length || 0, tone: isPass ? "Good" : "Fair" },
    { label: "Instructions Count", value: criticOutput?.revision_instructions.length || 0, tone: "Neutral" },
  ];

  return (
    <>
      <PageHeader
        title="Validation"
        subtitle={workflow ? `AI quality checks for ${workflow.document?.original_filename || 'workflow'}` : "AI quality checks across your generated backlog."}
        actions={
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">View Full Report</button>
        }
      />
      <div className="p-8 space-y-6">
        {!workflowId && (
          <div className="p-10 text-center rounded-xl border border-border bg-card">
            Please select a workflow from the Projects or Dashboard page to see validation details.
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="text-destructive p-4 border border-destructive/20 rounded-md bg-destructive/10">
            Error loading validation. {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && workflowId && !criticOutput && (
          <div className="p-10 text-center rounded-xl border border-border bg-card text-muted-foreground">
            No validation output found for this workflow yet. (Status: {workflow?.status})
          </div>
        )}

        {!isLoading && !error && criticOutput && (
          <>
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Validation Summary</div>
                <div className="relative mt-4 mx-auto h-40 w-40">
                  <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-muted" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="10" strokeLinecap="round"
                      className={isPass ? "stroke-success" : "stroke-warning"}
                      strokeDasharray={`${(score/100)*(2*Math.PI*42)} ${2*Math.PI*42}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-4xl font-semibold">{score}%</div>
                    <div className="text-xs text-muted-foreground">Overall Score</div>
                  </div>
                </div>
                <div className="mt-4"><StatusBadge status={isPass ? "Good" : "Fair"} /></div>
                <div className="mt-2 text-sm text-muted-foreground">{criticOutput.summary}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 h-fit">
                {dims.map((d) => (
                  <div key={d.label} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">{d.label}</div>
                    <div className="mt-2 text-lg font-semibold">{d.value}</div>
                    <div className="mt-2"><StatusBadge status={d.tone} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-5 py-4 text-sm font-semibold">Issues & Recommendations</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium w-1/2">Issue</th>
                    <th className="px-5 py-3 text-left font-medium w-1/2">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {criticOutput.issues.length === 0 ? (
                    <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">No issues found.</td></tr>
                  ) : (
                    criticOutput.issues.map((issue, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-5 py-3">{issue}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                           {criticOutput?.revision_instructions[idx] || "Review manually"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
