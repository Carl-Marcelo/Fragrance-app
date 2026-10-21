-- =============================================================================
-- Sillage · Personal Perfume Journal — schema
--
-- Public reference data  : public.fragrances (only rows with is_public = true are
--                          readable without login)
-- Private owner records  : public.collection_items, public.wear_logs,
--                          public.user_settings
-- Access control         : public.app_owners + Row Level Security (next migration)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Owner registry. The first account created in this project becomes the owner.
-- Only owners may write anything; private rows are further restricted to the
-- account that created them.
-- -----------------------------------------------------------------------------
create table public.app_owners (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.app_owners is
  'Accounts allowed to write data. Populated automatically for the first user; edit only from the SQL editor.';

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Validates that a text[] has no blank entries, sane lengths, and a bounded size.
create or replace function public.valid_tag_array(tags text[], max_items int default 60)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(tags, 1), 0) <= max_items
     and not exists (
       select 1 from unnest(tags) as t(v)
       where v is null or char_length(btrim(v)) = 0 or char_length(v) > 80
     );
$$;

-- -----------------------------------------------------------------------------
-- Fragrance reference records (facts + estimated character/performance).
-- Contains no personal data: no prices, ratings, notes or ownership status.
-- -----------------------------------------------------------------------------
create table public.fragrances (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  is_public       boolean not null default false,

  -- Identity (facts)
  name            text not null check (char_length(btrim(name)) between 1 and 200),
  brand           text not null check (char_length(btrim(brand)) between 1 and 200),
  concentration   text check (concentration in
                    ('body_mist','edc','cologne','edt','edp','parfum','extrait','elixir','oil','other')),
  release_year    int check (release_year between 1700 and 2100),
  family          text check (char_length(family) <= 60),
  perfumers       text[] not null default '{}' check (public.valid_tag_array(perfumers, 10)),
  description     text check (char_length(description) <= 4000),

  -- Composition (facts)
  notes_top       text[] not null default '{}' check (public.valid_tag_array(notes_top)),
  notes_middle    text[] not null default '{}' check (public.valid_tag_array(notes_middle)),
  notes_base      text[] not null default '{}' check (public.valid_tag_array(notes_base)),
  accords         text[] not null default '{}' check (public.valid_tag_array(accords, 20)),

  -- Character (subjective estimates, 1–5)
  sweetness       smallint check (sweetness between 1 and 5),
  freshness       smallint check (freshness between 1 and 5),
  darkness        smallint check (darkness between 1 and 5),
  masculinity     smallint check (masculinity between 1 and 5),   -- 1 feminine · 3 unisex · 5 masculine

  -- Performance (subjective estimates, 1–5)
  projection      smallint check (projection between 1 and 5),
  longevity       smallint check (longevity between 1 and 5),

  -- Suitability (subjective estimates, 1–5)
  suit_hot        smallint check (suit_hot between 1 and 5),
  suit_humid      smallint check (suit_humid between 1 and 5),
  suit_rainy      smallint check (suit_rainy between 1 and 5),
  suit_aircon     smallint check (suit_aircon between 1 and 5),
  suit_day        smallint check (suit_day between 1 and 5),
  suit_night      smallint check (suit_night between 1 and 5),
  suit_office     smallint check (suit_office between 1 and 5),
  suit_date       smallint check (suit_date between 1 and 5),
  suit_special    smallint check (suit_special between 1 and 5),

  -- Provenance
  info_status     text not null default 'unverified'
                    check (info_status in ('verified','unverified','needs_review')),
  ratings_basis   text not null default 'estimate'
                    check (ratings_basis in ('personal','estimate','community')),
  source_links    jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(source_links) = 'array' and jsonb_array_length(source_links) <= 20),

  -- Imagery (reference image; personal bottle photos live on collection_items)
  image_url       text check (image_url is null or image_url ~* '^https://'),
  image_path      text check (char_length(image_path) <= 300),
  image_credit    text check (char_length(image_credit) <= 300),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index fragrances_owner_idx  on public.fragrances (owner_id);
create index fragrances_public_idx on public.fragrances (is_public) where is_public;
create index fragrances_brand_name_idx on public.fragrances (lower(brand), lower(name));

create trigger fragrances_updated_at
  before update on public.fragrances
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Private collection records (owned · wishlist · previously owned)
-- -----------------------------------------------------------------------------
create table public.collection_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fragrance_id       uuid not null references public.fragrances (id) on delete cascade,

  status             text not null default 'owned'
                       check (status in ('owned','wishlist','previously_owned')),
  is_favorite        boolean not null default false,

  personal_rating    numeric(3,1) check (personal_rating between 0 and 10),
  personal_notes     text check (char_length(personal_notes) <= 8000),
  want_reason        text check (char_length(want_reason) <= 2000),
  wishlist_priority  smallint check (wishlist_priority between 1 and 3),   -- 1 high · 3 low

  bottle_size_ml     numeric(7,2) check (bottle_size_ml > 0 and bottle_size_ml <= 5000),
  remaining_percent  smallint check (remaining_percent between 0 and 100),
  is_decant          boolean not null default false,

  purchase_price     numeric(12,2) check (purchase_price >= 0),
  currency           text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  purchase_date      date,
  purchase_from      text check (char_length(purchase_from) <= 200),

  bottle_image_path  text check (char_length(bottle_image_path) <= 300),
  spray_overrides    jsonb not null default '{}'::jsonb check (jsonb_typeof(spray_overrides) = 'object'),

  status_changed_at  timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index collection_items_user_idx      on public.collection_items (user_id);
create index collection_items_fragrance_idx on public.collection_items (fragrance_id);
create index collection_items_status_idx    on public.collection_items (user_id, status);

create trigger collection_items_updated_at
  before update on public.collection_items
  for each row execute function public.set_updated_at();

create or replace function public.touch_status_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger collection_items_status_changed
  before update on public.collection_items
  for each row execute function public.touch_status_changed_at();

-- -----------------------------------------------------------------------------
-- Private wear log
-- -----------------------------------------------------------------------------
create table public.wear_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_item_id  uuid not null references public.collection_items (id) on delete cascade,
  worn_on             date not null default current_date,
  scenario            text check (scenario in ('hot_day','normal_day','office','night_date','special')),
  weather             text check (weather in ('hot','humid','rainy','mild','aircon')),
  sprays              smallint check (sprays between 0 and 30),
  longevity_hours     numeric(4,1) check (longevity_hours between 0 and 72),
  rating              smallint check (rating between 1 and 5),
  compliments         smallint check (compliments between 0 and 100),
  notes               text check (char_length(notes) <= 2000),
  created_at          timestamptz not null default now()
);

create index wear_logs_user_idx on public.wear_logs (user_id, worn_on desc);
create index wear_logs_item_idx on public.wear_logs (collection_item_id);

-- -----------------------------------------------------------------------------
-- Private per-account settings (theme sync, currency, spray profile)
-- -----------------------------------------------------------------------------
create table public.user_settings (
  user_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  theme                 text not null default 'system' check (theme in ('light','dark','system')),
  currency              text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  low_bottle_threshold  smallint not null default 20 check (low_bottle_threshold between 1 and 90),
  spray_profile         jsonb not null default '{}'::jsonb check (jsonb_typeof(spray_profile) = 'object'),
  updated_at            timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
