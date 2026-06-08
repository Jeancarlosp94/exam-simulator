-- ───────────────────────────────────────────────────────────────────────
-- Sprint 13 — Retention (streaks + opt-in email reminders)
--
-- daily_activity: one row per (user, date) capturing what the student
-- did that day. We don't try to be exhaustive — quiz completions,
-- review answers, and study-chunk submissions are the three signals
-- that count as "engaged with the material today".
--
-- get_user_streak: counts consecutive days backward from the most
-- recent activity. A streak is considered "alive" if last activity was
-- today or yesterday (giving the student a 24h grace window). Otherwise
-- the streak is dead and we return 0.
--
-- email_reminder_enabled: opt-in flag on profiles. The cron route reads
-- this to decide who to remind. Defaults to false so no email goes out
-- without explicit consent.
-- ───────────────────────────────────────────────────────────────────────

create table public.daily_activity (
  user_id              uuid not null references auth.users(id) on delete cascade,
  activity_date        date not null,
  reviews_completed    integer not null default 0,
  quizzes_completed    integer not null default 0,
  study_chunks_done    integer not null default 0,
  primary key (user_id, activity_date)
);
create index daily_activity_user_date_idx
  on public.daily_activity(user_id, activity_date desc);

alter table public.daily_activity enable row level security;

create policy daily_activity_select_own on public.daily_activity
  for select using (auth.uid() = user_id);

-- Writes go through the service role from API routes — no insert/update
-- policies on purpose.

-- ─── Streak function ───────────────────────────────────────────────────
create or replace function public.get_user_streak(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  v_last_activity date;
  v_streak        integer;
begin
  select max(activity_date)
    into v_last_activity
    from public.daily_activity
   where user_id = p_user_id;

  -- No activity ever, or a >1 day gap → streak is dead.
  if v_last_activity is null or v_last_activity < current_date - 1 then
    return 0;
  end if;

  -- Count consecutive days backward from v_last_activity. The classic
  -- gap-and-island trick: rownum-ascending offsets from the most recent
  -- date all share the same anchor only when there are no gaps.
  with dates as (
    select distinct activity_date
      from public.daily_activity
     where user_id = p_user_id
       and activity_date <= v_last_activity
       and activity_date >= v_last_activity - interval '365 days'
  ),
  with_grp as (
    select activity_date,
           activity_date
             + ((row_number() over (order by activity_date desc) - 1)::int)
             as grp
      from dates
  )
  select count(*)::int
    into v_streak
    from with_grp
   where grp = v_last_activity;

  return v_streak;
end;
$$;

-- ─── Atomic increment RPC ─────────────────────────────────────────────
-- Avoid the read-modify-write race when two concurrent quiz completions
-- both bump the same daily counter. Postgres INSERT ... ON CONFLICT
-- handles it atomically.
create or replace function public.increment_daily_activity(
  p_user_id       uuid,
  p_activity_date date,
  p_column        text
)
returns void
language plpgsql
as $$
begin
  if p_column not in ('reviews_completed', 'quizzes_completed', 'study_chunks_done') then
    raise exception 'invalid column: %', p_column;
  end if;

  -- Seed the row if missing, with the bumped column = 1 and others = 0.
  insert into public.daily_activity (
    user_id, activity_date,
    reviews_completed, quizzes_completed, study_chunks_done
  )
  values (
    p_user_id, p_activity_date,
    case when p_column = 'reviews_completed'  then 1 else 0 end,
    case when p_column = 'quizzes_completed'  then 1 else 0 end,
    case when p_column = 'study_chunks_done'  then 1 else 0 end
  )
  on conflict (user_id, activity_date) do update
    set reviews_completed = daily_activity.reviews_completed
          + case when p_column = 'reviews_completed' then 1 else 0 end,
        quizzes_completed = daily_activity.quizzes_completed
          + case when p_column = 'quizzes_completed' then 1 else 0 end,
        study_chunks_done = daily_activity.study_chunks_done
          + case when p_column = 'study_chunks_done' then 1 else 0 end;
end;
$$;

-- ─── profiles.email_reminder_enabled ──────────────────────────────────
alter table public.profiles
  add column if not exists email_reminder_enabled boolean not null default false;
