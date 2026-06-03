-- ───────────────────────────────────────────────────────────────────────
-- Sprint 12 — Flashcards + unified SRS queue
--
-- We split "study" from "test":
--   - quizzes are MCQs for self-assessment (existing tables unchanged)
--   - flashcards are front/back pairs for atomic recall practice
--
-- Both feed into the same SRS cola so /review walks one merged queue,
-- the user doesn't have to think about which mode a card came from.
-- ───────────────────────────────────────────────────────────────────────

-- ─── flashcards ────────────────────────────────────────────────────────
create table public.flashcards (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade,
  front           text not null,
  back            text not null,
  bloom_level     text not null
                    check (bloom_level in (
                      'remember','understand','apply','analyze','evaluate','create'
                    )),
  source_chunk_id uuid references public.document_chunks(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index flashcards_user_doc_idx on public.flashcards(user_id, document_id);
create index flashcards_document_id_idx on public.flashcards(document_id);

alter table public.flashcards enable row level security;

create policy flashcards_select_own on public.flashcards
  for select using (auth.uid() = user_id);
create policy flashcards_insert_own on public.flashcards
  for insert with check (auth.uid() = user_id);
create policy flashcards_delete_own on public.flashcards
  for delete using (auth.uid() = user_id);

-- ─── srs_cards extension ───────────────────────────────────────────────
-- Existing rows all reference a question — they get source_type='question'
-- by the default below. Flashcard rows set source_type='flashcard' and
-- populate flashcard_id, while question_id becomes optional (nullable).

alter table public.srs_cards
  add column source_type text not null default 'question'
    check (source_type in ('question','flashcard'));

alter table public.srs_cards
  add column flashcard_id uuid references public.flashcards(id) on delete cascade;

-- question_id was NOT NULL before. Flashcard rows don't have one; relax.
alter table public.srs_cards
  alter column question_id drop not null;

-- The old uniqueness on (user_id, question_id) conflicts with rows whose
-- question_id is null. Replace with two partial unique indexes — one per
-- source type — so the right (user, question) and (user, flashcard) pair
-- can't be duplicated, but nulls don't fight each other.
alter table public.srs_cards
  drop constraint if exists srs_cards_user_id_question_id_key;

create unique index srs_cards_user_question_unique
  on public.srs_cards(user_id, question_id)
  where source_type = 'question';

create unique index srs_cards_user_flashcard_unique
  on public.srs_cards(user_id, flashcard_id)
  where source_type = 'flashcard';

-- Integrity: question_id must be set iff source_type='question', and
-- flashcard_id must be set iff source_type='flashcard'.
alter table public.srs_cards
  add constraint srs_cards_source_consistency check (
    (source_type = 'question'  and question_id  is not null and flashcard_id is null)
    or
    (source_type = 'flashcard' and flashcard_id is not null and question_id  is null)
  );
