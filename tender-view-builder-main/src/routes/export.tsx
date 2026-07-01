import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-shell";
import { FileText, FileSpreadsheet, FileType2, FileCode2, Download, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWorkflowDetail, exportFromWorkflow, downloadSavedExport } from "@/lib/api";

export const Route = createFileRoute("/export")({
  head: () => ({ meta: [{ title: "Export · BRD Accelerator" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    workflowId: search.workflowId as string | undefined,
  }),
  component: ExportPage,
});

const options = [
  { id: 'pdf', icon: FileType2, title: "PDF Report", desc: "Generate PDF report", color: "text-destructive" },
  { id: 'docx', icon: FileText, title: "Word Document", desc: "Generate Word doc", color: "text-info" },
  { id: 'xlsx', icon: FileSpreadsheet, title: "Excel Sheet", desc: "Export to Excel", color: "text-success" },
];

function ExportPage() {
  const { workflowId } = Route.useSearch();
  const queryClient = useQueryClient();

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowId ? fetchWorkflowDetail(workflowId) : Promise.reject('No workflow ID'),
    enabled: !!workflowId,
  });

  const exportMutation = useMutation({
    mutationFn: (format: 'pdf' | 'docx' | 'xlsx') => {
      if (!workflowId) throw new Error("No workflow selected");
      return exportFromWorkflow(workflowId, format);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
    },
  });

  return (
    <>
      <PageHeader 
        title="Export" 
        subtitle={workflow ? `Export requirements for ${workflow.document?.original_filename || 'workflow'}` : "Export your requirements, epics and stories."} 
      />
      <div className="p-8 space-y-6">
        {!workflowId && (
          <div className="p-10 text-center rounded-xl border border-border bg-card">
            Please select a workflow from the Projects or Dashboard page to export.
          </div>
        )}
        
        {workflowId && (
          <>
            <div>
              <h2 className="text-sm font-semibold mb-3">Export Options</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {options.map((o) => (
                  <button 
                    key={o.title} 
                    disabled={exportMutation.isPending}
                    onClick={() => exportMutation.mutate(o.id as any)}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-muted ${o.color}`}>
                      {exportMutation.isPending && exportMutation.variables === o.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <o.icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{o.title}</div>
                      <div className="text-xs text-muted-foreground">{o.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              {exportMutation.isError && (
                <div className="mt-4 text-sm text-destructive font-medium">
                  Failed to generate export: {(exportMutation.error as Error).message}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold">Export History</h2>
              </div>
              <ul className="divide-y divide-border">
                {isLoading ? (
                  <li className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></li>
                ) : (!workflow?.exports || workflow.exports.length === 0) ? (
                  <li className="p-8 text-center text-sm text-muted-foreground">No previous exports found.</li>
                ) : (
                  workflow.exports.map((h) => (
                    <li key={h.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-info">
                        {h.export_format === 'pdf' ? <FileType2 className="h-4 w-4" /> : 
                         h.export_format === 'docx' ? <FileText className="h-4 w-4" /> :
                         <FileSpreadsheet className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Exported {h.export_format.toUpperCase()}</div>
                        <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                      </div>
                      <button 
                        onClick={() => downloadSavedExport(workflowId, h.id)}
                        className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Download again"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}
