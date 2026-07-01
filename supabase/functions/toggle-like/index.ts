// POST /functions/v1/toggle-like
// body: { route_id: string }  ->  { liked: boolean }
import { corsHeaders, json } from "../_shared/cors.ts";
import { getAuth } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await getAuth(req);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: { route_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!body.route_id) return json({ error: "route_id required" }, 400);

  const { data, error } = await auth.supabase.rpc("toggle_like", { p_route: body.route_id });
  if (error) return json({ error: error.message }, 400);
  return json({ liked: data }, 200);
});
