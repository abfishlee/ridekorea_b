-- 20260630160000_ride_photos.sql
-- Storage bucket for ride photo-pins + an owner-checked RPC to drop a spot.
-- Depends on: 20260630100000_init_schema.sql (spots table, spot_type enum).

-- ============================================================
-- 1. Storage bucket: ride-photos (public read, owner-scoped writes)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ride-photos', 'ride-photos', true)
on conflict (id) do nothing;

-- Public read so photo_url renders in feeds/detail/maps without signing.
create policy "ride photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'ride-photos');

-- Writes are scoped to the caller's own folder: {uid}/{rideId}/{ts}.ext
create policy "users upload own ride photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ride-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own ride photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'ride-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own ride photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ride-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 2. add_ride_spot: drop a photo/memo pin on the caller's own route.
--    Builds the Point geometry server-side (consistent with other RPCs).
-- ============================================================
create or replace function public.add_ride_spot(
  p_route uuid,
  p_lng double precision,
  p_lat double precision,
  p_photo_url text default null,
  p_caption text default null,
  p_spot_type spot_type default 'GENERAL',
  p_visited_at timestamptz default now())
returns public.spots language plpgsql security definer set search_path = public as $$
declare v_spot public.spots;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from routes where id = p_route and author_id = auth.uid()) then
    raise exception 'NOT_OWNER';
  end if;

  insert into spots (route_id, user_id, location, photo_url, memo, spot_type, visited_at)
  values (p_route, auth.uid(),
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
          p_photo_url, p_caption, p_spot_type, p_visited_at)
  returning * into v_spot;
  return v_spot;
end; $$;

grant execute on function
  public.add_ride_spot(uuid, double precision, double precision, text, text, spot_type, timestamptz)
to authenticated;
