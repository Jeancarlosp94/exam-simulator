-- ───────────────────────────────────────────────────────────────────────
-- Sprint 13b — Web Push subscriptions
--
-- One row per (user, device) browser subscription. The endpoint+p256dh+
-- auth triple comes straight from PushSubscription.toJSON() in the
-- client. We send a push to each row; if the endpoint returns
-- 404/410 we treat the subscription as dead and delete it (the cron
-- handles the cleanup).
--
-- Unique on (user_id, endpoint) so a user re-subscribing from the same
-- browser/device just upserts. Different devices (phone + tablet) get
-- separate rows.
-- ───────────────────────────────────────────────────────────────────────

create table public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, endpoint)
);
create index push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);
-- updates (last_used_at) go through service role only
