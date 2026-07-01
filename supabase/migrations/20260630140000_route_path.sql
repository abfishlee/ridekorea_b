-- Route path as GeoJSON for the map adapter (Web Dynamic Map polyline).
-- SECURITY INVOKER (default): RLS on `routes` restricts to PUBLIC or own routes.
-- Returns the finished track if present, else the planned path.

create or replace function public.route_path_geojson(p_route uuid)
returns text language sql stable set search_path = public as $$
  select ST_AsGeoJSON(coalesce(track_geom, planned_geom))
  from routes
  where id = p_route;
$$;

grant execute on function public.route_path_geojson(uuid) to anon, authenticated;
