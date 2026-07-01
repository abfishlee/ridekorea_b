-- RPC functions backing the Edge Functions.
-- Geometry + validation lives here (atomic, RLS-bypassing via SECURITY DEFINER)
-- while Edge Functions stay thin (CORS, auth, input validation, rate limiting).
-- Called via a USER-context client so auth.uid() resolves to the caller.

-- 1. import_route: copy a PUBLIC route into a new PRIVATE route owned by caller.
create or replace function public.import_route(p_source uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_src record;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_src from routes where id = p_source and visibility = 'PUBLIC';
  if not found then raise exception 'SOURCE_NOT_FOUND'; end if;

  insert into routes (author_id, source_route_id, type, visibility, status,
                      title, summary, planned_geom, distance_m, est_duration_s)
  values (auth.uid(), v_src.id, 'USER', 'PRIVATE', 'DRAFT',
          v_src.title, v_src.summary, v_src.planned_geom, v_src.distance_m, v_src.est_duration_s)
  returning id into v_id;
  return v_id;
end; $$;

-- 2. claim_voucher: re-verify location server-side, enforce quantity + one-per-user.
create or replace function public.claim_voucher(
  p_region uuid, p_lng double precision, p_lat double precision)
returns public.voucher_claims language plpgsql security definer set search_path = public as $$
declare v_loc geometry; v_voucher record; v_claim public.voucher_claims;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_loc := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

  -- (anti-spoof) caller must actually be inside the region
  if not exists (select 1 from regions where id = p_region and ST_Contains(boundary, v_loc)) then
    raise exception 'OUTSIDE_REGION';
  end if;

  -- pick one active voucher with stock, locked to avoid oversell
  select * into v_voucher from vouchers
   where region_id = p_region and is_active
     and (valid_from is null or now() >= valid_from)
     and (valid_to   is null or now() <= valid_to)
     and (total_quantity is null or issued_count < total_quantity)
   order by created_at
   limit 1 for update;
  if not found then raise exception 'NO_VOUCHER_AVAILABLE'; end if;

  insert into voucher_claims (voucher_id, user_id, code)
  values (v_voucher.id, auth.uid(),
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
  on conflict (voucher_id, user_id) do nothing
  returning * into v_claim;
  if v_claim.id is null then raise exception 'ALREADY_CLAIMED'; end if;

  update vouchers set issued_count = issued_count + 1 where id = v_voucher.id;
  return v_claim;
end; $$;

-- 3. redeem_voucher: mark a claim used (MVP: user-initiated; v2: merchant terminal).
create or replace function public.redeem_voucher(p_claim uuid)
returns public.voucher_claims language plpgsql security definer set search_path = public as $$
declare v_claim public.voucher_claims;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  update voucher_claims set status = 'REDEEMED', redeemed_at = now()
   where id = p_claim and user_id = auth.uid() and status = 'ISSUED'
  returning * into v_claim;
  if v_claim.id is null then raise exception 'NOT_REDEEMABLE'; end if;
  return v_claim;
end; $$;

-- 4. award_stamp: GPS-proximity certification (within 150 m of a center).
create or replace function public.award_stamp(
  p_center uuid, p_lng double precision, p_lat double precision)
returns public.stamps language plpgsql security definer set search_path = public as $$
declare v_loc geometry; v_stamp public.stamps;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_loc := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

  if not exists (select 1 from certification_centers
                 where id = p_center
                   and ST_DWithin(location::geography, v_loc::geography, 150)) then
    raise exception 'TOO_FAR';
  end if;

  insert into stamps (user_id, center_id) values (auth.uid(), p_center)
  on conflict (user_id, center_id) do nothing
  returning * into v_stamp;
  if v_stamp.user_id is null then
    select * into v_stamp from stamps where user_id = auth.uid() and center_id = p_center;
  end if;
  return v_stamp;
end; $$;

-- 5. toggle_like: returns true if now liked, false if unliked. Counts via trigger.
create or replace function public.toggle_like(p_route uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if exists (select 1 from likes where route_id = p_route and user_id = auth.uid()) then
    delete from likes where route_id = p_route and user_id = auth.uid();
    return false;
  else
    insert into likes (route_id, user_id) values (p_route, auth.uid());
    return true;
  end if;
end; $$;

-- 6. finalize_ride: client posts the assembled track/deviated paths as GeoJSON.
--    (MVP keeps raw points local; a server track_points table for crash-recovery
--     is a v1 option.) Builds geometry, computes distance, updates profile total.
create or replace function public.finalize_ride(
  p_route uuid, p_track_geojson text, p_deviated_geojson text default null)
returns public.routes language plpgsql security definer set search_path = public as $$
declare v_track geometry; v_dev geometry; v_dist double precision; v_route public.routes;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from routes where id = p_route and author_id = auth.uid()) then
    raise exception 'NOT_OWNER';
  end if;

  v_track := ST_SetSRID(ST_GeomFromGeoJSON(p_track_geojson), 4326);
  if p_deviated_geojson is not null then
    v_dev := ST_SetSRID(ST_GeomFromGeoJSON(p_deviated_geojson), 4326);
  end if;
  v_dist := ST_Length(v_track::geography);

  update routes
     set track_geom = v_track, deviated_geom = v_dev, distance_m = v_dist,
         status = 'FINISHED', ended_at = now()
   where id = p_route
  returning * into v_route;

  update profiles set total_distance_m = total_distance_m + v_dist where id = auth.uid();
  return v_route;
end; $$;

-- Expose RPCs to authenticated callers.
grant execute on function
  public.import_route(uuid),
  public.claim_voucher(uuid, double precision, double precision),
  public.redeem_voucher(uuid),
  public.award_stamp(uuid, double precision, double precision),
  public.toggle_like(uuid),
  public.finalize_ride(uuid, text, text)
to authenticated;
