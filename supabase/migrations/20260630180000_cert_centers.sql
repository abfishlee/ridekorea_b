-- 20260630180000_cert_centers.sql
-- Certification centers as a flat JSON list (id/name/corridor + lng/lat) for the
-- stamp passport map. Points come back as lng/lat so the client needs no WKB parsing.

create or replace function public.certification_centers_geojson()
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', c.id,
        'name', c.name,
        'name_en', c.name_en,
        'corridor', c.corridor,
        'lng', ST_X(c.location),
        'lat', ST_Y(c.location)
      ) order by c.corridor, c.name
    ),
    '[]'::json)
  from certification_centers c;
$$;

grant execute on function public.certification_centers_geojson() to anon, authenticated;
