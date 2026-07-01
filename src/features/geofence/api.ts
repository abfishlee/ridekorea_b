/**
 * Geofence + voucher-claim client API.
 *
 * `fetchNearbyRegions` pulls region polygons near the rider once (for the local
 * geofence cache); `claimVoucher` posts a claim that the server re-verifies with
 * PostGIS (location, stock, one-per-user). The pure detector lives in ./geofence.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { GeofenceRegion } from "./geofence";

interface RegionGeoJSONRow {
  id: string;
  name: string | null;
  name_en: string | null;
  geojson: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  } | null;
}

/** Fetch region boundaries near a point, shaped for the geofence detector. */
export async function fetchNearbyRegions(
  lng: number,
  lat: number,
  radiusM = 50000,
): Promise<GeofenceRegion[]> {
  const { data, error } = await supabase.rpc("nearby_regions_geojson", {
    p_lng: lng,
    p_lat: lat,
    p_radius_m: radiusM,
  });
  if (error) throw error;

  const rows = (data ?? []) as unknown as RegionGeoJSONRow[];
  return rows
    .filter(
      (r): r is RegionGeoJSONRow & { geojson: NonNullable<RegionGeoJSONRow["geojson"]> } =>
        !!r.geojson &&
        (r.geojson.type === "Polygon" || r.geojson.type === "MultiPolygon"),
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.geojson.type,
      coordinates: r.geojson.coordinates,
    }));
}

export interface ClaimVoucherInput {
  regionId: string;
  lng: number;
  lat: number;
}

/** Claim a voucher in a region; the server re-verifies location/stock/one-per-user. */
export async function claimVoucher(input: ClaimVoucherInput) {
  const { data, error } = await supabase.rpc("claim_voucher", {
    p_region: input.regionId,
    p_lng: input.lng,
    p_lat: input.lat,
  });
  if (error) throw error;
  return data;
}

export function useClaimVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: claimVoucher,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voucher-claims"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
