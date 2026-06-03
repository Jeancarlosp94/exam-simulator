-- ───────────────────────────────────────────────────────────────────────
-- Sprint 10 — Public quiz shares
--
-- Each row maps a short, URL-safe slug to a quiz that the owner has opted
-- to publish. Anyone with the slug can open `/q/<slug>` and take the
-- quiz in demo mode (no progress saved, no SRS cards created). Owners
-- can revoke a share by deleting the row.
--
-- RLS: writes scoped to owner; selects are public — that's the whole point.
-- ───────────────────────────────────────────────────────────────────────

create table public.public_quiz_shares (
  slug         text primary key,
  quiz_id      uuid not null references public.quizzes(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  view_count   integer not null default 0,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index public_quiz_shares_quiz_id_idx on public.public_quiz_shares(quiz_id);
create index public_quiz_shares_created_by_idx on public.public_quiz_shares(created_by);

alter table public.public_quiz_shares enable row level security;

-- Owner-only writes.
create policy public_shares_insert_own on public.public_quiz_shares
  for insert with check (auth.uid() = created_by);

create policy public_shares_delete_own on public.public_quiz_shares
  for delete using (auth.uid() = created_by);

-- Selects are intentionally public — a share link IS a capability token.
-- The view_count column is also readable; if that ever becomes a privacy
-- concern, drop it from a public-facing API view rather than tightening RLS.
create policy public_shares_select_all on public.public_quiz_shares
  for select using (true);
