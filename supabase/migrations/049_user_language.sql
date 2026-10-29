-- Per-user language preference so the app launches in the user's own language
-- (English or Spanish). Resolved at load: profile.language → localStorage →
-- browser language → 'en'.

alter table public.users
  add column if not exists language text not null default 'en'
    check (language in ('en', 'es'));
