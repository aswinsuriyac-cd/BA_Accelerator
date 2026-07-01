import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-shell";
import { UploadCloud, FileText, Check, Loader2 } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { generateStories } from "@/lib/api";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Upload BRD · BRD Accelerator" }] }),
  component: UploadBRD,
});

const recent = [
  { name: "Online_Banking_BRD.pdf", size: "2.4 MB", time: "2m ago" },
  { name: "Requirements.xlsx", size: "1.8 MB", time: "15m ago" },
  { name: "Additional_Notes.docx", size: "682 KB", time: "1h ago" },
];

function UploadBRD() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      return generateStories({ file });
    },
    onSuccess: (result) => {
      if (result.workflowId) {
        navigate({ to: "/stories", search: { workflowId: result.workflowId } });
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "An error occurred during upload.");
    },
  });

  const processFile = (file: File | undefined) => {
    if (file) {
      setErrorMsg(null);
      mutation.mutate(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0]);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  return (
    <>
      <PageHeader title="Upload BRD" subtitle="Drop your Business Requirements Document to begin." />
      <div className="p-8 space-y-6">
        <div 
          className={`rounded-xl border-2 border-dashed ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card'} p-14 text-center relative transition-colors`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            {mutation.isPending ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <UploadCloud className="h-8 w-8" />
            )}
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {mutation.isPending ? "Uploading and generating stories..." : "Drag & drop your BRD file here"}
          </h3>
          {!mutation.isPending && (
            <>
              <p className="text-sm text-muted-foreground mt-1">or</p>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
              >
                Browse Files
              </button>
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                accept=".pdf,.docx,.xlsx,.txt,.eml,.md"
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Supports: PDF, DOCX, XLSX, TXT, EML, MD (Max 50MB)
              </p>
              {errorMsg && (
                <p className="mt-4 text-sm text-destructive font-medium">{errorMsg}</p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4 text-sm font-semibold">Recent Uploads</div>
          <ul className="divide-y divide-border">
            {recent.map((f) => (
              <li key={f.name} className="flex items-center gap-4 px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-info">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.size} · {f.time}</div>
                </div>
                <Check className="h-4 w-4 text-success" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
