// POST /functions/v1/finalize-ride
// body: { route_id: string, track_geojson: string, deviated_geojson?: string }
//   track_geojson:    GeoJSON LineString (the path actually ridden)
//   deviated_geojson: GeoJSON MultiLineString (the pink "my own path" segments)
// Assembles geometry, computes distance, marks the ride FINISHED, bumps profile total.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getAuth } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await getAuth(req);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: { route_id?: string; track_geojson?: string; deviated_geojson?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!body.route_id || !body.track_geojson) {
    return json({ error: "route_id and track_geojson required" }, 400);
  }

  const { data, error } = await auth.supabase.rpc("finalize_ride", {
    p_route: body.route_id,
    p_track_geojson: body.track_geojson,
    p_deviated_geojson: body.deviated_geojson ?? null,
  });

  if (error) {
    const status = error.message === "NOT_OWNER" ? 403 : 400;
    return json({ error: error.message }, status);
  }
  return json({ route: data }, 200);
});
