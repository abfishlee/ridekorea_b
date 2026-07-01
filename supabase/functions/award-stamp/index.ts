// POST /functions/v1/award-stamp
// body: { center_id: string, lng: number, lat: number }
// Awards a certification stamp only if the caller is within 150 m of the center.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getAuth } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await getAuth(req);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: { center_id?: string; lng?: number; lat?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!body.center_id || typeof body.lng !== "number" || typeof body.lat !== "number") {
    return json({ error: "center_id, lng, lat required" }, 400);
  }

  const { data, error } = await auth.supabase.rpc("award_stamp", {
    p_center: body.center_id,
    p_lng: body.lng,
    p_lat: body.lat,
  });
  if (error) {
    const status = error.message === "TOO_FAR" ? 403 : 400;
    return json({ error: error.message }, status);
  }
  return json({ stamp: data }, 201);
});
