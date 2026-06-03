-- ───────────────────────────────────────────────────────────────────────
-- Sprint 12b — Guided study sessions (evidence-based pre-quiz didactic flow)
--
-- A "study session" is one trajectory through a document under a chosen
-- mode (Pomodoro / Deep Work / Feynman / Quick Review). Each mode toggles
-- which evidence-based steps run (pre-training of key terms is universal;
-- elaborative interrogation, self-explanation, retrieval check, and
-- concept-map construction switch on per mode).
--
-- The session row caches the AI-generated study guide content (key terms,
-- advance organizer, concept map nodes) so resuming a session doesn't
-- re-spend tokens, and stores per-chunk progress so we can resume
-- mid-document.
-- ───────────────────────────────────────────────────────────────────────

create table public.study_sessions (
  id                        uuid primary key default uuid_generate_v4(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  document_id               uuid not null references public.documents(id) on delete cascade,
  mode                      text not null
                              check (mode in ('pomodoro','deep_work','feynman','quick_review')),
  status                    text not null default 'active'
                              check (status in ('active','completed','abandoned')),
  current_step              text not null default 'pre_study'
                              check (current_step in ('pre_study','chunks','concept_map','completed')),
  current_chunk_index       integer not null default 0,
  -- Cached AI artifacts so the same session reuses content on resume.
  -- key_terms shape: [{ term, definition, why_it_matters }]
  -- concept_map_nodes shape: [{ id, label }]
  key_terms                 jsonb,
  advance_organizer         text,
  schema_activation_answer  text,
  concept_map_nodes         jsonb,
  concept_map_edges         jsonb, -- student-constructed edges
  started_at                timestamptz not null default now(),
  last_active_at            timestamptz not null default now(),
  completed_at              timestamptz
);
create index study_sessions_user_doc_idx on public.study_sessions(user_id, document_id);
create index study_sessions_active_idx on public.study_sessions(user_id) where status = 'active';

-- One row per (session, chunk) that the student visits. Records the
-- AI-generated prompts (cached) plus the student's answers.
create table public.study_session_chunks (
  session_id              uuid not null references public.study_sessions(id) on delete cascade,
  chunk_index             integer not null,
  document_chunk_id       uuid references public.document_chunks(id) on delete set null,
  -- AI-generated prompts for this chunk (cached on first visit).
  elaborative_question    text,
  retrieval_question      jsonb, -- { prompt, options:[{label,text}], correct_label, explanation }
  -- Student responses.
  elaborative_answer      text,
  self_explanation_answer text,
  self_explanation_score  integer, -- 0..5 from the grader
  self_explanation_feedback text,
  retrieval_selected_label text,
  retrieval_is_correct    boolean,
  retrieval_attempts      integer not null default 0,
  visited_at              timestamptz not null default now(),
  completed_at            timestamptz,
  primary key (session_id, chunk_index)
);

-- ─── RLS ───────────────────────────────────────────────────────────────
alter table public.study_sessions enable row level security;
alter table public.study_session_chunks enable row level security;

create policy study_sessions_select_own on public.study_sessions
  for select using (auth.uid() = user_id);
create policy study_sessions_insert_own on public.study_sessions
  for insert with check (auth.uid() = user_id);
create policy study_sessions_update_own on public.study_sessions
  for update using (auth.uid() = user_id);
create policy study_sessions_delete_own on public.study_sessions
  for delete using (auth.uid() = user_id);

-- Children: scope via parent session ownership.
create policy study_session_chunks_select_via_session on public.study_session_chunks
  for select using (
    exists (
      select 1 from public.study_sessions s
      where s.id = study_session_chunks.session_id and s.user_id = auth.uid()
    )
  );
