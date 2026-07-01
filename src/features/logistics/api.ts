/**
 * Logistics guide board (Phase 7.2).
 *
 * A community board of practical tips for foreign cyclists (airport bike
 * baggage, KTX/subway policy, rentals, lodging...). Tips are readable by all;
 * signed-in riders can upvote (toggle_tip_upvote RPC keeps logistics_tips.upvotes
 * in sync via a trigger, so we just invalidate on change).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export type LogisticsTip = {
  id: string;
  category: string | null;
  title: string;
  body: string;
  region: string | null;
  upvotes: number;
  created_at: string;
};

const TIP_SELECT = "id, category, title, body, region, upvotes, created_at";

/** All tips, most-upvoted first (newest breaks ties). */
export async function fetchLogisticsTips(): Promise<LogisticsTip[]> {
  const { data, error } = await supabase
    .from("logistics_tips")
    .select(TIP_SELECT)
    .order("upvotes", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LogisticsTip[];
}

export function useLogisticsTips() {
  return useQuery({
    queryKey: ["logistics-tips"],
    queryFn: fetchLogisticsTips,
  });
}

/** Tip ids the current user has upvoted (empty when signed out). */
export async function fetchMyTipVotes(userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("logistics_tip_votes")
    .select("tip_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { tip_id: string }).tip_id);
}

export function useMyTipVotes(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-tip-votes", userId ?? "anon"],
    queryFn: () => fetchMyTipVotes(userId),
    enabled: !!userId,
  });
}

/** Toggle upvote on a tip; resolves to true if now upvoted, false if cleared. */
export function useToggleTipUpvote(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tipId: string) => {
      const { data, error } = await supabase.rpc("toggle_tip_upvote", { p_tip: tipId });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logistics-tips"] });
      qc.invalidateQueries({ queryKey: ["my-tip-votes", userId ?? "anon"] });
    },
  });
}
