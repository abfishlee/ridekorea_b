/**
 * Ride photo-pin pipeline.
 *
 * Capture → queue (instant, offline-safe) → on sync: upload to Storage, drop a
 * spot pin on the rider's route, mark synced.
 *
 *   queueRidePhoto()  – called the moment a photo is taken (writes to outbox only)
 *   syncRidePhotos()  – drains the queue: upload + add_ride_spot + mark synced
 *
 * Photos are queued first so a pin is never lost when offline; the heavy work
 * (upload + DB) happens opportunistically and is retried on the next sync.
 *
 * Touches native FS + network, so it's exercised on-device (with the camera UI
 * in 4.1), not in the Node unit tests. The Storage bucket + add_ride_spot RPC it
 * depends on are verified against the local DB.
 */

import { File } from "expo-file-system";
import { supabase } from "../../lib/supabase";
import type { SpotType } from "../route/api";
import * as outbox from "./outbox";

const BUCKET = "ride-photos";

export interface RidePhotoInput {
  rideId: string;
  localUri: string;
  lng: number | null;
  lat: number | null;
  caption?: string | null;
  spotType?: SpotType;
  t?: number;
}

/** Instant + offline-safe: queue the photo the moment it's captured. */
export async function queueRidePhoto(input: RidePhotoInput): Promise<void> {
  await outbox.initOutbox();
  await outbox.enqueuePhoto({
    rideId: input.rideId,
    localUri: input.localUri,
    lng: input.lng,
    lat: input.lat,
    caption: input.caption ?? null,
    spotType: input.spotType ?? "GENERAL",
    t: input.t ?? Date.now(),
  });
}

function contentTypeFor(uri: string): { ext: string; contentType: string } {
  const ext = (uri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { ext, contentType };
}

/** Upload a local image file to Storage; returns its public URL. */
export async function uploadPhoto(
  userId: string,
  rideId: string,
  localUri: string,
): Promise<string> {
  const { ext, contentType } = contentTypeFor(localUri);
  const bytes = await new File(localUri).arrayBuffer();
  const path = `${userId}/${rideId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Drop a spot pin on the caller's own route (Point geometry built server-side). */
export async function addSpot(params: {
  routeId: string;
  lng: number;
  lat: number;
  photoUrl?: string | null;
  caption?: string | null;
  spotType?: SpotType;
  visitedAt?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("add_ride_spot", {
    p_route: params.routeId,
    p_lng: params.lng,
    p_lat: params.lat,
    p_photo_url: params.photoUrl ?? undefined,
    p_caption: params.caption ?? undefined,
    p_spot_type: params.spotType ?? undefined,
    p_visited_at: params.visitedAt
      ? new Date(params.visitedAt).toISOString()
      : undefined,
  });
  if (error) throw error;
  return (data as { id: string }).id;
}

export interface PhotoSyncResult {
  uploaded: number;
  failed: number;
}

/**
 * Drain queued photos for a ride: upload each, drop a spot, mark synced.
 * Idempotent and resilient — one failure doesn't abort the batch; failures stay
 * queued for the next attempt (reconnect or finalize).
 */
export async function syncRidePhotos(
  rideId: string,
  routeId: string,
): Promise<PhotoSyncResult> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { uploaded: 0, failed: 0 };

  const queued = await outbox.getUnsyncedPhotos(rideId);
  let uploaded = 0;
  let failed = 0;

  for (const ph of queued) {
    try {
      const photoUrl = await uploadPhoto(userId, rideId, ph.localUri);
      if (ph.lng != null && ph.lat != null) {
        await addSpot({
          routeId,
          lng: ph.lng,
          lat: ph.lat,
          photoUrl,
          caption: ph.caption,
          spotType: (ph.spotType as SpotType) ?? "GENERAL",
          visitedAt: ph.t,
        });
      }
      await outbox.markPhotoSynced(ph.id, photoUrl);
      uploaded++;
    } catch {
      failed++;
    }
  }
  return { uploaded, failed };
}
