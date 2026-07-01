/**
 * Stamp passport API (4대강 certification centers).
 *
 * - fetchCertificationCenters: all centers (id/name/corridor + lng/lat)
 * - fetchMyStamps:             the caller's earned stamps (RLS-scoped)
 * - awardStamp:                award_stamp RPC (server re-checks 150 m proximity)
 *
 * The pure passport view-model + types live in ./passport (re-exported here).
 * The server enforces proximity + idempotency; the client check is a cheap gate.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { CertificationCenter, StampRow } from "./passport";

export type {
  CertificationCenter,
  StampRow,
  PassportEntry,
  CorridorProgress,
  Passport,
} from "./passport";
export { buildPassport } from "./passport";

export async function fetchCertificationCenters(): Promise<CertificationCenter[]> {
  const { data, error } = await supabase.rpc("certification_centers_geojson");
  if (error) throw error;
  return (data ?? []) as unknown as CertificationCenter[];
}

export function useCertificationCenters() {
  return useQuery({
    queryKey: ["cert-centers"],
    queryFn: fetchCertificationCenters,
    staleTime: 1000 * 60 * 60, // centers rarely change
  });
}

export async function fetchMyStamps(): Promise<StampRow[]> {
  const { data, error } = await supabase
    .from("stamps")
    .select("center_id, stamped_at")
    .order("stamped_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StampRow[];
}

export function useMyStamps() {
  return useQuery({ queryKey: ["my-stamps"], queryFn: fetchMyStamps });
}

export interface AwardStampInput {
  centerId: string;
  lng: number;
  lat: number;
}

/** Award a stamp; server raises TOO_FAR if not within 150 m, idempotent on repeat. */
export async function awardStamp(input: AwardStampInput) {
  const { data, error } = await supabase.rpc("award_stamp", {
    p_center: input.centerId,
    p_lng: input.lng,
    p_lat: input.lat,
  });
  if (error) throw error;
  return data;
}

export function useAwardStamp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: awardStamp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-stamps"] }),
  });
}
