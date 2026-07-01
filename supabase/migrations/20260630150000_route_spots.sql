-- Spots of a route as a JSON array of points for map markers.
-- SECURITY INVOKER (default): RLS on spots/routes restricts visibility.

create or replace function public.route_spots_geojson(p_route uuid)
returns json language sql stable set search_path = public as $$
  select coalesce(
    json_agg(
      json_build_object(
        'lng', ST_X(location),
        'lat', ST_Y(location),
        'type', spot_type,
        'title', title
      ) order by visited_at
    ),
    '[]'::json
  )
  from spots
  where route_id = p_route;
$$;

grant execute on function public.route_spots_geojson(uuid) to anon, authenticated;
