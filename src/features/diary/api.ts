/**
 * Diary / My Journeys data.
 *
 * The caller's own routes (owned copies + finished rides), newest first. This is
 * the entry point to routes you can ride again or publish — reachable without
 * re-importing. RLS lets the owner see their PRIVATE rows, so we filter by
 * author_id to return only mine (not the public feed).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { RouteType } from "../explore/api";

export type JourneyStatus = "DRAFT" | "ACTIVE" | "FINISHED";
export type JourneyVisibility = "PRIVATE" | "PUBLIC";

export interface MyJourney {
  id: string;
  title: string;
  cover_photo_url: string | null;
  type: RouteType;
  status: JourneyStatus;
  visibility: JourneyVisibility;
  distance_m: number | null;
  est_duration_s: number | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

const MY_SELECT =
  "id, title, cover_photo_url, type, status, visibility, distance_m, est_duration_s, likes_count, comments_count, created_at";

export async function fetchMyJourneys(userId: string): Promise<MyJourney[]> {
  const { data, error } = await supabase
    .from("routes")
    .select(MY_SELECT)
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyJourney[];
}

export function useMyJourneys(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-journeys"],
    queryFn: () => fetchMyJourneys(userId as string),
    enabled: !!userId,
  });
}
