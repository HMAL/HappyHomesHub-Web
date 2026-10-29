-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 009 — Direct messages (landlord ↔ handyman)
--
-- The messages table currently requires tenancy_id NOT NULL, making it
-- impossible to send direct messages between landlords and handymen who
-- don't share a tenancy.
--
-- Fix: make tenancy_id nullable. A message is either:
--   - Tenancy-scoped:  tenancy_id IS NOT NULL  (landlord ↔ tenant)
--   - Direct:          tenancy_id IS NULL       (landlord ↔ handyman)
--
-- RLS already allows access via sender_id = auth.uid() OR receiver_id = auth.uid()
-- so no policy changes are needed.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.messages
  alter column tenancy_id drop not null;

-- Index for fast direct-message lookups (no tenancy)
create index if not exists idx_messages_direct
  on public.messages(sender_id, receiver_id)
  where tenancy_id is null;
