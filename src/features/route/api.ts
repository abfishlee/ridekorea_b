import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { RouteType } from "../explore/api";

export type SpotType =
  | "SCENERY"
  | "REPAIR"
  | "FOOD"
  | "LODGING"
  | "DANGER"
  | "START"
  | "FINISH"
  | "GENERAL";

export type RouteSpot = {
  id: string;
  title: string | null;
  memo: string | null;
  photo_url: string | null;
  spot_type: SpotType;
  visited_at: string;
};

export type RouteDetail = {
  id: string;
  title: string;
  summary: string | null;
  cover_photo_url: string | null;
  type: RouteType;
  visibility: "PRIVATE" | "PUBLIC";
  status: "DRAFT" | "ACTIVE" | "FINISHED";
  distance_m: number | null;
  elevation_gain_m: number | null;
  est_duration_s: number | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: {
    id: string;
    display_name: string | null;
    profile_image_url: string | null;
    nationality: string | null;
  } | null;
  spots: RouteSpot[];
};

const DETAIL_SELECT =
  "id, title, summary, cover_photo_url, type, visibility, status, distance_m, elevation_gain_m, est_duration_s, likes_count, comments_count, created_at, author:profiles!routes_author_id_fkey(id, display_name, profile_image_url, nationality), spots(id, title, memo, photo_url, spot_type, visited_at)";

export async function fetchRouteDetail(id: string): Promise<RouteDetail> {
  const { data, error } = await supabase
    .from("routes")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .order("visited_at", { referencedTable: "spots", ascending: true })
    .single();
  if (error) throw error;
  return data as unknown as RouteDetail;
}

export function useRouteDetail(id: string) {
  return useQuery({
    queryKey: ["route", id],
    queryFn: () => fetchRouteDetail(id),
    enabled: !!id,
  });
}

/** Copy a public route into the caller's own PRIVATE DRAFT. Returns new route id. */
export function useImportRoute() {
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await supabase.rpc("import_route", { p_source: sourceId });
      if (error) throw error;
      return data as string;
    },
  });
}

/** Toggle like; returns true if now liked. Counts are updated by a DB trigger. */
export function useToggleLike(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("toggle_like", { p_route: routeId });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route", routeId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

/** Route geometry (finished track or planned path) as [lng, lat][] for the map. */
export function useRoutePath(id: string) {
  return useQuery({
    queryKey: ["route-path", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("route_path_geojson", { p_route: id });
      if (error) throw error;
      if (!data) return [] as [number, number][];
      try {
        const geo = JSON.parse(data as string);
        if (geo?.type === "LineString") return geo.coordinates as [number, number][];
        if (geo?.type === "MultiLineString")
          return (geo.coordinates as [number, number][][]).flat();
      } catch {
        // malformed geometry → empty path
      }
      return [] as [number, number][];
    },
  });
}

/** Route spots as map markers: [{ lng, lat, type, title }]. */
export function useRouteSpots(id: string) {
  return useQuery({
    queryKey: ["route-spots", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("route_spots_geojson", { p_route: id });
      if (error) throw error;
      return (data ?? []) as { lng: number; lat: number; type: string; title: string | null }[];
    },
  });
}
