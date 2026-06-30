export type RouteOutput = {
  brd_type: string
  confidence: number
  extracted_intent: string
  ambiguities: string[]
  suggested_specialist: string
}

export type SpecialistOutput = {
  actors: string[]
  goals: string[]
  constraints: string[]
  acceptance_criteria: string[]
  edge_cases: string[]
}

export type UserStoryRow = {
  serial_number: number
  epic: string
  feature: string
  us_id: string
  us_summary: string
  user_story_description: string
  acceptance_criteria: string[]
  business_rules: string[]
  dependencies: string[]
  state: string
  comments: string | null
  reference_link: string | null
}

export type GeneratorOutput = {
  document_title: string
  story_id_prefix: string
  stories: UserStoryRow[]
}

export type CriticOutput = {
  verdict: 'pass' | 'fail'
  summary: string
  issues: string[]
  revision_instructions: string[]
}

export type WorkflowReviewOutput = {
  review_status: 'pending_ba_review' | 'needs_manual_review'
  refine_attempts: number
  max_refine_attempts: number
  generator_output: GeneratorOutput
  latest_critic_output: CriticOutput
  critic_history: CriticOutput[]
  recommended_next_steps: string[]
}

export type WorkflowSummary = {
  id: string
  status: string
  target_stage: string
  refine_attempts: number
  max_refine_attempts: number
  document_id: string | null
  created_at: string
  updated_at: string
}

export type ArtifactRecord = {
  id: string
  artifact_type: string
  content_json: string
  created_at: string
}

export type ReviewAttemptRecord = {
  id: string
  attempt_number: number
  verdict: string
  summary: string
  issues: string[]
  revision_instructions: string[]
  created_at: string
}

export type ExportRecord = {
  id: string
  export_format: string
  storage_path: string
  created_at: string
}

export type DocumentRecord = {
  id: string
  source_type: string
  original_filename: string | null
  media_type: string | null
  storage_path: string | null
  parsed_text: string
  created_at: string
}

export type WorkflowDetail = WorkflowSummary & {
  document: DocumentRecord | null
  artifacts: ArtifactRecord[]
  reviews: ReviewAttemptRecord[]
  exports: ExportRecord[]
}
