-- Published-route snapshots (Tier C2)
--
-- Today a route row is BOTH the author's living journey and the public artifact
-- (publish_route just flips visibility). Editing the journey after publishing
-- silently mutates what others imported/see. This adds a frozen SNAPSHOT taken at
-- publish time (A안 SharedRoute/SharedRouteStop), so the public artifact is stable.
--
-- Non-breaking: publish_snapshot also sets the source route PUBLIC, so the existing
-- visibility-based feed keeps working while the snapshot tables become the future
-- source of truth. Migrating feed/import/social readers onto snapshots is a
-- deliberate follow-up (C2b) — not done here, to avoid destabilizing the app.

-- 1) Snapshot tables ------------------------------------------------------
create table if not exists public.published_routes (
  id               uuid primary key default gen_random_uuid(),
  route_id         uuid not null references public.routes(id)   on delete cascade,
  author_id        uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  summary          text,
  cover_photo_url  text,
  planned_geom     geometry(LineString,4326),
  track_geom       geometry(LineString,4326),
  distance_m       double precision,
  elevation_gain_m double precision,
  est_duration_s   integer,
  published_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (route_id)  -- one snapshot per source route; re-publish refreshes it
);
create index if not exists published_routes_author_idx on public.published_routes (author_id);
create index if not exists published_routes_feed_idx   on public.published_routes (published_at desc);

create table if not exists public.published_route_spots (
  id                 uuid primary key default gen_random_uuid(),
  published_route_id uuid not null references public.published_routes(id) on delete cascade,
  ordinal            integer not null default 0,
  spot_type          spot_type not null,
  title              text,
  memo               text,
  photo_url          text,
  location           geometry(Point,4326) not null
);
create index if not exists published_route_spots_parent_idx on public.published_route_spots (published_route_id, ordinal);

-- 2) RLS: public read; writes only via the SECURITY DEFINER RPCs ----------
alter table public.published_routes      enable row level security;
alter table public.published_route_spots enable row level security;
create policy "published routes readable by all" on public.published_routes      for select using (true);
create policy "published spots readable by all"  on public.published_route_spots for select using (true);
-- (no insert/update/delete policies: deny-by-default; RPCs bypass via definer)

-- table-level SELECT privilege for the API roles (RLS still gates rows)
grant select on public.published_routes      to anon, authenticated;
grant select on public.published_route_spots to anon, authenticated;

-- 3) RPCs -----------------------------------------------------------------

-- publish_snapshot: freeze the caller's journey into a public snapshot and mark
-- the source route PUBLIC. Idempotent — re-running refreshes the snapshot.
create or replace function public.publish_snapshot(p_route uuid)
returns public.published_routes language plpgsql security definer set search_path = public as $$
declare v_route public.routes; v_pub public.published_routes;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_route from routes where id = p_route and author_id = auth.uid();
  if v_route.id is null then raise exception 'NOT_OWNER'; end if;

  insert into published_routes as pr (
    route_id, author_id, title, summary, cover_photo_url,
    planned_geom, track_geom, distance_m, elevation_gain_m, est_duration_s, updated_at)
  values (
    v_route.id, v_route.author_id, v_route.title, v_route.summary, v_route.cover_photo_url,
    v_route.planned_geom, v_route.track_geom, v_route.distance_m, v_route.elevation_gain_m,
    v_route.est_duration_s, now())
  on conflict (route_id) do update set
    title = excluded.title, summary = excluded.summary, cover_photo_url = excluded.cover_photo_url,
    planned_geom = excluded.planned_geom, track_geom = excluded.track_geom,
    distance_m = excluded.distance_m, elevation_gain_m = excluded.elevation_gain_m,
    est_duration_s = excluded.est_duration_s, updated_at = now()
  returning * into v_pub;

  -- refresh the frozen spot copies
  delete from published_route_spots where published_route_id = v_pub.id;
  insert into published_route_spots (published_route_id, ordinal, spot_type, title, memo, photo_url, location)
  select v_pub.id,
         row_number() over (order by s.visited_at, s.created_at) - 1,
         s.spot_type, s.title, s.memo, s.photo_url, s.location
    from spots s where s.route_id = v_route.id;

  -- keep the existing visibility-based feed in sync (transitional)
  update routes set visibility = 'PUBLIC'::route_visibility where id = v_route.id;
  return v_pub;
end; $$;

-- unpublish_snapshot: remove the snapshot and mark the source route PRIVATE.
create or replace function public.unpublish_snapshot(p_route uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner boolean;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select exists(select 1 from routes where id = p_route and author_id = auth.uid()) into v_owner;
  if not v_owner then raise exception 'NOT_OWNER'; end if;

  delete from published_routes where route_id = p_route;  -- cascades to spots
  update routes set visibility = 'PRIVATE'::route_visibility where id = p_route;
  return true;
end; $$;

grant execute on function
  public.publish_snapshot(uuid),
  public.unpublish_snapshot(uuid)
to authenticated;
