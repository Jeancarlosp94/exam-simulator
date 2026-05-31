-- ───────────────────────────────────────────────────────────────────────
-- Quizen — Storage bucket `documents` (private, user-scoped by folder)
-- Object path convention: <auth.uid()>/<document_id>.pdf
-- The first path segment must equal auth.uid()::text or all ops fail.
-- ───────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Object-level RLS. RLS is already enabled on storage.objects by default
-- in Supabase, so we only add policies.

create policy documents_storage_select_own on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_storage_insert_own on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_storage_update_own on storage.objects
  for update using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_storage_delete_own on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
