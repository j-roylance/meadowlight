-- Meadowlight first-release schema
-- Authoritative multiplayer state. Clients must not write economy/action columns directly.

create extension if not exists "pgcrypto";

-- Profiles (auth.users is source of email)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Neighbor',
  accessibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null,
  specialty text not null check (specialty in ('markets', 'timber', 'stone')),
  scene_id uuid not null default gen_random_uuid(),
  seed bigint not null,
  generator_version int not null default 1,
  arrival_x text not null default '1',
  arrival_y text not null default '-1',
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  onboarding_complete boolean not null default false
);

create table public.city_economy (
  city_id uuid primary key references public.cities (id) on delete cascade,
  coins int not null default 80 check (coins >= 0),
  timber int not null default 60 check (timber >= 0),
  stone int not null default 40 check (stone >= 0),
  rem_coins int not null default 0,
  rem_timber int not null default 0,
  rem_stone int not null default 0,
  rate_coins int not null default 0,
  rate_timber int not null default 0,
  rate_stone int not null default 0,
  last_settled_at timestamptz not null default now(),
  actions_remaining smallint not null default 2 check (actions_remaining between 0 and 2),
  action_window_start_at timestamptz not null default now()
);

create table public.map_chunks (
  scene_id uuid not null,
  chunk_x text not null,
  chunk_y text not null,
  edits_revision bigint not null default 0,
  terrain_overrides jsonb not null default '{}'::jsonb,
  primary key (scene_id, chunk_x, chunk_y)
);

create table public.placed_entities (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null,
  city_id uuid not null references public.cities (id) on delete cascade,
  definition_id text not null,
  level smallint not null default 1 check (level in (1, 2)),
  tile_x text not null,
  tile_y text not null,
  rotation smallint not null default 0,
  stored boolean not null default false,
  appearance jsonb not null default '{}'::jsonb,
  revision bigint not null default 1
);

create table public.occupied_tiles (
  scene_id uuid not null,
  tile_x text not null,
  tile_y text not null,
  entity_id uuid not null references public.placed_entities (id) on delete cascade,
  primary key (scene_id, tile_x, tile_y)
);

create table public.road_tiles (
  scene_id uuid not null,
  tile_x text not null,
  tile_y text not null,
  style text not null default 'dirt',
  primary key (scene_id, tile_x, tile_y)
);

create table public.portals (
  entity_id uuid primary key references public.placed_entities (id) on delete cascade,
  source_city_id uuid not null references public.cities (id) on delete cascade,
  destination_city_id uuid not null references public.cities (id),
  assignment_revision bigint not null default 1,
  enabled boolean not null default true,
  assigned_at timestamptz not null default now(),
  check (source_city_id <> destination_city_id)
);

create table public.commerce_connections (
  city_a uuid not null references public.cities (id) on delete cascade,
  city_b uuid not null references public.cities (id) on delete cascade,
  portal_count int not null default 0 check (portal_count >= 0),
  specialty_a text not null,
  specialty_b text not null,
  activated_at timestamptz not null default now(),
  primary key (city_a, city_b),
  check (city_a < city_b)
);

create table public.delivery_policies (
  city_id uuid primary key references public.cities (id) on delete cascade,
  inbound_enabled boolean not null default true
);

create table public.blocked_sources (
  city_id uuid not null references public.cities (id) on delete cascade,
  source_city_id uuid not null references public.cities (id) on delete cascade,
  primary key (city_id, source_city_id)
);

create table public.parcel_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  source_city_id uuid not null,
  destination_city_id uuid not null,
  portal_entity_id uuid not null,
  assignment_revision bigint not null,
  coins int not null default 0,
  timber int not null default 0,
  stone int not null default 0,
  created_at timestamptz not null default now(),
  unique (source_city_id, request_id)
);

create table public.friendships (
  city_a uuid not null references public.cities (id) on delete cascade,
  city_b uuid not null references public.cities (id) on delete cascade,
  initiator uuid not null,
  status text not null check (status in ('pending', 'accepted')),
  primary key (city_a, city_b),
  check (city_a < city_b)
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  city_id uuid not null unique references public.cities (id) on delete cascade,
  primary key (circle_id, city_id)
);

create table public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  creator_city_id uuid not null references public.cities (id) on delete cascade,
  token_hash text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.hosted_projects (
  id uuid primary key default gen_random_uuid(),
  host_city_id uuid not null references public.cities (id) on delete cascade,
  entity_id uuid not null references public.placed_entities (id),
  definition_id text not null,
  work_current int not null default 0 check (work_current >= 0),
  work_target int not null,
  status text not null check (status in ('untouched', 'active', 'complete')),
  completed_at timestamptz
);

create unique index hosted_projects_one_active
  on public.hosted_projects (host_city_id)
  where status in ('untouched', 'active');

create unique index hosted_projects_one_complete_type
  on public.hosted_projects (host_city_id, definition_id)
  where status = 'complete';

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.hosted_projects (id) on delete cascade,
  source_city_id uuid not null references public.cities (id),
  source_portal_id uuid,
  work_amount int not null,
  request_id text not null,
  created_at timestamptz not null default now(),
  unique (source_city_id, request_id)
);

create table public.blueprint_entitlements (
  city_id uuid not null references public.cities (id) on delete cascade,
  landmark_type text not null,
  provenance text not null,
  primary key (city_id, landmark_type)
);

create table public.action_ledger (
  id uuid primary key default gen_random_uuid(),
  source_city_id uuid not null references public.cities (id) on delete cascade,
  window_start_at timestamptz not null,
  action_kind text not null,
  request_id text not null,
  created_at timestamptz not null default now(),
  unique (source_city_id, request_id)
);

create table public.command_receipts (
  actor_id uuid not null,
  request_id text not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references public.cities (id) on delete cascade,
  project_id uuid,
  kind text not null,
  message text not null,
  public_safe boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS: enable; revoke direct writes to authoritative tables from authenticated role.
alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.city_economy enable row level security;
alter table public.map_chunks enable row level security;
alter table public.placed_entities enable row level security;
alter table public.occupied_tiles enable row level security;
alter table public.road_tiles enable row level security;
alter table public.portals enable row level security;
alter table public.commerce_connections enable row level security;
alter table public.delivery_policies enable row level security;
alter table public.blocked_sources enable row level security;
alter table public.parcel_receipts enable row level security;
alter table public.friendships enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_invites enable row level security;
alter table public.hosted_projects enable row level security;
alter table public.contributions enable row level security;
alter table public.blueprint_entitlements enable row level security;
alter table public.action_ledger enable row level security;
alter table public.command_receipts enable row level security;
alter table public.activity_events enable row level security;

-- Public directory / visit reads (no economy)
create policy cities_select_authenticated on public.cities
  for select to authenticated using (true);

create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid());

create policy entities_select_authenticated on public.placed_entities
  for select to authenticated using (true);

create policy roads_select_authenticated on public.road_tiles
  for select to authenticated using (true);

create policy projects_select_authenticated on public.hosted_projects
  for select to authenticated using (true);

create policy economy_select_own on public.city_economy
  for select to authenticated
  using (city_id in (select id from public.cities where owner_id = auth.uid()));

create policy ledger_select_own on public.action_ledger
  for select to authenticated
  using (source_city_id in (select id from public.cities where owner_id = auth.uid()));

-- No insert/update/delete policies for economy, portals, parcels, projects for authenticated.
-- Mutations go through SECURITY DEFINER RPCs with actor checks (see functions migration).

revoke insert, update, delete on public.city_economy from authenticated, anon;
revoke insert, update, delete on public.portals from authenticated, anon;
revoke insert, update, delete on public.parcel_receipts from authenticated, anon;
revoke insert, update, delete on public.action_ledger from authenticated, anon;
revoke insert, update, delete on public.command_receipts from authenticated, anon;
revoke insert, update, delete on public.hosted_projects from authenticated, anon;
revoke insert, update, delete on public.contributions from authenticated, anon;
revoke insert, update, delete on public.commerce_connections from authenticated, anon;
