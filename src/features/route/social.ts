/**
 * Route social actions: publish/unpublish + comments.
 *
 * - usePublishRoute: flip a finished route PRIVATE <-> PUBLIC (publish_route RPC).
 *   Publishing a completed journey is what seeds the community feed (cold-start).
 * - comments: list / add (add_comment RPC) / delete. comments_count is kept in
 *   sync by the bump_counts DB trigger, so we just invalidate the route on change.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

/* ------------------------------- publish ------------------------------- */

export interface PublishRouteInput {
  routeId: string;
  isPublic: boolean;
}

export function usePublishRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PublishRouteInput) => {
      const { data, error } = await supabase.rpc("publish_route", {
        p_route: input.routeId,
        p_public: input.isPublic,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ["route", input.routeId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["my-journeys"] });
    },
  });
}

/* ------------------------------- comments ------------------------------ */

export interface RouteComment {
  id: string;
  body: string;
  created_at: string;
  author: {
    id: string;
    display_name: string | null;
    profile_image_url: string | null;
    nationality: string | null;
  } | null;
}

const COMMENT_SELECT =
  "id, body, created_at, author:profiles!comments_user_id_fkey(id, display_name, profile_image_url, nationality)";

export async function fetchComments(routeId: string): Promise<RouteComment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("route_id", routeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RouteComment[];
}

export function useComments(routeId: string) {
  return useQuery({
    queryKey: ["comments", routeId],
    queryFn: () => fetchComments(routeId),
    enabled: !!routeId,
  });
}

export function useAddComment(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase.rpc("add_comment", {
        p_route: routeId,
        p_body: body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", routeId] });
      qc.invalidateQueries({ queryKey: ["route", routeId] }); // comments_count
    },
  });
}

export function useDeleteComment(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", routeId] });
      qc.invalidateQueries({ queryKey: ["route", routeId] });
    },
  });
}
