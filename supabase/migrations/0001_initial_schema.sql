-- ───────────────────────────────────────────────────────────────────────
-- Quizen — Initial schema
-- Profiles, documents + chunks, quizzes + questions, attempts + answers,
-- SRS cards, subscriptions. All FK'd to auth.users with cascade on delete.
-- RLS policies live in 0002. Storage bucket in 0003.
-- ───────────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── profiles ──────────────────────────────────────────────────────────
-- App-specific user data. One row per auth.users row, auto-created via trigger.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── documents ─────────────────────────────────────────────────────────
-- One row per uploaded PDF. storage_path points to a key inside the
-- `documents` Storage bucket. Status moves uploading → extracting → ready.
create table public.documents (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  storage_path  text not null,
  size_bytes    integer not null,
  page_count    integer,
  status        text not null default 'uploading'
                  check (status in ('uploading','extracting','ready','failed')),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index documents_user_id_idx on public.documents(user_id);
create index documents_status_idx  on public.documents(status);

-- ─── document_chunks ───────────────────────────────────────────────────
-- Text chunks extracted from a document. Used as Claude context for both
-- quiz generation (Sprint 4) and the tutor (Sprint 6). RLS reads through
-- the parent document; writes are service-role only (API route).
create table public.document_chunks (
  id           uuid primary key default uuid_generate_v4(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  chunk_index  integer not null,
  content      text not null,
  token_count  integer,
  page_start   integer,
  page_end     integer,
  created_at   timestamptz not null default now(),
  unique (document_id, chunk_index)
);
create index document_chunks_document_id_idx on public.document_chunks(document_id);

-- ─── quizzes ───────────────────────────────────────────────────────────
-- A generated quiz, owned by user_id, derived from document_id. Tracks
-- the model + token usage so we can analyze cost per generation.
create table public.quizzes (
  id                        uuid primary key default uuid_generate_v4(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  document_id               uuid not null references public.documents(id) on delete cascade,
  title                     text not null,
  difficulty                text not null default 'mixed'
                              check (difficulty in ('easy','mixed','hard')),
  question_count            integer not null,
  time_limit_minutes        integer,
  generation_model          text,
  generation_tokens_input   integer,
  generation_tokens_output  integer,
  generation_cached_tokens  integer,
  created_at                timestamptz not null default now()
);
create index quizzes_user_id_idx     on public.quizzes(user_id);
create index quizzes_document_id_idx on public.quizzes(document_id);

-- ─── questions ─────────────────────────────────────────────────────────
-- One row per question in a quiz. options is jsonb in the shape
-- [{ "label": "A", "text": "..." }]. bloom_level is enforced so we can
-- audit that generations actually mix levels (not just memorización).
create table public.questions (
  id                uuid primary key default uuid_generate_v4(),
  quiz_id           uuid not null references public.quizzes(id) on delete cascade,
  position          integer not null,
  prompt            text not null,
  options           jsonb not null,
  correct_label     text not null,
  explanation       text not null,
  bloom_level       text not null
                      check (bloom_level in (
                        'remember','understand','apply','analyze','evaluate','create'
                      )),
  difficulty        text not null
                      check (difficulty in ('easy','medium','hard')),
  source_chunk_id   uuid references public.document_chunks(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (quiz_id, position)
);
create index questions_quiz_id_idx on public.questions(quiz_id);

-- ─── attempts ──────────────────────────────────────────────────────────
-- A user's run of a quiz. Mode "timed" enforces time_limit_minutes from
-- the quiz; "practice" ignores it. completed_at is null while in progress.
create table public.attempts (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  quiz_id            uuid not null references public.quizzes(id) on delete cascade,
  mode               text not null default 'practice'
                       check (mode in ('practice','timed')),
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  time_spent_seconds integer,
  score_correct      integer,
  score_total        integer
);
create index attempts_user_id_idx on public.attempts(user_id);
create index attempts_quiz_id_idx on public.attempts(quiz_id);

-- ─── answers ───────────────────────────────────────────────────────────
-- One row per question per attempt. selected_label null means unanswered.
-- is_correct denormalized for fast filtering in the results screen.
create table public.answers (
  id              uuid primary key default uuid_generate_v4(),
  attempt_id      uuid not null references public.attempts(id) on delete cascade,
  question_id     uuid not null references public.questions(id) on delete cascade,
  selected_label  text,
  is_correct      boolean,
  flagged         boolean not null default false,
  answered_at     timestamptz,
  unique (attempt_id, question_id)
);
create index answers_attempt_id_idx on public.answers(attempt_id);

-- ─── srs_cards ─────────────────────────────────────────────────────────
-- Spaced repetition state per (user, question). SM-2 inspired: ease_factor
-- adjusts on each review, interval_days grows with successful repetitions.
-- next_review_at is the only index hit by the daily "due cards" query.
create table public.srs_cards (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  question_id       uuid not null references public.questions(id) on delete cascade,
  ease_factor       numeric not null default 2.5,
  interval_days     integer not null default 1,
  repetitions       integer not null default 0,
  next_review_at    timestamptz not null default now(),
  last_reviewed_at  timestamptz,
  unique (user_id, question_id)
);
create index srs_cards_user_id_idx        on public.srs_cards(user_id);
create index srs_cards_next_review_at_idx on public.srs_cards(next_review_at);

-- ─── subscriptions ─────────────────────────────────────────────────────
-- Mirror of the Stripe subscription state. Webhook in Sprint 7 keeps this
-- in sync. Read-only from the client via RLS; writes only via service_role.
create table public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text unique not null,
  stripe_subscription_id text unique,
  status                 text not null default 'free'
                           check (status in ('free','active','past_due','canceled','trialing')),
  plan                   text not null default 'free'
                           check (plan in ('free','pro')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- ─── triggers ──────────────────────────────────────────────────────────

-- Auto-create a profile row on auth.users insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bump updated_at on every update for tables that need it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger documents_touch
  before update on public.documents
  for each row execute function public.touch_updated_at();

create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();
