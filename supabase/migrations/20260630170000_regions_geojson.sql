-- 20260630170000_regions_geojson.sql
-- Nearby region boundaries as GeoJSON, for the client geofence cache.
-- Client downloads these once near the route, then runs point-in-polygon
-- locally; the server still re-verifies on claim_voucher.

create or replace function public.nearby_regions_geojson(
  p_lng double precision,
  p_lat double precision,
  p_radius_m double precision default 50000)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', r.id,
        'name', r.name,
        'name_en', r.name_en,
        'geojson', ST_AsGeoJSON(r.boundary)::json
      ) order by r.name
    ),
    '[]'::json)
  from regions r
  where ST_DWithin(
    r.boundary::geography,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_radius_m);
$$;

grant execute on function
  public.nearby_regions_geojson(double precision, double precision, double precision)
to anon, authenticated;
