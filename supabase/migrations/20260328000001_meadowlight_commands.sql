-- Command boundary sketch: settle + spend helpers.
-- Full command surface mirrors src/game/adapters/types.ts.
-- Deploy with Supabase CLI; call only via authenticated RPC.

create or replace function public.ml_floor_div(n bigint, d bigint)
returns bigint
language sql
immutable
as $$
  select case
    when n >= 0 then n / d
    when n % d = 0 then n / d
    else n / d - 1
  end;
$$;

create or replace function public.ml_settle_action_window(
  p_actions smallint,
  p_window_start timestamptz,
  p_now timestamptz
)
returns table (actions_remaining smallint, action_window_start_at timestamptz)
language plpgsql
stable
as $$
declare
  h interval := interval '12 hours';
  elapsed int;
begin
  elapsed := floor(extract(epoch from (greatest(p_now, p_window_start) - p_window_start)) / extract(epoch from h));
  if elapsed <= 0 then
    actions_remaining := p_actions;
    action_window_start_at := p_window_start;
  else
    actions_remaining := 2;
    action_window_start_at := p_window_start + (elapsed * h);
  end if;
  return next;
end;
$$;

-- Placeholder RPC: create city for actor. Expand with starter entities in seed/application layer.
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
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.cities where owner_id = auth.uid()) then
    raise exception 'city already exists';
  end if;
  insert into public.profiles (id, display_name)
  values (auth.uid(), coalesce(p_name, 'Neighbor'))
  on conflict (id) do nothing;

  insert into public.cities (owner_id, name, specialty, scene_id, seed)
  values (auth.uid(), p_name, p_specialty, sid, (extract(epoch from now()) * 1000)::bigint)
  returning id into cid;

  insert into public.city_economy (city_id) values (cid);
  insert into public.delivery_policies (city_id) values (cid);
  return cid;
end;
$$;

revoke all on function public.ml_create_city(text, text) from public;
grant execute on function public.ml_create_city(text, text) to authenticated;
