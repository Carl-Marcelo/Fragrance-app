// npm run test:db
//
// Applies the project migrations to an in-memory Postgres (PGlite) with minimal
// Supabase stand-ins (auth/storage schemas, anon/authenticated roles), then runs
// the RLS verification script plus a few extra checks.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const project = process.argv[2] ?? process.cwd()
const db = new PGlite()

const supabaseStubs = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
create table auth.users (
  id uuid primary key, email text, aud text, role text, instance_id uuid,
  created_at timestamptz default now(),
  is_sso_user boolean not null default false, is_anonymous boolean not null default false
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner uuid default auth.uid(), created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
`

const step = async (label, sql) => {
  try {
    const res = await db.exec(sql)
    console.log(`PASS  ${label}`)
    return res
  } catch (e) {
    console.log(`FAIL  ${label}\n      ${e.message}`)
    process.exitCode = 1
    await db.exec('rollback').catch(() => {})
    return null
  }
}

await step('Supabase stand-ins', supabaseStubs)

// A real owner who signs up before anyone else.
const migrations = readdirSync(join(project, 'supabase/migrations')).sort()
for (const file of migrations) {
  await step(`migration ${file}`, readFileSync(join(project, 'supabase/migrations', file), 'utf8'))
}

await step(
  'first sign-up becomes owner; second does not',
  `
  insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'owner@example.test');
  insert into auth.users (id, email) values ('22222222-2222-4222-8222-222222222222', 'late@example.test');
  do $$ begin
    if (select count(*) from public.app_owners) <> 1 then raise exception 'expected exactly one owner'; end if;
    if not exists (select 1 from public.app_owners where user_id = '11111111-1111-4111-8111-111111111111') then
      raise exception 'first user is not the owner';
    end if;
    if not exists (select 1 from public.user_settings where user_id = '11111111-1111-4111-8111-111111111111') then
      raise exception 'owner settings row missing';
    end if;
  end $$;
`,
)

const verification = readFileSync(join(project, 'supabase/tests/rls_verification.sql'), 'utf8')
const result = await step('rls_verification.sql', verification)
if (result) console.log('      ->', JSON.stringify(result.at(-1)?.rows?.[0]))

await step(
  'check constraints reject bad data',
  `
  do $$
  declare ok boolean;
  begin
    begin
      insert into public.fragrances (owner_id, name, brand, sweetness)
      values ('11111111-1111-4111-8111-111111111111', 'X', 'Y', 9);
      raise exception 'scale 9 accepted';
    exception when check_violation then null; end;
    begin
      insert into public.fragrances (owner_id, name, brand, notes_top)
      values ('11111111-1111-4111-8111-111111111111', 'X', 'Y', array['  ']);
      raise exception 'blank note accepted';
    exception when check_violation then null; end;
    begin
      insert into public.fragrances (owner_id, name, brand, image_url)
      values ('11111111-1111-4111-8111-111111111111', 'X', 'Y', 'javascript:alert(1)');
      raise exception 'non-https image accepted';
    exception when check_violation then null; end;
  end $$;
`,
)

await step(
  'owner can write through RLS like the app does (insert → item → wear log → update status)',
  `
  begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
  do $$
  declare before timestamptz; after timestamptz; fid uuid; iid uuid;
  begin
    insert into public.fragrances (name, brand, accords, notes_top) values ('App Flow', 'House', '{woody}', '{Bergamot}')
      returning id into fid;
    insert into public.collection_items (fragrance_id, status, purchase_price) values (fid, 'wishlist', 4200)
      returning id into iid;
    insert into public.wear_logs (collection_item_id, sprays) values (iid, 2);
    -- now() is fixed per transaction, so backdate first, then change status.
    update public.collection_items set status_changed_at = now() - interval '1 day';
    select status_changed_at into before from public.collection_items limit 1;
    update public.collection_items set status = 'owned';
    select status_changed_at into after from public.collection_items limit 1;
    if after <= before then raise exception 'status_changed_at not bumped'; end if;
    insert into public.user_settings (user_id, theme) values (auth.uid(), 'dark')
      on conflict (user_id) do update set theme = excluded.theme;
    insert into storage.objects (bucket_id, name) values ('bottle-photos', '11111111-1111-4111-8111-111111111111/a.jpg');
    begin
      insert into storage.objects (bucket_id, name) values ('bottle-photos', '22222222-2222-4222-8222-222222222222/a.jpg');
      raise exception 'owner wrote into another user folder';
    exception when insufficient_privilege then null; end;
  end $$;
  rollback;
`,
)

await step(
  'late sign-up (non-owner) cannot write, even to own rows',
  `
  begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
  do $$ begin
    begin
      insert into public.user_settings (user_id) values (auth.uid());
      raise exception 'non-owner created settings';
    exception when insufficient_privilege then null; end;
    begin
      insert into storage.objects (bucket_id, name) values ('fragrance-images', '22222222-2222-4222-8222-222222222222/x.jpg');
      raise exception 'non-owner uploaded a reference image';
    exception when insufficient_privilege then null; end;
  end $$;
  rollback;
`,
)

await step(
  'discovery quota: service role only, limits and monthly cap enforced',
  `
  begin;
  set local role service_role;
  do $$
  declare r jsonb;
  begin
    -- per-minute limit of 2
    r := public.consume_discovery_quota('client-aaaaaaaaaaaaaaaa', 2, 100, 1000);
    if not (r->>'allowed')::boolean then raise exception 'first call refused: %', r; end if;
    r := public.consume_discovery_quota('client-aaaaaaaaaaaaaaaa', 2, 100, 1000);
    r := public.consume_discovery_quota('client-aaaaaaaaaaaaaaaa', 2, 100, 1000);
    if (r->>'allowed')::boolean or r->>'reason' <> 'rate_minute' then raise exception 'minute limit not enforced: %', r; end if;
    -- a different visitor is unaffected
    r := public.consume_discovery_quota('client-bbbbbbbbbbbbbbbb', 2, 100, 1000);
    if not (r->>'allowed')::boolean then raise exception 'other client wrongly limited: %', r; end if;
    -- monthly cap counts every allowed call across visitors (3 so far)
    r := public.consume_discovery_quota('client-cccccccccccccccc', 50, 100, 3);
    if (r->>'allowed')::boolean or r->>'reason' <> 'monthly_cap' then raise exception 'monthly cap not enforced: %', r; end if;
  end $$;
  rollback;
`,
)

await step(
  'external fragrances are unique per owner',
  `
  begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
  insert into public.fragrances (name, brand, external_source, external_id) values ('A', 'B', 'fragella', 'abc123');
  do $$ begin
    begin
      insert into public.fragrances (name, brand, external_source, external_id) values ('A', 'B', 'fragella', 'abc123');
      raise exception 'duplicate external fragrance accepted';
    exception when unique_violation then null; end;
    begin
      insert into public.fragrances (name, brand, external_source) values ('A', 'B', 'fragella');
      raise exception 'source without id accepted';
    exception when check_violation then null; end;
  end $$;
  rollback;
`,
)

await db.close()
console.log(process.exitCode ? '\nSome checks FAILED' : '\nAll database checks passed')
