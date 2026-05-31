-- ───────────────────────────────────────────────────────────────────────
-- Quizen — RLS policies
-- Default-deny: enable RLS on every table, then add per-operation policies
-- scoped to `auth.uid() = user_id` (or to the parent row's user_id for
-- child tables like document_chunks, questions, answers).
-- Server-only writes (e.g. document_chunks, subscriptions) use the
-- service_role key in API routes and bypass RLS entirely.
-- ───────────────────────────────────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.documents         enable row level security;
alter table public.document_chunks   enable row level security;
alter table public.quizzes           enable row level security;
alter table public.questions         enable row level security;
alter table public.attempts          enable row level security;
alter table public.answers           enable row level security;
alter table public.srs_cards         enable row level security;
alter table public.subscriptions     enable row level security;

-- ─── profiles ──────────────────────────────────────────────────────────
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

-- ─── documents ─────────────────────────────────────────────────────────
create policy documents_select_own on public.documents
  for select using (auth.uid() = user_id);
create policy documents_insert_own on public.documents
  for insert with check (auth.uid() = user_id);
create policy documents_update_own on public.documents
  for update using (auth.uid() = user_id);
create policy documents_delete_own on public.documents
  for delete using (auth.uid() = user_id);

-- ─── document_chunks ───────────────────────────────────────────────────
-- Visible only when the parent document is yours. Writes go through the
-- service_role from /api/pdf/extract.
create policy document_chunks_select_via_document on public.document_chunks
  for select using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id and d.user_id = auth.uid()
    )
  );

-- ─── quizzes ───────────────────────────────────────────────────────────
create policy quizzes_select_own on public.quizzes
  for select using (auth.uid() = user_id);
create policy quizzes_insert_own on public.quizzes
  for insert with check (auth.uid() = user_id);
create policy quizzes_delete_own on public.quizzes
  for delete using (auth.uid() = user_id);

-- ─── questions ─────────────────────────────────────────────────────────
-- Visible only when the parent quiz is yours. Writes through service_role.
create policy questions_select_via_quiz on public.questions
  for select using (
    exists (
      select 1 from public.quizzes q
      where q.id = questions.quiz_id and q.user_id = auth.uid()
    )
  );

-- ─── attempts ──────────────────────────────────────────────────────────
create policy attempts_select_own on public.attempts
  for select using (auth.uid() = user_id);
create policy attempts_insert_own on public.attempts
  for insert with check (auth.uid() = user_id);
create policy attempts_update_own on public.attempts
  for update using (auth.uid() = user_id);

-- ─── answers ───────────────────────────────────────────────────────────
-- Read/write via the parent attempt's owner.
create policy answers_select_via_attempt on public.answers
  for select using (
    exists (
      select 1 from public.attempts a
      where a.id = answers.attempt_id and a.user_id = auth.uid()
    )
  );
create policy answers_insert_via_attempt on public.answers
  for insert with check (
    exists (
      select 1 from public.attempts a
      where a.id = answers.attempt_id and a.user_id = auth.uid()
    )
  );
create policy answers_update_via_attempt on public.answers
  for update using (
    exists (
      select 1 from public.attempts a
      where a.id = answers.attempt_id and a.user_id = auth.uid()
    )
  );

-- ─── srs_cards ─────────────────────────────────────────────────────────
create policy srs_cards_select_own on public.srs_cards
  for select using (auth.uid() = user_id);
create policy srs_cards_insert_own on public.srs_cards
  for insert with check (auth.uid() = user_id);
create policy srs_cards_update_own on public.srs_cards
  for update using (auth.uid() = user_id);

-- ─── subscriptions ─────────────────────────────────────────────────────
-- Read-only from the client. Stripe webhook updates via service_role.
create policy subscriptions_select_own on public.subscriptions
  for select using (auth.uid() = user_id);
