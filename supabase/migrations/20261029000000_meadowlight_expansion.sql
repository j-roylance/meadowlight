-- Meadowlight expansion: home, garden, space, exploration (additive).
-- Does not reset action windows, resource balances, or existing cities.
-- Aligns city_economy with the five-resource wallet used by the local demo.

-- Rename legacy timber → wood when present; add research/happiness if missing.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'city_economy' and column_name = 'timber'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'city_economy' and column_name = 'wood'
  ) then
    alter table public.city_economy rename column timber to wood;
  end if;
end $$;

alter table public.city_economy
  add column if not exists wood integer not null default 60,
  add column if not exists research integer not null default 0,
  add column if not exists happiness integer not null default 6,
  add column if not exists rem_research numeric not null default 0,
  add column if not exists rem_happiness numeric not null default 0,
  add column if not exists rate_research integer not null default 0,
  add column if not exists rate_happiness integer not null default 0;

-- Expansion JSON state per city (inventory, scenes, station, expedition).
create table if not exists public.city_expansion (
  city_id uuid primary key references public.cities(id) on delete cascade,
  primary_home_entity_id text,
  home_privacy text not null default 'private'
    check (home_privacy in ('private', 'public_readonly')),
  grants jsonb not null default '{}'::jsonb,
  inventory jsonb not null default '[]'::jsonb,
  homes jsonb not null default '{}'::jsonb,
  interiors jsonb not null default '{}'::jsonb,
  backyards jsonb not null default '{}'::jsonb,
  space_centers jsonb not null default '[]'::jsonb,
  stations jsonb not null default '{}'::jsonb,
  seed_unlocks jsonb not null default '["daisy","rose","lavender","basil","lettuce","tomato"]'::jsonb,
  party jsonb,
  regions jsonb not null default '{}'::jsonb,
  active_expedition jsonb,
  harvest_receipts jsonb not null default '{}'::jsonb,
  launch_receipts jsonb not null default '{}'::jsonb,
  backyard_happiness_rate numeric not null default 0,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.expansion_grant_receipts (
  id text primary key,
  city_id uuid not null references public.cities(id) on delete cascade,
  grant_key text not null,
  created_at timestamptz not null default now(),
  unique (city_id, grant_key)
);

create table if not exists public.expansion_command_receipts (
  request_id text primary key,
  city_id uuid not null references public.cities(id) on delete cascade,
  command text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- Portable item parcels (alongside existing resource parcels).
create table if not exists public.portable_item_parcels (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  source_city_id uuid not null references public.cities(id),
  destination_city_id uuid not null references public.cities(id),
  portal_entity_id text not null,
  assignment_revision integer not null,
  item_payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.city_expansion enable row level security;
alter table public.expansion_grant_receipts enable row level security;
alter table public.expansion_command_receipts enable row level security;
alter table public.portable_item_parcels enable row level security;

-- Owner read of own expansion; public home scenes gated in RPC layer.
drop policy if exists city_expansion_owner_select on public.city_expansion;
create policy city_expansion_owner_select on public.city_expansion
  for select using (
    exists (
      select 1 from public.cities c
      where c.id = city_id and c.owner_id = auth.uid()
    )
  );

-- Mutations must go through SECURITY DEFINER RPCs (not shipped in this migration).
-- Live contribute/work/expansion command RPCs remain unverified until wired.

comment on table public.city_expansion is
  'Additive home/garden/space/exploration state. Local demo is the verified playable path.';
