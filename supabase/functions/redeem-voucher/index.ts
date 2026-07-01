// POST /functions/v1/redeem-voucher
// body: { claim_id: string }  ->  marks the caller's ISSUED claim as REDEEMED.
// MVP: user-initiated at the counter. v2: merchant terminal / signed QR redemption.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getAuth } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await getAuth(req);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: { claim_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (!body.claim_id) return json({ error: "claim_id required" }, 400);

  const { data, error } = await auth.supabase.rpc("redeem_voucher", { p_claim: body.claim_id });
  if (error) {
    const status = error.message === "NOT_REDEEMABLE" ? 409 : 400;
    return json({ error: error.message }, status);
  }
  return json({ claim: data }, 200);
});
