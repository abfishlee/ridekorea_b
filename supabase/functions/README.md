# Supabase Edge Functions — RideKorea

Thin HTTP handlers (CORS + auth + validation) that delegate geometry/transaction
logic to SECURITY DEFINER RPCs in `supabase/migrations/20260630120000_rpc_functions.sql`.

## Functions
| Function | Body | Purpose |
|---|---|---|
| `import-route` | `{ source_route_id }` | Copy a PUBLIC route → new PRIVATE route (caller-owned) |
| `claim-voucher` | `{ region_id, lng, lat }` | Re-verify location, enforce stock + one-per-user, issue claim |
| `redeem-voucher` | `{ claim_id }` | Mark caller's claim REDEEMED |
| `award-stamp` | `{ center_id, lng, lat }` | Stamp if within 150 m of a certification center |
| `toggle-like` | `{ route_id }` | Like/unlike (counts via DB trigger) |
| `finalize-ride` | `{ route_id, track_geojson, deviated_geojson? }` | Assemble geometry, compute distance, finish ride |

## Auth model
Each function builds a Supabase client bound to the caller's JWT (`Authorization`
header). That client calls the RPC, so `auth.uid()` inside the SECURITY DEFINER
function resolves to the caller — letting the RPC bypass RLS for privileged writes
while still knowing who is acting. No service-role key is handled in app code.

## Local dev / deploy
```bash
supabase start                       # local stack
supabase functions serve             # run functions locally
supabase db push                     # apply migrations (schema + RPCs)
supabase functions deploy import-route claim-voucher redeem-voucher \
                            award-stamp toggle-like finalize-ride
```

## Client call (React Native)
```ts
const { data, error } = await supabase.functions.invoke("claim-voucher", {
  body: { region_id, lng, lat },
});
```
`supabase.functions.invoke` attaches the user's JWT automatically.

## TODO before production
- Tighten CORS `Access-Control-Allow-Origin` to the app origin.
- Add per-user rate limiting to `claim-voucher` (anti-farming).
- (Optional) strengthen anti-spoof: verify recent track passed through the region.
- `redeem-voucher`: replace user-initiated redemption with a merchant terminal /
  signed-QR flow, and resolve voucher settlement/legal (see `7_mvp_scope_and_roadmap.md`).
