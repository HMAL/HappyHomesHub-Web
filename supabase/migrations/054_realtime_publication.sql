-- The app subscribes to postgres_changes on messages (chat auto-refresh, unread
-- badges) and maintenance_requests (landlord badge), but the supabase_realtime
-- publication had no tables, so no events were ever delivered and chats only
-- updated on a full browser refresh.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.maintenance_requests;
