-- =============================================================================
-- Sillage — authentication hooks, Row Level Security and storage policies
--
-- Rules enforced by the database (not just the UI):
--   * anon (signed out)      : may read fragrances WHERE is_public = true. Nothing else.
--   * authenticated non-owner: same as anon, plus their own app_owners lookup. No writes.
--   * owner                  : full CRUD on rows where owner_id / user_id = auth.uid().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Owner check used by every write policy
-- -----------------------------------------------------------------------------
create or replace function public.is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_owners where user_id = auth.uid()
  );
$$;

revoke all on function public.is_app_owner() from public;
grant execute on function public.is_app_owner() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- First account becomes the owner. Later accounts get no write access.
-- Turn off "Allow new users to sign up" in Supabase Auth after creating yours.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  lock table public.app_owners in share row exclusive mode;
  if not exists (select 1 from public.app_owners) then
    insert into public.app_owners (user_id) values (new.id);
    insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- If exactly one account already existed before this migration ran, claim it.
insert into public.app_owners (user_id)
select id from auth.users
where (select count(*) from auth.users) = 1
on conflict do nothing;

insert into public.user_settings (user_id)
select user_id from public.app_owners
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Table privileges (defense in depth on top of RLS)
-- -----------------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

revoke all on public.app_owners       from anon;
revoke all on public.collection_items from anon;
revoke all on public.wear_logs        from anon;
revoke all on public.user_settings    from anon;
revoke insert, update, delete on public.fragrances from anon;

revoke insert, update, delete on public.app_owners from authenticated;
grant select on public.app_owners to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.app_owners       enable row level security;
alter table public.fragrances       enable row level security;
alter table public.collection_items enable row level security;
alter table public.wear_logs        enable row level security;
alter table public.user_settings    enable row level security;

-- app_owners: a signed-in user can only see whether they themselves are an owner.
create policy "Users can see their own owner row"
  on public.app_owners for select to authenticated
  using (user_id = (select auth.uid()));

-- fragrances ------------------------------------------------------------------
create policy "Anyone can read published fragrances"
  on public.fragrances for select to anon, authenticated
  using (is_public);

create policy "Owner can read own fragrances"
  on public.fragrances for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owner can create fragrances"
  on public.fragrances for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_app_owner()));

create policy "Owner can update own fragrances"
  on public.fragrances for update to authenticated
  using      (owner_id = (select auth.uid()) and (select public.is_app_owner()))
  with check (owner_id = (select auth.uid()) and (select public.is_app_owner()));

create policy "Owner can delete own fragrances"
  on public.fragrances for delete to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_app_owner()));

-- collection_items ------------------------------------------------------------
create policy "Owner can read own collection"
  on public.collection_items for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_app_owner()));

create policy "Owner can add to own collection"
  on public.collection_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_app_owner())
    and exists (
      select 1 from public.fragrances f
      where f.id = fragrance_id
        and (f.owner_id = (select auth.uid()) or f.is_public)
    )
  );

create policy "Owner can update own collection"
  on public.collection_items for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_app_owner()))
  with check (
    user_id = (select auth.uid())
    and (select public.is_app_owner())
    and exists (
      select 1 from public.fragrances f
      where f.id = fragrance_id
        and (f.owner_id = (select auth.uid()) or f.is_public)
    )
  );

create policy "Owner can delete from own collection"
  on public.collection_items for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.is_app_owner()));

-- wear_logs -------------------------------------------------------------------
create policy "Owner can read own wear log"
  on public.wear_logs for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_app_owner()));

create policy "Owner can add to own wear log"
  on public.wear_logs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_app_owner())
    and exists (
      select 1 from public.collection_items ci
      where ci.id = collection_item_id and ci.user_id = (select auth.uid())
    )
  );

create policy "Owner can update own wear log"
  on public.wear_logs for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_app_owner()))
  with check (
    user_id = (select auth.uid())
    and (select public.is_app_owner())
    and exists (
      select 1 from public.collection_items ci
      where ci.id = collection_item_id and ci.user_id = (select auth.uid())
    )
  );

create policy "Owner can delete from own wear log"
  on public.wear_logs for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.is_app_owner()));

-- user_settings ---------------------------------------------------------------
create policy "Owner can read own settings"
  on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_app_owner()));

create policy "Owner can create own settings"
  on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_app_owner()));

create policy "Owner can update own settings"
  on public.user_settings for update to authenticated
  using      (user_id = (select auth.uid()) and (select public.is_app_owner()))
  with check (user_id = (select auth.uid()) and (select public.is_app_owner()));

create policy "Owner can delete own settings"
  on public.user_settings for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.is_app_owner()));

-- -----------------------------------------------------------------------------
-- Storage
--   fragrance-images : public-by-URL reference images (owner uploads only)
--   bottle-photos    : private personal photos, served through signed URLs
-- Files are stored under "<user id>/<random name>".
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fragrance-images', 'fragrance-images', true,  5242880, array['image/jpeg','image/png','image/webp','image/avif']),
  ('bottle-photos',    'bottle-photos',    false, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Owner can list own reference images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fragrance-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  );

create policy "Owner can upload reference images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fragrance-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  );

create policy "Owner can update reference images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fragrance-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  )
  with check (
    bucket_id = 'fragrance-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  );

create policy "Owner can delete reference images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fragrance-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  );

create policy "Owner can read own bottle photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bottle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  );

create policy "Owner can upload bottle photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bottle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  );

create policy "Owner can update bottle photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'bottle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  )
  with check (
    bucket_id = 'bottle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  );

create policy "Owner can delete bottle photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bottle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_app_owner())
  );
