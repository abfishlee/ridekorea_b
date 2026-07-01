// POST /functions/v1/import-route
// body: { source_route_id: string }
// Copies a PUBLIC route into a new PRIVATE route owned by the caller.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getAuth } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await getAuth(req);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: { source_route_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!body.source_route_id) return json({ error: "source_route_id required" }, 400);

  const { data, error } = await auth.supabase.rpc("import_route", {
    p_source: body.source_route_id,
  });
  if (error) return json({ error: error.message }, 400);

  return json({ route_id: data }, 201);
});
