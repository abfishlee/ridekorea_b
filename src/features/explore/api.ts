import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export type RouteType = "USER" | "OFFICIAL";

export type FeedAuthor = {
  display_name: string | null;
  profile_image_url: string | null;
  nationality: string | null;
};

export type FeedRoute = {
  id: string;
  title: string;
  summary: string | null;
  cover_photo_url: string | null;
  type: RouteType;
  distance_m: number | null;
  elevation_gain_m: number | null;
  est_duration_s: number | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: FeedAuthor | null;
};

// Select only feed-relevant columns (skip geometry to keep payloads light).
const FEED_SELECT =
  "id, title, summary, cover_photo_url, type, distance_m, elevation_gain_m, est_duration_s, likes_count, comments_count, created_at, author:profiles!routes_author_id_fkey(display_name, profile_image_url, nationality)";

export async function fetchFeed(type: RouteType): Promise<FeedRoute[]> {
  const { data, error } = await supabase
    .from("routes")
    .select(FEED_SELECT)
    .eq("visibility", "PUBLIC")
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) throw error;
  // PostgREST returns the embedded author as an object for a to-one relationship.
  return (data ?? []) as unknown as FeedRoute[];
}

export function useFeed(type: RouteType) {
  return useQuery({
    queryKey: ["feed", type],
    queryFn: () => fetchFeed(type),
  });
}

// --- formatting helpers ---
export function formatDistance(m: number | null): string {
  if (!m) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
}

export function formatDuration(s: number | null): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const min = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

/** ISO 3166-1 alpha-2 → flag emoji. */
export function flagEmoji(cc: string | null): string {
  if (!cc || cc.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65),
  );
}
