import type {
  GeneratorOutput,
  RouteOutput,
  SpecialistOutput,
  WorkflowDetail,
  WorkflowReviewOutput,
  WorkflowSummary,
} from './types';

const API_BASE = 'http://localhost:8000';

type RequestOptions = {
  file?: File | null;
  rawText?: string;
};

export type ApiResult<T> = {
  data: T;
  workflowId?: string | null;
};

function endpoint(path: string) {
  return `${API_BASE}${path}`;
}

async function parseJsonResponse<T>(response: Response): Promise<ApiResult<T>> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail ?? 'Request failed');
  }

  return {
    data: (await response.json()) as T,
    workflowId: response.headers.get('X-Workflow-Id'),
  };
}

async function postAnalysis<T>(stage: string, options: RequestOptions): Promise<ApiResult<T>> {
  if (options.file) {
    const body = new FormData();
    body.append('file', options.file);
    const response = await fetch(endpoint(`/api/v1/analyze/${stage}/file`), {
      method: 'POST',
      body,
    });
    return parseJsonResponse<T>(response);
  }

  const response = await fetch(endpoint(`/api/v1/analyze/${stage}/text`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: options.rawText ?? '' }),
  });
  return parseJsonResponse<T>(response);
}

export function routeAnalysis(options: RequestOptions) {
  return postAnalysis<RouteOutput>('route', options);
}

export function specialistAnalysis(options: RequestOptions) {
  return postAnalysis<SpecialistOutput>('specialist', options);
}

export function generateStories(options: RequestOptions) {
  return postAnalysis<GeneratorOutput>('generate', options);
}

export function reviewStories(options: RequestOptions) {
  return postAnalysis<WorkflowReviewOutput>('review', options);
}

export async function fetchHealth() {
  const response = await fetch(endpoint('/health'));
  if (!response.ok) {
    throw new Error('Backend health check failed');
  }
  return (await response.json()) as { status: string; service: string };
}

export async function fetchWorkflows() {
  const response = await fetch(endpoint('/api/v1/analyze/workflows'));
  if (!response.ok) {
    throw new Error('Unable to load workflows');
  }
  return (await response.json()) as WorkflowSummary[];
}

export async function fetchWorkflowDetail(workflowId: string) {
  const response = await fetch(endpoint(`/api/v1/analyze/workflows/${workflowId}`));
  if (!response.ok) {
    throw new Error('Unable to load workflow detail');
  }
  return (await response.json()) as WorkflowDetail;
}

export async function updateWorkflowDecision(
  workflowId: string,
  action: 'approve' | 'manual-review' | 'request-changes',
  comments: string,
) {
  const response = await fetch(endpoint(`/api/v1/analyze/workflows/${workflowId}/${action}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comments }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Decision update failed' }));
    throw new Error(error.detail ?? 'Decision update failed');
  }

  return (await response.json()) as { workflow_id: string; status: string; comments?: string | null };
}

async function downloadBlob(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export failed' }));
    throw new Error(error.detail ?? 'Export failed');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="(.+)"/);
  const filename = match?.[1] ?? 'download';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportFromWorkflow(workflowId: string, format: 'xlsx' | 'docx' | 'pdf') {
  const response = await fetch(
    endpoint(`/api/v1/analyze/workflows/${workflowId}/exports?output_format=${format}`),
    { method: 'POST' },
  );
  await downloadBlob(response);
}

export async function downloadSavedExport(workflowId: string, exportId: string) {
  const response = await fetch(endpoint(`/api/v1/analyze/workflows/${workflowId}/exports/${exportId}`));
  await downloadBlob(response);
}
