-- ───────────────────────────────────────────────────────────────────────
-- Sprint 12c — Per-user theme preferences
--
-- Stores the user's chosen palette + mode + brightness so it follows
-- them across devices. We keep the cookie as the fast path (read in the
-- root layout for SSR with no flash) and sync to this column on change.
-- ───────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists theme_settings jsonb
    not null
    default '{"palette":"teal","mode":"focus","brightness":"dark"}'::jsonb;

-- Quick guard so legacy clients can't write garbage.
alter table public.profiles
  add constraint profiles_theme_settings_shape check (
    theme_settings ? 'palette'
    and theme_settings ? 'mode'
    and theme_settings ? 'brightness'
    and theme_settings->>'palette' in ('teal','forest','sunset','lavender')
    and theme_settings->>'mode' in ('focus','relax')
    and theme_settings->>'brightness' in ('dark','light')
  );
