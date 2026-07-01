// POST /functions/v1/claim-voucher
// body: { region_id: string, lng: number, lat: number }
// Server re-verifies the caller is inside the region (anti-spoof), enforces
// stock + one-per-user, and issues a claim into the caller's Wallet.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getAuth } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await getAuth(req);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: { region_id?: string; lng?: number; lat?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!body.region_id || typeof body.lng !== "number" || typeof body.lat !== "number") {
    return json({ error: "region_id, lng, lat required" }, 400);
  }

  // TODO: add per-user rate limiting here (e.g. KV / a claims-per-minute check)
  const { data, error } = await auth.supabase.rpc("claim_voucher", {
    p_region: body.region_id,
    p_lng: body.lng,
    p_lat: body.lat,
  });

  if (error) {
    // Map domain errors to friendly statuses.
    const code = error.message;
    const status = code === "ALREADY_CLAIMED" ? 409
      : code === "OUTSIDE_REGION" ? 403
      : code === "NO_VOUCHER_AVAILABLE" ? 410
      : 400;
    return json({ error: code }, status);
  }

  return json({ claim: data }, 201);
});
