import { startTransition, useEffect, useMemo, useState } from 'react'

import {
  downloadSavedExport,
  exportFromWorkflow,
  fetchHealth,
  fetchWorkflowDetail,
  fetchWorkflows,
  generateStories,
  reworkWorkflow,
  reviewStories,
  routeAnalysis,
  specialistAnalysis,
  updateWorkflowDecision,
} from './api'
import type {
  ArtifactRecord,
  CriticOutput,
  GeneratorOutput,
  RouteOutput,
  SpecialistOutput,
  WorkflowDetail,
  WorkflowReviewOutput,
  WorkflowSummary,
} from './types'

type Mode = 'text' | 'file'
type Stage = 'route' | 'specialist' | 'generate' | 'review'
type InspectorSource = 'live' | 'saved'
type LiveTab = 'router' | 'specialist' | 'generator' | 'review'
type SavedTab = 'overview' | 'stories' | 'reviews' | 'artifacts' | 'exports'

const stageOrder: Stage[] = ['route', 'specialist', 'generate', 'review']

const stageMeta: Record<Stage, { title: string; description: string; requiredOutput?: string }> = {
  route: {
    title: 'Router',
    description: 'Classify the BRD and choose the downstream specialist.',
  },
  specialist: {
    title: 'Specialist',
    description: 'Extract actors, goals, constraints, criteria, and edge cases.',
    requiredOutput: 'Needs Router output first.',
  },
  generate: {
    title: 'Generator',
    description: 'Build the workbook-style story package and assign IDs.',
    requiredOutput: 'Needs Specialist output first.',
  },
  review: {
    title: 'Critic + BA Gate',
    description: 'Validate the generated package and prepare it for BA review.',
    requiredOutput: 'Needs Generator output first.',
  },
}

const workflowStatusTone: Record<string, string> = {
  generated: 'bg-sky-100 text-sky-700 ring-sky-200',
  pending_ba_review: 'bg-amber-100 text-amber-800 ring-amber-200',
  ba_approved: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  needs_manual_review: 'bg-rose-100 text-rose-700 ring-rose-200',
  ba_changes_requested: 'bg-orange-100 text-orange-700 ring-orange-200',
}

function statusClass(status: string) {
  return workflowStatusTone[status] ?? 'bg-stone-100 text-stone-700 ring-stone-200'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-14 text-center">
      <p className="text-base font-semibold text-stone-800">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-500">{description}</p>
    </div>
  )
}

function ArtifactPanel({ artifact }: { artifact: ArtifactRecord }) {
  return (
    <details className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none text-sm font-semibold text-stone-900">
        {artifact.artifact_type.replaceAll('_', ' ')}
        <span className="ml-2 text-xs font-normal text-stone-500">{formatDate(artifact.created_at)}</span>
      </summary>
      <pre className="mt-4 overflow-x-auto rounded-2xl bg-stone-950 p-4 text-xs text-stone-100">
        {artifact.content_json}
      </pre>
    </details>
  )
}

function StoryTable({ output }: { output: GeneratorOutput }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h3 className="text-lg font-semibold text-stone-950">{output.document_title}</h3>
        <p className="mt-1 text-sm text-stone-600">
          Prefix {output.story_id_prefix} • {output.stories.length} stories
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-950 text-white">
            <tr>
              <th className="px-4 py-3 font-medium">US ID</th>
              <th className="px-4 py-3 font-medium">Summary</th>
              <th className="px-4 py-3 font-medium">Epic / Feature</th>
              <th className="px-4 py-3 font-medium">Acceptance Criteria</th>
              <th className="px-4 py-3 font-medium">Dependencies</th>
            </tr>
          </thead>
          <tbody>
            {output.stories.map((story, index) => (
              <tr key={story.us_id} className={index % 2 === 0 ? 'bg-white' : 'bg-stone-50/70'}>
                <td className="align-top px-4 py-4 font-semibold text-stone-900">{story.us_id}</td>
                <td className="align-top px-4 py-4">
                  <p className="font-medium text-stone-900">{story.us_summary}</p>
                  <p className="mt-2 text-xs leading-5 text-stone-600">{story.user_story_description}</p>
                </td>
                <td className="align-top px-4 py-4">
                  <p className="font-medium text-stone-900">{story.epic}</p>
                  <p className="mt-1 text-stone-600">{story.feature}</p>
                </td>
                <td className="align-top px-4 py-4">
                  <ul className="space-y-2 text-stone-700">
                    {story.acceptance_criteria.map((criterion) => (
                      <li key={criterion} className="rounded-xl bg-stone-100 px-3 py-2">
                        {criterion}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="align-top px-4 py-4">
                  <ul className="space-y-2 text-stone-700">
                    {story.dependencies.length > 0 ? (
                      story.dependencies.map((dependency) => (
                        <li key={dependency} className="rounded-xl bg-amber-50 px-3 py-2">
                          {dependency}
                        </li>
                      ))
                    ) : (
                      <li className="text-stone-400">No dependencies captured</li>
                    )}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function App() {
  const [mode, setMode] = useState<Mode>('file')
  const [rawText, setRawText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [activeStage, setActiveStage] = useState<Stage>('route')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<'checking' | 'healthy' | 'offline'>('checking')
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null)
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null)
  const [decisionComment, setDecisionComment] = useState('')
  const [routeOutput, setRouteOutput] = useState<RouteOutput | null>(null)
  const [specialistOutput, setSpecialistOutput] = useState<SpecialistOutput | null>(null)
  const [generatorOutput, setGeneratorOutput] = useState<GeneratorOutput | null>(null)
  const [reviewOutput, setReviewOutput] = useState<WorkflowReviewOutput | null>(null)
  const [inspectorSource, setInspectorSource] = useState<InspectorSource>('live')
  const [activeLiveTab, setActiveLiveTab] = useState<LiveTab>('router')
  const [activeSavedTab, setActiveSavedTab] = useState<SavedTab>('overview')

  const resetCurrentOutputs = () => {
    setRouteOutput(null)
    setSpecialistOutput(null)
    setGeneratorOutput(null)
    setReviewOutput(null)
    setCurrentWorkflowId(null)
    setActiveStage('route')
    setActiveLiveTab('router')
    setInspectorSource('live')
  }

  const getMissingPrerequisite = (stage: Stage) => {
    if (stage === 'specialist' && !routeOutput) {
      return 'Run Router first. Specialist needs Router output before it can analyze the BRD.'
    }
    if (stage === 'generate' && !specialistOutput) {
      return 'Run Specialist first. Generator needs Specialist output before it can create stories.'
    }
    if (stage === 'review' && !generatorOutput) {
      return 'Run Generator first. Critic review needs generated stories before it can review them.'
    }
    return null
  }

  const selectStage = (stage: Stage) => {
    const missingPrerequisite = getMissingPrerequisite(stage)
    if (missingPrerequisite) {
      setError(missingPrerequisite)
      return
    }

    setError(null)
    setActiveStage(stage)
  }

  useEffect(() => {
    fetchHealth()
      .then(() => setHealth('healthy'))
      .catch(() => setHealth('offline'))
  }, [])

  const loadWorkflows = async (nextSelectedId?: string | null) => {
    const items = await fetchWorkflows()
    startTransition(() => {
      setWorkflows(items)
      const preferred = nextSelectedId ?? selectedWorkflowId ?? items[0]?.id ?? null
      setSelectedWorkflowId(preferred)
    })
  }

  useEffect(() => {
    fetchWorkflows()
      .then((items) => {
        startTransition(() => {
          setWorkflows(items)
          setSelectedWorkflowId(items[0]?.id ?? null)
        })
      })
      .catch((loadError: Error) => setError(loadError.message))
  }, [])

  useEffect(() => {
    if (!selectedWorkflowId) {
      setSelectedWorkflow(null)
      return
    }

    fetchWorkflowDetail(selectedWorkflowId)
      .then(setSelectedWorkflow)
      .catch((detailError: Error) => setError(detailError.message))
  }, [selectedWorkflowId])

  const parsedArtifacts = useMemo(() => {
    if (!selectedWorkflow) {
      return {}
    }

    return Object.fromEntries(
      selectedWorkflow.artifacts.map((artifact) => {
        try {
          return [artifact.artifact_type, JSON.parse(artifact.content_json)]
        } catch {
          return [artifact.artifact_type, artifact.content_json]
        }
      }),
    ) as Record<string, unknown>
  }, [selectedWorkflow])

  const savedRouteOutput = parsedArtifacts.router_output as RouteOutput | undefined
  const savedSpecialistOutput = parsedArtifacts.specialist_output as SpecialistOutput | undefined
  const savedGeneratorOutput = parsedArtifacts.generator_output as GeneratorOutput | undefined
  const savedLatestCriticOutput = parsedArtifacts.critic_output as Partial<CriticOutput> | undefined
  const savedReviewOutput = selectedWorkflow?.reviews.length
    ? {
        review_status: selectedWorkflow.status,
        refine_attempts: selectedWorkflow.refine_attempts,
        max_refine_attempts: selectedWorkflow.max_refine_attempts,
      }
    : null

  const hasLiveData = Boolean(routeOutput || specialistOutput || generatorOutput || reviewOutput)
  const hasSavedData = Boolean(selectedWorkflow)

  useEffect(() => {
    if (inspectorSource === 'saved' && !hasSavedData) {
      setInspectorSource('live')
    }
  }, [hasSavedData, inspectorSource])

  const runStage = async () => {
    const missingPrerequisite = getMissingPrerequisite(activeStage)
    if (missingPrerequisite) {
      setError(missingPrerequisite)
      return
    }

    setLoading(true)
    setError(null)
    setInspectorSource('live')

    try {
      const payload = mode === 'file' ? { file: selectedFile } : { rawText }
      if (mode === 'file' && !selectedFile) {
        throw new Error('Choose a BRD file before running the pipeline.')
      }
      if (mode === 'text' && rawText.trim().length === 0) {
        throw new Error('Paste BRD text before running the pipeline.')
      }

      if (activeStage === 'route') {
        const result = await routeAnalysis(payload)
        setRouteOutput(result.data)
        setActiveLiveTab('router')
        setActiveStage('specialist')
        return
      }

      if (activeStage === 'specialist') {
        const result = await specialistAnalysis(payload)
        setSpecialistOutput(result.data)
        setActiveLiveTab('specialist')
        setActiveStage('generate')
        return
      }

      if (activeStage === 'generate') {
        const result = await generateStories(payload)
        setGeneratorOutput(result.data)
        setCurrentWorkflowId(result.workflowId ?? null)
        setActiveLiveTab('generator')
        await loadWorkflows(result.workflowId ?? null)
        setActiveStage('review')
        return
      }

      const result = await reviewStories(payload)
      setReviewOutput(result.data)
      setGeneratorOutput(result.data.generator_output)
      setCurrentWorkflowId(result.workflowId ?? null)
      setActiveLiveTab('review')
      await loadWorkflows(result.workflowId ?? null)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const actOnWorkflow = async (action: 'approve' | 'manual-review' | 'request-changes') => {
    if (!selectedWorkflowId) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      await updateWorkflowDecision(selectedWorkflowId, action, decisionComment)
      setDecisionComment('')
      await loadWorkflows(selectedWorkflowId)
      const updated = await fetchWorkflowDetail(selectedWorkflowId)
      setSelectedWorkflow(updated)
      setInspectorSource('saved')
      setActiveSavedTab('overview')
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Unable to update workflow')
    } finally {
      setLoading(false)
    }
  }

  const reworkSelectedWorkflow = async () => {
    if (!selectedWorkflowId) {
      return
    }
    if (!decisionComment.trim()) {
      setError('Add BA comments before reworking the workflow.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await reworkWorkflow(selectedWorkflowId, decisionComment)
      setDecisionComment('')
      setReviewOutput(result.data)
      setGeneratorOutput(result.data.generator_output)
      setCurrentWorkflowId(result.workflowId ?? selectedWorkflowId)
      setActiveStage('review')
      setActiveLiveTab('review')
      setInspectorSource('live')
      await loadWorkflows(selectedWorkflowId)
      const updated = await fetchWorkflowDetail(selectedWorkflowId)
      setSelectedWorkflow(updated)
    } catch (reworkError) {
      setError(reworkError instanceof Error ? reworkError.message : 'Unable to rework workflow')
    } finally {
      setLoading(false)
    }
  }

  const exportCurrentWorkflow = async (format: 'xlsx' | 'docx' | 'pdf') => {
    const targetWorkflowId = currentWorkflowId ?? selectedWorkflowId
    if (!targetWorkflowId) {
      setError('Generate or select a workflow before exporting.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await exportFromWorkflow(targetWorkflowId, format)
      await loadWorkflows(targetWorkflowId)
      const updated = await fetchWorkflowDetail(targetWorkflowId)
      setSelectedWorkflow(updated)
      setInspectorSource('saved')
      setActiveSavedTab('exports')
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const completionCount = [routeOutput, specialistOutput, generatorOutput, reviewOutput].filter(Boolean).length

  const liveTabs: Array<{ id: LiveTab; label: string; enabled: boolean }> = [
    { id: 'router', label: 'Router', enabled: Boolean(routeOutput) },
    { id: 'specialist', label: 'Specialist', enabled: Boolean(specialistOutput) },
    { id: 'generator', label: 'Stories', enabled: Boolean(generatorOutput) },
    { id: 'review', label: 'Critic', enabled: Boolean(reviewOutput) },
  ]

  const savedTabs: Array<{ id: SavedTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'stories', label: 'Stories' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'artifacts', label: 'Artifacts' },
    { id: 'exports', label: 'Exports' },
  ]

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f5f1e8_0%,_#fafaf9_28%,_#f3f4f6_100%)] text-stone-900">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-6 px-4 py-5 xl:flex-row xl:px-6">
        <aside className="w-full shrink-0 rounded-[2rem] border border-stone-200/80 bg-white/90 p-5 shadow-[0_24px_70px_-50px_rgba(28,25,23,0.55)] backdrop-blur xl:sticky xl:top-5 xl:h-[calc(100vh-2.5rem)] xl:w-[320px] xl:overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="rounded-[1.5rem] bg-stone-950 px-5 py-5 text-white">
              <p className="text-xs uppercase tracking-[0.32em] text-stone-300">BA Accelerator</p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight">
                Workflow workspace for BRD analysis and BA review.
              </h1>
              <p className="mt-3 text-sm leading-6 text-stone-300">
                Run the LangGraph pipeline on the right, and keep saved workflows close at hand here.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Backend</p>
                <p className="mt-2 text-sm font-semibold text-stone-950">
                  {health === 'healthy' ? 'Healthy' : health === 'offline' ? 'Offline' : 'Checking'}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Workflows</p>
                <p className="mt-2 text-sm font-semibold text-stone-950">{workflows.length}</p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setInspectorSource('live')
                }}
                className="flex-1 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                New Run
              </button>
              <button
                type="button"
                onClick={() =>
                  loadWorkflows(selectedWorkflowId).catch((loadError: Error) => setError(loadError.message))
                }
                className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-950"
              >
                Refresh
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-950">Saved Workflows</p>
                <p className="text-xs text-stone-500">Select one to review persisted artifacts and BA actions.</p>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {workflows.length > 0 ? (
                workflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    type="button"
                    onClick={() => {
                      setSelectedWorkflowId(workflow.id)
                      setInspectorSource('saved')
                      setActiveSavedTab('overview')
                      setError(null)
                    }}
                    className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                      selectedWorkflowId === workflow.id
                        ? 'border-stone-950 bg-stone-950 text-white shadow-sm'
                        : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{workflow.id.slice(0, 8)}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ring-1 ${
                          selectedWorkflowId === workflow.id
                            ? 'bg-white/15 text-white ring-white/25'
                            : statusClass(workflow.status)
                        }`}
                      >
                        {workflow.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className={`mt-3 text-xs ${selectedWorkflowId === workflow.id ? 'text-stone-300' : 'text-stone-500'}`}>
                      {workflow.target_stage} • {formatDate(workflow.created_at)}
                    </p>
                    <p className={`mt-1 text-xs ${selectedWorkflowId === workflow.id ? 'text-stone-400' : 'text-stone-400'}`}>
                      retries {workflow.refine_attempts}/{workflow.max_refine_attempts}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                  No workflows saved yet. Run generation or review to create one.
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <header className="rounded-[2rem] border border-stone-200/80 bg-white/90 p-6 shadow-[0_24px_70px_-50px_rgba(28,25,23,0.35)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">Workspace</p>
                <h2 className="mt-3 text-4xl font-semibold leading-tight text-stone-950">
                  Keep the pipeline focused, and move history into the sidebar where it belongs.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
                  This layout separates running a new BRD analysis from inspecting old workflows, so the screen feels like a workspace instead of a console dump.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[480px]">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Pipeline Progress</p>
                  <p className="mt-2 text-lg font-semibold text-stone-950">{completionCount} / 4</p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Active Stage</p>
                  <p className="mt-2 text-lg font-semibold text-stone-950">{stageMeta[activeStage].title}</p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Latest Workflow</p>
                  <p className="mt-2 text-sm font-semibold text-stone-950">
                    {(currentWorkflowId ?? selectedWorkflowId)?.slice(0, 8) ?? 'None yet'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_380px]">
            <section className="rounded-[2rem] border border-stone-200/80 bg-white/90 p-6 shadow-sm">
              <div className="flex flex-col gap-5 border-b border-stone-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-stone-950">Run Pipeline</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                    Use this workspace for the live run only. Saved workflow decisions and exports stay separate in the inspector.
                  </p>
                </div>
                <div className="inline-flex rounded-full border border-stone-200 bg-stone-100 p-1 text-sm">
                  {(['file', 'text'] as Mode[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={`rounded-full px-4 py-2 font-medium transition ${
                        mode === value ? 'bg-stone-950 text-white shadow-sm' : 'text-stone-600'
                      }`}
                    >
                      {value === 'file' ? 'File Upload' : 'Text Input'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
                <div className="space-y-5">
                  {mode === 'text' ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-stone-700">Raw BRD Text</span>
                      <textarea
                        value={rawText}
                        onChange={(event) => {
                          setRawText(event.target.value)
                          resetCurrentOutputs()
                        }}
                        rows={16}
                        placeholder="Paste the BRD content here..."
                        className="w-full rounded-[1.75rem] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500"
                      />
                    </label>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-14 text-center transition hover:border-amber-500 hover:bg-amber-50">
                      <span className="text-base font-semibold text-stone-900">Upload source BRD</span>
                      <span className="mt-2 max-w-sm text-sm leading-6 text-stone-500">
                        Supports txt, md, markdown, csv, eml, pdf, docx, xlsx, xlsm, and common image formats.
                      </span>
                      <span className="mt-6 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-medium text-white">
                        Choose file
                      </span>
                      <input
                        type="file"
                        accept=".txt,.md,.markdown,.csv,.eml,.pdf,.docx,.xlsx,.xlsm,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
                        className="hidden"
                        onChange={(event) => {
                          setSelectedFile(event.target.files?.[0] ?? null)
                          resetCurrentOutputs()
                        }}
                      />
                      {selectedFile ? (
                        <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-stone-700 shadow-sm">
                          {selectedFile.name}
                        </div>
                      ) : null}
                    </label>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-stone-700">Pipeline Stages</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                        Select the next stage to run
                      </p>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {stageOrder.map((stage, index) => {
                        const missingPrerequisite = getMissingPrerequisite(stage)
                        const completed =
                          (stage === 'route' && routeOutput) ||
                          (stage === 'specialist' && specialistOutput) ||
                          (stage === 'generate' && generatorOutput) ||
                          (stage === 'review' && reviewOutput)

                        return (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => selectStage(stage)}
                            className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                              activeStage === stage
                                ? 'border-stone-950 bg-stone-950 text-white shadow-sm'
                                : missingPrerequisite
                                  ? 'border-stone-200 bg-stone-50 opacity-80'
                                  : 'border-stone-200 bg-white hover:border-stone-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold uppercase tracking-[0.26em]">
                                Step 0{index + 1}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                                  activeStage === stage
                                    ? 'bg-white/15 text-white'
                                    : completed
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : missingPrerequisite
                                        ? 'bg-stone-200 text-stone-500'
                                        : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {completed ? 'done' : missingPrerequisite ? 'waiting' : 'ready'}
                              </span>
                            </div>
                            <p className={`mt-3 text-base font-semibold ${activeStage === stage ? 'text-white' : 'text-stone-950'}`}>
                              {stageMeta[stage].title}
                            </p>
                            <p className={`mt-2 text-sm leading-6 ${activeStage === stage ? 'text-stone-300' : 'text-stone-600'}`}>
                              {stageMeta[stage].description}
                            </p>
                            {stageMeta[stage].requiredOutput ? (
                              <p className={`mt-3 text-xs font-medium ${activeStage === stage ? 'text-stone-300' : missingPrerequisite ? 'text-rose-600' : 'text-emerald-700'}`}>
                                {missingPrerequisite ? stageMeta[stage].requiredOutput : 'Prerequisites satisfied.'}
                              </p>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                  <p className="text-sm font-semibold text-stone-950">Live Session</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    Treat this area as your working session. Run stages here, then inspect either the live outputs or the saved workflow.
                  </p>

                  <div className="mt-5 space-y-3">
                    {stageOrder.map((stage) => {
                      const complete =
                        (stage === 'route' && routeOutput) ||
                        (stage === 'specialist' && specialistOutput) ||
                        (stage === 'generate' && generatorOutput) ||
                        (stage === 'review' && reviewOutput)
                      return (
                        <div key={stage} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                              complete ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                            }`}
                          >
                            {complete ? 'OK' : '--'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-stone-900">{stageMeta[stage].title}</p>
                            <p className="text-xs text-stone-500">{stageMeta[stage].description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={runStage}
                    className="mt-6 w-full rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_28px_-18px_rgba(28,25,23,0.8)] transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    {loading ? 'Running...' : `Run ${stageMeta[activeStage].title}`}
                  </button>
                </div>
              </div>
            </section>

            <aside className="rounded-[2rem] border border-stone-200/80 bg-white/90 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-stone-950">Review Actions</h3>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    BA controls stay focused here instead of mixing with the live pipeline form.
                  </p>
                </div>
                {selectedWorkflow ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ring-1 ${statusClass(selectedWorkflow.status)}`}
                  >
                    {selectedWorkflow.status.replaceAll('_', ' ')}
                  </span>
                ) : null}
              </div>

              {selectedWorkflow ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Selected Workflow</p>
                    <p className="mt-2 text-lg font-semibold text-stone-950">
                      {selectedWorkflow.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      {selectedWorkflow.document?.original_filename ??
                        selectedWorkflow.document?.source_type ??
                        'text input'}
                    </p>
                    <p className="mt-3 text-xs text-stone-500">
                      created {formatDate(selectedWorkflow.created_at)}
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-stone-700">BA Comment</span>
                    <textarea
                      value={decisionComment}
                      onChange={(event) => setDecisionComment(event.target.value)}
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 focus:border-amber-500 focus:outline-none"
                      placeholder="Add a reviewer comment for approval, rework, or manual review."
                    />
                  </label>

                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => actOnWorkflow('approve')}
                      className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      BA Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => actOnWorkflow('request-changes')}
                      className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-400"
                    >
                      Request Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => actOnWorkflow('manual-review')}
                      className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500"
                    >
                      Mark Manual Review
                    </button>
                    <button
                      type="button"
                      onClick={reworkSelectedWorkflow}
                      className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                    >
                      Rework Workflow
                    </button>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-stone-900">Quick Exports</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(['xlsx', 'docx', 'pdf'] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => exportCurrentWorkflow(format)}
                          className="rounded-2xl border border-stone-300 bg-white px-3 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-stone-800">No saved workflow selected</p>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Pick a workflow from the left when you want to review persisted outputs or take BA actions.
                  </p>
                </div>
              )}
            </aside>
          </div>

          <section className="rounded-[2rem] border border-stone-200/80 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-stone-950">Inspector</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Switch between the live pipeline session and the selected saved workflow without stacking every output on the same page.
                </p>
              </div>

              <div className="inline-flex rounded-full border border-stone-200 bg-stone-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setInspectorSource('live')}
                  className={`rounded-full px-4 py-2 font-medium transition ${
                    inspectorSource === 'live' ? 'bg-stone-950 text-white shadow-sm' : 'text-stone-600'
                  }`}
                >
                  Live Run
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (hasSavedData) {
                      setInspectorSource('saved')
                    }
                  }}
                  className={`rounded-full px-4 py-2 font-medium transition ${
                    inspectorSource === 'saved'
                      ? 'bg-stone-950 text-white shadow-sm'
                      : hasSavedData
                        ? 'text-stone-600'
                        : 'cursor-not-allowed text-stone-400'
                  }`}
                >
                  Saved Workflow
                </button>
              </div>
            </div>

            {inspectorSource === 'live' ? (
              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  {liveTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        if (tab.enabled) {
                          setActiveLiveTab(tab.id)
                        }
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        activeLiveTab === tab.id
                          ? 'bg-stone-950 text-white'
                          : tab.enabled
                            ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            : 'cursor-not-allowed bg-stone-100 text-stone-400'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {!hasLiveData ? (
                  <EmptyState
                    title="No live output yet"
                    description="Start with a file upload or raw text, run the Router stage, and the live inspector will fill itself in stage by stage."
                  />
                ) : null}

                {hasLiveData && activeLiveTab === 'router' ? (
                  routeOutput ? (
                    <div className="rounded-[1.75rem] border border-sky-200 bg-sky-50/70 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-lg font-semibold text-stone-950">Router Output</h4>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                          {routeOutput.brd_type}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-700">{routeOutput.extracted_intent}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-stone-500">
                        Confidence {routeOutput.confidence.toFixed(2)}
                      </p>
                      <div className="mt-4 grid gap-3">
                        {routeOutput.ambiguities.map((ambiguity) => (
                          <div key={ambiguity} className="rounded-2xl bg-white px-4 py-3 text-sm text-stone-700">
                            {ambiguity}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="Router output is empty"
                      description="Run the Router stage first to see classification, intent, and ambiguity notes."
                    />
                  )
                ) : null}

                {hasLiveData && activeLiveTab === 'specialist' ? (
                  specialistOutput ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {([
                        ['Actors', specialistOutput.actors],
                        ['Goals', specialistOutput.goals],
                        ['Constraints', specialistOutput.constraints],
                        ['Edge Cases', specialistOutput.edge_cases],
                      ] as Array<[string, string[]]>).map(([title, items]) => (
                        <div key={title} className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                          <h4 className="text-base font-semibold text-stone-950">{title}</h4>
                          <ul className="mt-3 space-y-2 text-sm text-stone-700">
                            {items.map((item) => (
                              <li key={item} className="rounded-2xl bg-white px-3 py-3">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Specialist output is empty"
                      description="Run the Specialist stage after the Router to extract actors, goals, constraints, and edge cases."
                    />
                  )
                ) : null}

                {hasLiveData && activeLiveTab === 'generator' ? (
                  generatorOutput ? (
                    <StoryTable output={generatorOutput} />
                  ) : (
                    <EmptyState
                      title="Generated stories are empty"
                      description="Run the Generator stage after the Specialist output is ready."
                    />
                  )
                ) : null}

                {hasLiveData && activeLiveTab === 'review' ? (
                  reviewOutput ? (
                    <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/70 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-lg font-semibold text-stone-950">Critic Review</h4>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ring-1 ${statusClass(reviewOutput.review_status)}`}
                        >
                          {reviewOutput.review_status.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-700">
                        {reviewOutput.latest_critic_output.summary}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-stone-500">
                        Package confidence {(reviewOutput.latest_critic_output.package_confidence * 100).toFixed(0)}% • Refinement attempts {reviewOutput.refine_attempts} / {reviewOutput.max_refine_attempts}
                      </p>
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-sm font-semibold text-stone-900">Issues</p>
                          <ul className="mt-3 space-y-2 text-sm text-stone-700">
                            {reviewOutput.latest_critic_output.issues.length > 0 ? (
                              reviewOutput.latest_critic_output.issues.map((issue) => <li key={issue}>{issue}</li>)
                            ) : (
                              <li>No critic issues remain.</li>
                            )}
                          </ul>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-sm font-semibold text-stone-900">Next Steps</p>
                          <ul className="mt-3 space-y-2 text-sm text-stone-700">
                            {reviewOutput.recommended_next_steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        {reviewOutput.latest_critic_output.story_reviews.map((storyReview) => (
                          <div key={storyReview.us_id} className="rounded-2xl bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-stone-900">{storyReview.us_id}</p>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                                storyReview.status === 'pass'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : storyReview.status === 'needs_clarification'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-rose-100 text-rose-700'
                              }`}>
                                {storyReview.status.replaceAll('_', ' ')}
                              </span>
                            </div>
                            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                              Confidence {(storyReview.confidence * 100).toFixed(0)}%
                            </p>
                            <p className="mt-2 text-sm leading-6 text-stone-700">{storyReview.summary}</p>
                            {storyReview.clarification_questions.length > 0 ? (
                              <div className="mt-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Clarifications</p>
                                <ul className="mt-2 space-y-2 text-sm text-stone-700">
                                  {storyReview.clarification_questions.map((question) => (
                                    <li key={question}>{question}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {storyReview.revision_instructions.length > 0 ? (
                              <div className="mt-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Revisions</p>
                                <ul className="mt-2 space-y-2 text-sm text-stone-700">
                                  {storyReview.revision_instructions.map((instruction) => (
                                    <li key={instruction}>{instruction}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="Critic output is empty"
                      description="Run the full review stage after stories are generated to inspect the critic verdict and next steps."
                    />
                  )
                ) : null}
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  {savedTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveSavedTab(tab.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        activeSavedTab === tab.id
                          ? 'bg-stone-950 text-white'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {!selectedWorkflow ? (
                  <EmptyState
                    title="No saved workflow selected"
                    description="Choose a workflow from the sidebar to inspect stored outputs, reviews, exports, and BA decision history."
                  />
                ) : null}

                {selectedWorkflow && activeSavedTab === 'overview' ? (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
                    <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Document</p>
                          <h4 className="mt-2 text-xl font-semibold text-stone-950">
                            {selectedWorkflow.document?.original_filename ?? 'Text submission'}
                          </h4>
                          <p className="mt-2 text-sm text-stone-600">
                            {selectedWorkflow.document?.media_type ?? selectedWorkflow.document?.source_type ?? 'text'}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ring-1 ${statusClass(selectedWorkflow.status)}`}
                        >
                          {selectedWorkflow.status.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Artifacts</p>
                          <p className="mt-2 text-lg font-semibold text-stone-950">{selectedWorkflow.artifacts.length}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Reviews</p>
                          <p className="mt-2 text-lg font-semibold text-stone-950">{selectedWorkflow.reviews.length}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Exports</p>
                          <p className="mt-2 text-lg font-semibold text-stone-950">{selectedWorkflow.exports.length}</p>
                        </div>
                      </div>
                      <div className="mt-5 rounded-[1.5rem] bg-white p-4">
                        <p className="text-sm font-semibold text-stone-900">Parsed Source Preview</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                          {selectedWorkflow.document?.parsed_text.slice(0, 1200) ?? 'No parsed text stored.'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {savedRouteOutput ? (
                        <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4">
                          <p className="text-sm font-semibold text-stone-900">Router Snapshot</p>
                          <p className="mt-2 text-sm text-stone-600">{savedRouteOutput.extracted_intent}</p>
                        </div>
                      ) : null}
                      {savedSpecialistOutput ? (
                        <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4">
                          <p className="text-sm font-semibold text-stone-900">Specialist Snapshot</p>
                          <p className="mt-2 text-sm text-stone-600">
                            {savedSpecialistOutput.actors.length} actors • {savedSpecialistOutput.goals.length} goals • {savedSpecialistOutput.edge_cases.length} edge cases
                          </p>
                        </div>
                      ) : null}
                      {savedReviewOutput ? (
                        <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4">
                          <p className="text-sm font-semibold text-stone-900">Critic Summary</p>
                          <p className="mt-2 text-sm text-stone-600">
                            {savedReviewOutput.refine_attempts} / {savedReviewOutput.max_refine_attempts} refinement attempts used.
                          </p>
                          {savedLatestCriticOutput?.story_reviews ? (
                            <p className="mt-2 text-sm text-stone-600">
                              {savedLatestCriticOutput.story_reviews.filter((review) => review.status === 'pass').length} passed • {savedLatestCriticOutput.story_reviews.filter((review) => review.status !== 'pass').length} flagged
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {selectedWorkflow && activeSavedTab === 'stories' ? (
                  savedGeneratorOutput ? (
                    <StoryTable output={savedGeneratorOutput} />
                  ) : (
                    <EmptyState
                      title="No generator artifact saved"
                      description="This workflow does not yet have a persisted generator output artifact."
                    />
                  )
                ) : null}

                {selectedWorkflow && activeSavedTab === 'reviews' ? (
                  selectedWorkflow.reviews.length > 0 ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {selectedWorkflow.reviews.map((review) => (
                        <div key={review.id} className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-stone-900">Attempt {review.attempt_number}</span>
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-600 ring-1 ring-stone-200">
                              {review.verdict}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-stone-700">{review.summary}</p>
                          {review.issues.length > 0 ? (
                            <div className="mt-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Issues</p>
                              <ul className="mt-2 space-y-2 text-sm text-stone-700">
                                {review.issues.map((issue) => (
                                  <li key={issue}>{issue}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No critic history saved"
                      description="Run the review pipeline to persist critic attempts and revision feedback."
                    />
                  )
                ) : null}

                {selectedWorkflow && activeSavedTab === 'artifacts' ? (
                  selectedWorkflow.artifacts.length > 0 ? (
                    <div className="space-y-3">
                      {selectedWorkflow.artifacts.map((artifact) => (
                        <ArtifactPanel key={artifact.id} artifact={artifact} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No artifacts saved"
                      description="Persisted router, specialist, generator, and critic artifacts will appear here."
                    />
                  )
                ) : null}

                {selectedWorkflow && activeSavedTab === 'exports' ? (
                  selectedWorkflow.exports.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {selectedWorkflow.exports.map((exportItem) => (
                        <button
                          key={exportItem.id}
                          type="button"
                          onClick={() =>
                            downloadSavedExport(selectedWorkflow.id, exportItem.id).catch((downloadError: Error) =>
                              setError(downloadError.message),
                            )
                          }
                          className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-left transition hover:border-stone-300 hover:bg-white"
                        >
                          <p className="text-sm font-semibold text-stone-900">
                            {exportItem.export_format.toUpperCase()}
                          </p>
                          <p className="mt-2 text-sm text-stone-600 break-all">{exportItem.storage_path}</p>
                          <p className="mt-3 text-xs text-stone-500">{formatDate(exportItem.created_at)}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No exports saved"
                      description="Create a PDF, DOCX, or XLSX export from the review actions panel and it will appear here."
                    />
                  )
                ) : null}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
