/**
 * Ride finalize API.
 *
 * At the end of a ride the client posts the assembled track + deviated paths as
 * GeoJSON to the `finalize_ride` RPC, which (server-side) verifies ownership,
 * builds geometry, computes true distance, flips the route to FINISHED, and bumps
 * the rider's lifetime distance. Only after the server confirms do we clear the
 * local outbox rows — so a failed sync keeps the ride recoverable.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export interface FinalizeRideInput {
  routeId: string;
  trackGeoJSON: string;
  deviatedGeoJSON?: string | null;
}

/** Low-level call: posts GeoJSON to finalize_ride and returns the updated route row. */
export async function submitFinalizeRide(input: FinalizeRideInput) {
  const { data, error } = await supabase.rpc("finalize_ride", {
    p_route: input.routeId,
    p_track_geojson: input.trackGeoJSON,
    p_deviated_geojson: input.deviatedGeoJSON ?? undefined,
  });
  if (error) throw error;
  return data;
}

export interface FinalizeSource {
  rideId: string;
  routeId: string;
  trackGeoJSON: string | null;
  deviatedGeoJSON: string | null;
}

export type FinalizeOutcome =
  | { finalized: true; route: unknown }
  | { finalized: false; reason: "EMPTY_TRACK" };

/**
 * Orchestrates the end-of-ride flow: submit to the server, then clear the local
 * outbox. If the track is too short to form a line, skip the server call and just
 * clear locally. On a server error this throws (outbox is preserved for retry).
 */
export async function finalizeAndClear(
  src: FinalizeSource,
  discard: (rideId: string) => Promise<void>,
): Promise<FinalizeOutcome> {
  if (!src.trackGeoJSON) {
    await discard(src.rideId);
    return { finalized: false, reason: "EMPTY_TRACK" };
  }
  const route = await submitFinalizeRide({
    routeId: src.routeId,
    trackGeoJSON: src.trackGeoJSON,
    deviatedGeoJSON: src.deviatedGeoJSON,
  });
  await discard(src.rideId);
  return { finalized: true, route };
}

/** React hook wrapping finalize_ride, invalidating the affected route/feed caches. */
export function useFinalizeRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitFinalizeRide,
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["route", input.routeId] });
      qc.invalidateQueries({ queryKey: ["route-path", input.routeId] });
      qc.invalidateQueries({ queryKey: ["route-spots", input.routeId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
