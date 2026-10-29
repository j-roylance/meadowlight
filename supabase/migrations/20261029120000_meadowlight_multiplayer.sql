-- Multiplayer: city snapshots, specialty/wood fixes, directory helpers.
-- Authoritative playable state for authenticated accounts is city_snapshots.state.

-- Specialty: timber → wood (align with TypeScript Specialty).
alter table public.cities drop constraint if exists cities_specialty_check;
update public.cities set specialty = 'wood' where specialty = 'timber';
alter table public.cities
  add constraint cities_specialty_check
  check (specialty in ('markets', 'wood', 'stone'));

-- Finish timber → wood on rem/rate columns if still present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'city_economy' and column_name = 'rem_timber'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'city_economy' and column_name = 'rem_wood'
  ) then
    alter table public.city_economy rename column rem_timber to rem_wood;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'city_economy' and column_name = 'rate_timber'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'city_economy' and column_name = 'rate_wood'
  ) then
    alter table public.city_economy rename column rate_timber to rate_wood;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'parcel_receipts' and column_name = 'timber'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'parcel_receipts' and column_name = 'wood'
  ) then
    alter table public.parcel_receipts rename column timber to wood;
  end if;
end $$;

alter table public.city_economy
  add column if not exists rem_wood numeric not null default 0,
  add column if not exists rate_wood integer not null default 0;

alter table public.parcel_receipts
  add column if not exists wood integer not null default 0,
  add column if not exists research integer not null default 0,
  add column if not exists happiness integer not null default 0;

-- Full CityState JSON (bigint coords encoded as { "__bigint": "n" }).
create table if not exists public.city_snapshots (
  city_id uuid primary key references public.cities (id) on delete cascade,
  revision bigint not null default 1,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Shared commerce pairs for rate refresh across accounts.
create table if not exists public.mp_commerce (
  id int primary key default 1 check (id = 1),
  pairs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.mp_commerce (id, pairs)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

alter table public.city_snapshots enable row level security;
alter table public.mp_commerce enable row level security;

-- Owners can read their own snapshot; directory uses denormalized cities/economy via API.
drop policy if exists city_snapshots_owner_select on public.city_snapshots;
create policy city_snapshots_owner_select on public.city_snapshots
  for select to authenticated using (
    exists (
      select 1 from public.cities c
      where c.id = city_id and c.owner_id = auth.uid()
    )
  );

-- Public visit: any authenticated user may read snapshots for map browsing
-- (home privacy is enforced in the application layer when projecting summaries).
drop policy if exists city_snapshots_authenticated_select on public.city_snapshots;
create policy city_snapshots_authenticated_select on public.city_snapshots
  for select to authenticated using (true);

revoke insert, update, delete on public.city_snapshots from authenticated, anon;
revoke insert, update, delete on public.mp_commerce from authenticated, anon;

create or replace function public.ml_get_my_city_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.cities where owner_id = auth.uid() limit 1;
$$;

revoke all on function public.ml_get_my_city_id() from public;
grant execute on function public.ml_get_my_city_id() to authenticated;

create or replace function public.ml_list_directory(p_query text default null)
returns table (
  city_id uuid,
  name text,
  display_name text,
  specialty text,
  population int,
  amenity int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    coalesce(p.display_name, c.name),
    c.specialty,
    8::int,
    4::int
  from public.cities c
  left join public.profiles p on p.id = c.owner_id
  where c.onboarding_complete = true
    and c.owner_id is distinct from auth.uid()
    and (
      p_query is null
      or p_query = ''
      or c.name ilike '%' || p_query || '%'
      or p.display_name ilike '%' || p_query || '%'
    )
  order by c.name
  limit 100;
$$;

revoke all on function public.ml_list_directory(text) from public;
grant execute on function public.ml_list_directory(text) to authenticated;

-- Replace create-city to accept wood specialty and seed an empty snapshot row.
create or replace function public.ml_create_city(
  p_name text,
  p_specialty text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  sid uuid := gen_random_uuid();
  spec text := p_specialty;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.cities where owner_id = auth.uid()) then
    raise exception 'city already exists';
  end if;
  if spec = 'timber' then
    spec := 'wood';
  end if;
  if spec not in ('markets', 'wood', 'stone') then
    raise exception 'invalid specialty';
  end if;

  insert into public.profiles (id, display_name)
  values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'Neighbor'))
  on conflict (id) do update
    set display_name = excluded.display_name;

  insert into public.cities (owner_id, name, specialty, scene_id, seed, onboarding_complete)
  values (
    auth.uid(),
    coalesce(nullif(trim(p_name), ''), 'Meadowlight'),
    spec,
    sid,
    (extract(epoch from now()) * 1000)::bigint,
    false
  )
  returning id into cid;

  insert into public.city_economy (city_id) values (cid);
  insert into public.delivery_policies (city_id) values (cid);
  insert into public.city_expansion (city_id) values (cid);
  insert into public.city_snapshots (city_id, revision, state)
  values (cid, 1, '{}'::jsonb);

  return cid;
end;
$$;

revoke all on function public.ml_create_city(text, text) from public;
grant execute on function public.ml_create_city(text, text) to authenticated;

comment on table public.city_snapshots is
  'Authoritative CityState JSON for multiplayer. Mutations via Next.js API + service role.';
