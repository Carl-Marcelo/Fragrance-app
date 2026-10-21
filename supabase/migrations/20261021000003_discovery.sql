-- =============================================================================
-- Sillage — fragrance discovery (Fragella API)
--
-- * Fragrances added from the external database remember where they came from,
--   so the same fragrance is never stored twice.
-- * API usage counters and per-visitor rate limits for the server-side proxy
--   (api/discover/*). Only the service role can change them; the owner can see
--   this month's usage.
-- =============================================================================

alter table public.fragrances
  add column external_source text check (external_source in ('fragella')),
  add column external_id     text check (char_length(external_id) between 1 and 200),
  add column brand_country   text check (char_length(brand_country) <= 80),
  add constraint fragrances_external_pair check ((external_source is null) = (external_id is null));

create unique index fragrances_owner_external_uidx
  on public.fragrances (owner_id, external_source, external_id)
  where external_id is not null;

-- -----------------------------------------------------------------------------
-- Usage tracking
-- -----------------------------------------------------------------------------
create table public.api_usage (
  period     text primary key check (period ~ '^\d{4}-\d{2}$'),   -- YYYY-MM, Philippine time
  calls      integer not null default 0 check (calls >= 0),
  updated_at timestamptz not null default now()
);

create table public.api_rate_limits (
  client_hash text not null check (char_length(client_hash) between 16 and 128),
  bucket      text not null,             -- 'm:<minute>' or 'd:<day>'
  hits        integer not null default 0,
  expires_at  timestamptz not null,
  primary key (client_hash, bucket)
);

create index api_rate_limits_expiry_idx on public.api_rate_limits (expires_at);

alter table public.api_usage       enable row level security;
alter table public.api_rate_limits enable row level security;

revoke all on public.api_usage       from anon, authenticated;
revoke all on public.api_rate_limits from anon, authenticated;
grant select on public.api_usage to authenticated;

create policy "Owner can see API usage"
  on public.api_usage for select to authenticated
  using ((select public.is_app_owner()));

-- -----------------------------------------------------------------------------
-- Atomically checks the monthly cap and per-visitor limits, then records the
-- call. Called only by the server-side proxy with the service-role key.
-- -----------------------------------------------------------------------------
create or replace function public.consume_discovery_quota(
  p_client      text,
  p_per_minute  integer,
  p_per_day     integer,
  p_monthly_cap integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now    timestamptz := now();
  v_minute text := 'm:' || to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI');
  v_day    text := 'd:' || to_char(v_now at time zone 'UTC', 'YYYY-MM-DD');
  v_month  text := to_char(v_now at time zone 'Asia/Manila', 'YYYY-MM');
  v_total  integer;
  v_hits   integer;
begin
  if p_client is null or char_length(p_client) < 16 then
    raise exception 'invalid client key';
  end if;

  -- Occasional cleanup of expired buckets.
  if random() < 0.02 then
    delete from public.api_rate_limits where expires_at < v_now;
  end if;

  -- Serialise checks for the month so the cap can't be overshot by races.
  insert into public.api_usage (period) values (v_month) on conflict (period) do nothing;
  select calls into v_total from public.api_usage where period = v_month for update;
  if v_total >= p_monthly_cap then
    return jsonb_build_object('allowed', false, 'reason', 'monthly_cap', 'calls', v_total, 'cap', p_monthly_cap);
  end if;

  insert into public.api_rate_limits as r (client_hash, bucket, hits, expires_at)
  values (p_client, v_minute, 1, v_now + interval '2 minutes')
  on conflict (client_hash, bucket) do update set hits = r.hits + 1
  returning hits into v_hits;
  if v_hits > p_per_minute then
    return jsonb_build_object('allowed', false, 'reason', 'rate_minute');
  end if;

  insert into public.api_rate_limits as r (client_hash, bucket, hits, expires_at)
  values (p_client, v_day, 1, v_now + interval '2 days')
  on conflict (client_hash, bucket) do update set hits = r.hits + 1
  returning hits into v_hits;
  if v_hits > p_per_day then
    return jsonb_build_object('allowed', false, 'reason', 'rate_day');
  end if;

  update public.api_usage
     set calls = calls + 1, updated_at = v_now
   where period = v_month
  returning calls into v_total;

  return jsonb_build_object('allowed', true, 'calls', v_total, 'cap', p_monthly_cap);
end;
$$;

revoke all on function public.consume_discovery_quota(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_discovery_quota(text, integer, integer, integer) to service_role;
