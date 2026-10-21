-- =============================================================================
-- Sillage — Row Level Security verification
--
-- Run in Supabase → SQL Editor (or psql) AFTER applying the migrations.
-- Everything happens inside one transaction that is rolled back at the end, so
-- no data is changed. Any failed check aborts with an error starting "FAIL:".
-- On success the final result row reads "All RLS checks passed".
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the postgres role, removed by the final ROLLBACK)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-a000-0000000000aa', 'rls-owner@example.test',    'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-0000000000bb', 'rls-stranger@example.test', 'authenticated', 'authenticated');

-- Force the roles regardless of who owns the real project.
insert into public.app_owners (user_id) values ('00000000-0000-4000-a000-0000000000aa') on conflict do nothing;
delete from public.app_owners where user_id = '00000000-0000-4000-a000-0000000000bb';

insert into public.fragrances (id, owner_id, name, brand, is_public)
values
  ('00000000-0000-4000-b000-0000000000f1', '00000000-0000-4000-a000-0000000000aa', 'Private Test Scent', 'RLS Test', false),
  ('00000000-0000-4000-b000-0000000000f2', '00000000-0000-4000-a000-0000000000aa', 'Public Test Scent',  'RLS Test', true);

insert into public.collection_items (id, user_id, fragrance_id, status, purchase_price, personal_notes, personal_rating)
values ('00000000-0000-4000-c000-0000000000c1', '00000000-0000-4000-a000-0000000000aa',
        '00000000-0000-4000-b000-0000000000f1', 'owned', 4500, 'secret note', 9);

insert into public.wear_logs (user_id, collection_item_id, notes)
values ('00000000-0000-4000-a000-0000000000aa', '00000000-0000-4000-c000-0000000000c1', 'secret wear');

insert into public.user_settings (user_id) values ('00000000-0000-4000-a000-0000000000aa') on conflict do nothing;

insert into public.api_usage (period, calls) values ('2000-01', 5) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 1. Anonymous visitor (signed out, using the public anon key)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
declare
  n int;
begin
  if exists (select 1 from public.fragrances where id = '00000000-0000-4000-b000-0000000000f1') then
    raise exception 'FAIL: anon can read a private fragrance';
  end if;
  if not exists (select 1 from public.fragrances where id = '00000000-0000-4000-b000-0000000000f2') then
    raise exception 'FAIL: anon cannot read a published fragrance';
  end if;

  begin
    select count(*) into n from public.collection_items;
    if n > 0 then raise exception 'FAIL: anon can read collection_items'; end if;
  exception when insufficient_privilege then null;  -- expected
  end;

  begin
    select count(*) into n from public.wear_logs;
    if n > 0 then raise exception 'FAIL: anon can read wear_logs'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into n from public.user_settings;
    if n > 0 then raise exception 'FAIL: anon can read user_settings'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into n from public.app_owners;
    if n > 0 then raise exception 'FAIL: anon can read app_owners'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.fragrances (owner_id, name, brand)
    values ('00000000-0000-4000-a000-0000000000aa', 'Anon Insert', 'Hack');
    raise exception 'FAIL: anon can insert fragrances';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.fragrances set name = 'Hacked' where id = '00000000-0000-4000-b000-0000000000f2';
    if found then raise exception 'FAIL: anon can update fragrances'; end if;
  exception when insufficient_privilege then null;
  end;

  if public.is_app_owner() then
    raise exception 'FAIL: anon is treated as owner';
  end if;

  begin
    select count(*) into n from storage.objects where bucket_id = 'bottle-photos';
    if n > 0 then raise exception 'FAIL: anon can list private bottle photos'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into n from public.api_usage;
    raise exception 'FAIL: anon can read API usage';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.consume_discovery_quota('anon-probe-0000000000', 100, 100, 100);
    raise exception 'FAIL: anon can call consume_discovery_quota';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 2. A different signed-in account (e.g. someone who registered while sign-ups
--    were still open). Must not see or change anything private.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000bb","role":"authenticated"}';

do $$
begin
  if public.is_app_owner() then
    raise exception 'FAIL: stranger is treated as owner';
  end if;
  if (select count(*) from public.collection_items) > 0 then
    raise exception 'FAIL: stranger can read collection_items';
  end if;
  if (select count(*) from public.wear_logs) > 0 then
    raise exception 'FAIL: stranger can read wear_logs';
  end if;
  if (select count(*) from public.user_settings) > 0 then
    raise exception 'FAIL: stranger can read user_settings';
  end if;
  if (select count(*) from public.app_owners) > 0 then
    raise exception 'FAIL: stranger can read the owner registry';
  end if;
  if exists (select 1 from public.fragrances where id = '00000000-0000-4000-b000-0000000000f1') then
    raise exception 'FAIL: stranger can read a private fragrance';
  end if;

  begin
    insert into public.fragrances (name, brand) values ('Stranger Insert', 'Hack');
    raise exception 'FAIL: stranger can insert fragrances';
  exception when insufficient_privilege then null;
  end;

  update public.fragrances set name = 'Hacked' where id = '00000000-0000-4000-b000-0000000000f2';
  if found then raise exception 'FAIL: stranger can update the owner''s fragrance'; end if;

  delete from public.fragrances where id = '00000000-0000-4000-b000-0000000000f2';
  if found then raise exception 'FAIL: stranger can delete the owner''s fragrance'; end if;

  update public.collection_items set personal_notes = 'hacked' where id = '00000000-0000-4000-c000-0000000000c1';
  if found then raise exception 'FAIL: stranger can update the owner''s collection'; end if;

  delete from public.collection_items where id = '00000000-0000-4000-c000-0000000000c1';
  if found then raise exception 'FAIL: stranger can delete the owner''s collection'; end if;

  begin
    insert into public.collection_items (fragrance_id) values ('00000000-0000-4000-b000-0000000000f2');
    raise exception 'FAIL: non-owner can create collection items';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.collection_items (user_id, fragrance_id)
    values ('00000000-0000-4000-a000-0000000000aa', '00000000-0000-4000-b000-0000000000f2');
    raise exception 'FAIL: stranger can write rows as the owner';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.app_owners (user_id) values ('00000000-0000-4000-a000-0000000000bb');
    raise exception 'FAIL: stranger can promote themselves to owner';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values ('bottle-photos', '00000000-0000-4000-a000-0000000000bb/hack.jpg');
    raise exception 'FAIL: non-owner can upload to bottle-photos';
  exception when insufficient_privilege then null;
  end;

  if (select count(*) from public.api_usage) > 0 then
    raise exception 'FAIL: stranger can read API usage';
  end if;

  begin
    perform public.consume_discovery_quota('stranger-probe-000000', 100, 100, 100);
    raise exception 'FAIL: stranger can call consume_discovery_quota';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 3. The owner. Full access to their own rows, cannot hand rows to others.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000aa","role":"authenticated"}';

do $$
begin
  if not public.is_app_owner() then
    raise exception 'FAIL: owner is not recognised';
  end if;
  if not exists (select 1 from public.fragrances where id = '00000000-0000-4000-b000-0000000000f1') then
    raise exception 'FAIL: owner cannot read own private fragrance';
  end if;
  if (select count(*) from public.collection_items where id = '00000000-0000-4000-c000-0000000000c1') <> 1 then
    raise exception 'FAIL: owner cannot read own collection';
  end if;
  if (select count(*) from public.wear_logs) < 1 then
    raise exception 'FAIL: owner cannot read own wear log';
  end if;

  if (select count(*) from public.api_usage where period = '2000-01') <> 1 then
    raise exception 'FAIL: owner cannot see API usage';
  end if;

  begin
    perform public.consume_discovery_quota('owner-probe-000000000', 100, 100, 100);
    raise exception 'FAIL: browser sessions can call consume_discovery_quota (server only)';
  exception when insufficient_privilege then null;
  end;

  insert into public.fragrances (name, brand) values ('Owner Insert', 'RLS Test');

  update public.collection_items set remaining_percent = 50 where id = '00000000-0000-4000-c000-0000000000c1';
  if not found then raise exception 'FAIL: owner cannot update own collection'; end if;

  begin
    update public.collection_items
       set user_id = '00000000-0000-4000-a000-0000000000bb'
     where id = '00000000-0000-4000-c000-0000000000c1';
    raise exception 'FAIL: owner can reassign a row to another account';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.fragrances (owner_id, name, brand)
    values ('00000000-0000-4000-a000-0000000000bb', 'Spoofed', 'RLS Test');
    raise exception 'FAIL: owner can create rows for another account';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

rollback;

select 'All RLS checks passed — no data was changed' as result;
