-- ============================================================
-- FPH Prep – Storage bucket 'summaries' (immagini riassunti)
-- ============================================================

-- Crea bucket pubblico (read)
insert into storage.buckets (id, name, public)
values ('summaries', 'summaries', true)
on conflict (id) do nothing;

-- Policy: chiunque legge dal bucket summaries
create policy "public_read_summaries"
  on storage.objects for select
  using (bucket_id = 'summaries');

-- Policy: solo admin inserisce/aggiorna/elimina
create policy "admin_write_summaries_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'summaries' and public.is_admin());

create policy "admin_write_summaries_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'summaries' and public.is_admin())
  with check (bucket_id = 'summaries' and public.is_admin());

create policy "admin_write_summaries_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'summaries' and public.is_admin());
