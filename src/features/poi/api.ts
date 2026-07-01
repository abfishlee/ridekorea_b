/**
 * POI data + crowd moderation actions (Tier B1/B2 backend → app).
 *
 * - usePoi: a single approved POI with provenance + logistics + feedback counts.
 * - useMyPoiFeedback: the caller's current recommend/caution on this POI (if any).
 * - useSetPoiFeedback: set/switch/clear feedback via the set_poi_feedback RPC
 *   (server keeps pois.recommend_count/caution_count in sync via trigger).
 * - useCreateReport: file a moderation report via the create_report RPC.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export type PoiType =
  | "RESTAURANT"
  | "CAFE"
  | "REPAIR"
  | "BICYCLE_SHOP"
  | "LODGING"
  | "CAMPSITE"
  | "CONVENIENCE"
  | "REST_AREA"
  | "TRANSPORT"
  | "CERT_CENTER";

export type FeedbackType = "recommend" | "caution";

export interface Poi {
  id: string;
  poi_type: PoiType;
  name: string | null;
  name_en: string | null;
  source_name: string | null;
  source_url: string | null;
  license_type: string | null;
  attribution: string | null;
  transport_mode: string | null;
  bike_policy: string | null;
  bike_policy_en: string | null;
  packing_required: boolean | null;
  packing_notes: string | null;
  packing_notes_en: string | null;
  booking_url: string | null;
  recommend_count: number;
  caution_count: number;
}

const POI_SELECT =
  "id, poi_type, name, name_en, source_name, source_url, license_type, attribution, " +
  "transport_mode, bike_policy, bike_policy_en, packing_required, packing_notes, " +
  "packing_notes_en, booking_url, recommend_count, caution_count";

export async function fetchPoi(id: string): Promise<Poi> {
  const { data, error } = await supabase
    .from("pois")
    .select(POI_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as Poi;
}

export function usePoi(id: string) {
  return useQuery({
    queryKey: ["poi", id],
    queryFn: () => fetchPoi(id),
    enabled: !!id,
  });
}

export async function fetchMyPoiFeedback(
  id: string,
  userId: string,
): Promise<FeedbackType | null> {
  const { data, error } = await supabase
    .from("poi_feedback")
    .select("feedback_type")
    .eq("poi_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return ((data?.feedback_type as FeedbackType | undefined) ?? null);
}

export function useMyPoiFeedback(id: string, userId: string | undefined) {
  return useQuery({
    queryKey: ["poi-feedback", id, userId],
    queryFn: () => fetchMyPoiFeedback(id, userId as string),
    enabled: !!id && !!userId,
  });
}

export interface PoiFeedbackResult {
  recommend_count: number;
  caution_count: number;
  my_feedback: FeedbackType | null;
}

/** Set 'recommend' | 'caution', or pass null to clear. Returns fresh counts. */
export function useSetPoiFeedback(id: string, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (type: FeedbackType | null): Promise<PoiFeedbackResult> => {
      // p_type accepts null (= clear) server-side, but the generated RPC type marks
      // it as a required string, so cast through unknown for the null/clear case.
      const { data, error } = await supabase.rpc("set_poi_feedback", {
        p_poi: id,
        p_type: type as unknown as string,
      });
      if (error) throw error;
      const row = (data as unknown as PoiFeedbackResult[])?.[0];
      return row ?? { recommend_count: 0, caution_count: 0, my_feedback: null };
    },
    onSuccess: (result) => {
      // Push the authoritative counts + my state straight into cache (no flash).
      qc.setQueryData<Poi | undefined>(["poi", id], (old) =>
        old
          ? {
              ...old,
              recommend_count: result.recommend_count,
              caution_count: result.caution_count,
            }
          : old,
      );
      qc.setQueryData(["poi-feedback", id, userId], result.my_feedback);
    },
  });
}

export interface CreateReportInput {
  targetType: string; // 'POI' | 'ROUTE' | 'SPOT' | 'COMMENT' | 'TIP'
  targetId: string;
  reason: string;
}

export function useCreateReport() {
  return useMutation({
    mutationFn: async (input: CreateReportInput) => {
      const { data, error } = await supabase.rpc("create_report", {
        p_target_type: input.targetType,
        p_target: input.targetId,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data;
    },
  });
}
