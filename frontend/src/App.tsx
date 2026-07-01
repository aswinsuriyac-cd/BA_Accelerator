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
  GeneratorOutput,
  RouteOutput,
  SpecialistOutput,
  WorkflowDetail,
  WorkflowReviewOutput,
  WorkflowSummary,
} from './types'

type Mode = 'text' | 'file'
type Stage = 'route' | 'specialist' | 'generate' | 'review'

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
    description: 'Produce the workbook-style story package and assign IDs.',
    requiredOutput: 'Needs Specialist output first.',
  },
  review: {
    title: 'Critic + BA Gate',
    description: 'Run critic review and send successful outputs into BA review.',
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

function ArtifactPanel({ artifact }: { artifact: ArtifactRecord }) {
  return (
    <details className="rounded-2xl border border-stone-200 bg-white/85 p-4 shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none text-sm font-semibold text-stone-900">
        {artifact.artifact_type.replaceAll('_', ' ')}
        <span className="ml-2 text-xs font-normal text-stone-500">
          {new Date(artifact.created_at).toLocaleString()}
        </span>
      </summary>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-stone-950 p-4 text-xs text-stone-100">
        {artifact.content_json}
      </pre>
    </details>
  )
}

function StoryTable({ output }: { output: GeneratorOutput }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
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
              <tr
                key={story.us_id}
                className={index % 2 === 0 ? 'bg-white' : 'bg-stone-50/70'}
              >
                <td className="align-top px-4 py-4 font-semibold text-stone-900">{story.us_id}</td>
                <td className="align-top px-4 py-4">
                  <p className="font-medium text-stone-900">{story.us_summary}</p>
                  <p className="mt-2 text-xs leading-5 text-stone-600">
                    {story.user_story_description}
                  </p>
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
  const [mode, setMode] = useState<Mode>('text')
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

  const resetCurrentOutputs = () => {
    setRouteOutput(null)
    setSpecialistOutput(null)
    setGeneratorOutput(null)
    setReviewOutput(null)
    setCurrentWorkflowId(null)
    setActiveStage('route')
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

  const runStage = async () => {
    const missingPrerequisite = getMissingPrerequisite(activeStage)
    if (missingPrerequisite) {
      setError(missingPrerequisite)
      return
    }

    setLoading(true)
    setError(null)

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
        setActiveStage('specialist')
        return
      }

      if (activeStage === 'specialist') {
        const result = await specialistAnalysis(payload)
        setSpecialistOutput(result.data)
        setActiveStage('generate')
        return
      }

      if (activeStage === 'generate') {
        const result = await generateStories(payload)
        setGeneratorOutput(result.data)
        setCurrentWorkflowId(result.workflowId ?? null)
        await loadWorkflows(result.workflowId ?? null)
        setActiveStage('review')
        return
      }

      const result = await reviewStories(payload)
      setReviewOutput(result.data)
      setGeneratorOutput(result.data.generator_output)
      setCurrentWorkflowId(result.workflowId ?? null)
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
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(253,224,71,0.24),_transparent_32%),linear-gradient(180deg,_#f7f3ea_0%,_#f8fafc_46%,_#ede7da_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-4 py-6 lg:px-8">
        <header className="rounded-[2rem] border border-stone-200/70 bg-white/80 p-6 shadow-[0_20px_70px_-45px_rgba(41,37,36,0.6)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-700">
                BA Accelerator
              </p>
              <h1 className="mt-3 font-serif text-4xl leading-tight text-stone-950 md:text-5xl">
                Multi-agent BRD refinement with BA-ready review gates.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 md:text-base">
                Parse requirement documents, run the LangGraph pipeline, inspect critic output,
                and hand only machine-reviewed stories to the BA for final approval.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Backend</p>
                <p className="mt-2 text-lg font-semibold text-stone-950">
                  {health === 'healthy' ? 'Healthy' : health === 'offline' ? 'Offline' : 'Checking'}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Saved Workflows</p>
                <p className="mt-2 text-lg font-semibold text-stone-950">{workflows.length}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Latest Workflow</p>
                <p className="mt-2 text-sm font-semibold text-stone-950">
                  {currentWorkflowId ? currentWorkflowId.slice(0, 8) : 'None yet'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid flex-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)_380px]">
          <section className="rounded-[2rem] border border-stone-200/70 bg-white/85 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-950">Run Pipeline</h2>
              <div className="inline-flex rounded-full border border-stone-200 bg-stone-100 p-1 text-sm">
                {(['text', 'file'] as Mode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-full px-4 py-2 font-medium transition ${
                      mode === value ? 'bg-stone-950 text-white shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    {value === 'text' ? 'Text Input' : 'File Upload'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {mode === 'text' ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">Raw BRD Text</span>
                  <textarea
                    value={rawText}
                    onChange={(event) => {
                      setRawText(event.target.value)
                      resetCurrentOutputs()
                    }}
                    rows={15}
                    placeholder="Paste the BRD content here..."
                    className="w-full rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-900 outline-none ring-0 transition placeholder:text-stone-400 focus:border-amber-500"
                  />
                </label>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center transition hover:border-amber-500 hover:bg-amber-50">
                  <span className="text-sm font-semibold text-stone-900">Upload BRD file</span>
                  <span className="mt-2 text-sm text-stone-500">Supports txt, md, pdf, docx</span>
                  <span className="mt-5 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white">
                    Choose file
                  </span>
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.docx"
                    className="hidden"
                    onChange={(event) => {
                      setSelectedFile(event.target.files?.[0] ?? null)
                      resetCurrentOutputs()
                    }}
                  />
                  {selectedFile ? (
                    <span className="mt-4 text-sm text-stone-700">{selectedFile.name}</span>
                  ) : null}
                </label>
              )}

              <div>
                <p className="text-sm font-medium text-stone-700">Stage</p>
                <div className="mt-3 grid gap-3">
                  {stageOrder.map((stage) => {
                    const missingPrerequisite = getMissingPrerequisite(stage)
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => selectStage(stage)}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          activeStage === stage
                            ? 'border-amber-500 bg-amber-50 shadow-sm'
                            : missingPrerequisite
                              ? 'border-stone-200 bg-stone-50 opacity-75'
                              : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-stone-950">
                            {stageMeta[stage].title}
                          </span>
                          <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
                            {missingPrerequisite ? 'waiting' : stage}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {stageMeta[stage].description}
                        </p>
                        {stageMeta[stage].requiredOutput ? (
                          <p className={`mt-2 text-xs font-medium ${missingPrerequisite ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {missingPrerequisite ? stageMeta[stage].requiredOutput : 'Previous output is ready.'}
                          </p>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={runStage}
                className="w-full rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_28px_-18px_rgba(28,25,23,0.8)] transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {loading ? 'Running…' : `Run ${stageMeta[activeStage].title}`}
              </button>
            </div>
          </section>

          <section className="space-y-6 rounded-[2rem] border border-stone-200/70 bg-white/85 p-6 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-950">Current Output</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Review the latest stage response and export the persisted workflow when ready.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['xlsx', 'docx', 'pdf'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => exportCurrentWorkflow(format)}
                    disabled={loading || !(currentWorkflowId ?? selectedWorkflowId)}
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Export {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {routeOutput ? (
              <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-stone-950">Router Output</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                    {routeOutput.brd_type}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700">{routeOutput.extracted_intent}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-stone-500">
                  Confidence {routeOutput.confidence.toFixed(2)}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-stone-700">
                  {routeOutput.ambiguities.map((ambiguity) => (
                    <li key={ambiguity} className="rounded-2xl bg-white px-3 py-3">
                      {ambiguity}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {specialistOutput ? (
              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ['Actors', specialistOutput.actors],
                  ['Goals', specialistOutput.goals],
                  ['Constraints', specialistOutput.constraints],
                  ['Edge Cases', specialistOutput.edge_cases],
                ] as Array<[string, string[]]>).map(([title, items]) => (
                  <div key={title} className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                    <h3 className="text-base font-semibold text-stone-950">{title}</h3>
                    <ul className="mt-3 space-y-2 text-sm text-stone-700">
                      {(items as string[]).map((item) => (
                        <li key={item} className="rounded-2xl bg-white px-3 py-3">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}

            {generatorOutput ? <StoryTable output={generatorOutput} /> : null}

            {reviewOutput ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-stone-950">Critic Review</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ring-1 ${statusClass(reviewOutput.review_status)}`}>
                    {reviewOutput.review_status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700">
                  {reviewOutput.latest_critic_output.summary}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-stone-500">
                  Refinement attempts {reviewOutput.refine_attempts} / {reviewOutput.max_refine_attempts}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-sm font-semibold text-stone-900">Issues</p>
                    <ul className="mt-3 space-y-2 text-sm text-stone-700">
                      {reviewOutput.latest_critic_output.issues.length > 0 ? (
                        reviewOutput.latest_critic_output.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))
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
              </div>
            ) : null}

            {!routeOutput && !specialistOutput && !generatorOutput && !reviewOutput ? (
              <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center text-sm text-stone-500">
                Run any stage to populate the result canvas.
              </div>
            ) : null}
          </section>

          <section className="rounded-[2rem] border border-stone-200/70 bg-white/85 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-950">Workflow Console</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Reopen persisted runs, inspect artifacts, and complete the BA gate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadWorkflows(selectedWorkflowId).catch((loadError: Error) => setError(loadError.message))}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {workflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    type="button"
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      selectedWorkflowId === workflow.id
                        ? 'border-stone-950 bg-stone-950 text-white shadow-sm'
                        : 'border-stone-200 bg-stone-50 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{workflow.id.slice(0, 8)}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ring-1 ${
                          selectedWorkflowId === workflow.id ? 'bg-white/15 text-white ring-white/30' : statusClass(workflow.status)
                        }`}
                      >
                        {workflow.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className={`mt-2 text-xs ${selectedWorkflowId === workflow.id ? 'text-stone-200' : 'text-stone-500'}`}>
                      {workflow.target_stage} • {new Date(workflow.created_at).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>

              {selectedWorkflow ? (
                <div className="space-y-4 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-stone-950">
                        Workflow {selectedWorkflow.id.slice(0, 8)}
                      </h3>
                      <p className="mt-1 text-sm text-stone-600">
                        Source {selectedWorkflow.document?.original_filename ?? selectedWorkflow.document?.source_type ?? 'text'}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ring-1 ${statusClass(selectedWorkflow.status)}`}>
                      {selectedWorkflow.status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-stone-700">BA Comment</span>
                    <textarea
                      value={decisionComment}
                      onChange={(event) => setDecisionComment(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 focus:border-amber-500 focus:outline-none"
                      placeholder="Add optional BA note before updating the workflow state."
                    />
                  </label>

                  <div className="grid gap-2 sm:grid-cols-4">
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
                      Manual Review
                    </button>
                    <button
                      type="button"
                      onClick={reworkSelectedWorkflow}
                      className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                    >
                      Rework
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {(['xlsx', 'docx', 'pdf'] as const).map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => exportCurrentWorkflow(format)}
                        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
                      >
                        Build {format.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {selectedWorkflow.exports.length > 0 ? (
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className="text-sm font-semibold text-stone-900">Saved Exports</p>
                      <div className="mt-3 space-y-2">
                        {selectedWorkflow.exports.map((exportItem) => (
                          <button
                            key={exportItem.id}
                            type="button"
                            onClick={() => downloadSavedExport(selectedWorkflow.id, exportItem.id).catch((downloadError: Error) => setError(downloadError.message))}
                            className="flex w-full items-center justify-between rounded-2xl bg-stone-50 px-3 py-3 text-left text-sm text-stone-700 transition hover:bg-stone-100"
                          >
                            <span>{exportItem.export_format.toUpperCase()}</span>
                            <span className="text-xs text-stone-500">
                              {new Date(exportItem.created_at).toLocaleString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {selectedWorkflow.artifacts.map((artifact) => (
                      <ArtifactPanel key={artifact.id} artifact={artifact} />
                    ))}
                  </div>

                  {selectedWorkflow.reviews.length > 0 ? (
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className="text-sm font-semibold text-stone-900">Critic History</p>
                      <div className="mt-3 space-y-3">
                        {selectedWorkflow.reviews.map((review) => (
                          <div key={review.id} className="rounded-2xl bg-stone-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-stone-900">
                                Attempt {review.attempt_number}
                              </span>
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-600 ring-1 ring-stone-200">
                                {review.verdict}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-stone-700">{review.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {parsedArtifacts.generator_output ? (
                    <StoryTable output={parsedArtifacts.generator_output as GeneratorOutput} />
                  ) : null}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-4 py-12 text-center text-sm text-stone-500">
                  Select a saved workflow to inspect persisted artifacts and BA actions.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
