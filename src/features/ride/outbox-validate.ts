/**
 * Defensive validation for recovered ride data (pure, no expo/RN imports).
 *
 * Persisted rows (planned route GeoJSON in ride_meta, track points in ride_point)
 * are re-read on crash/offline recovery. A corrupt or truncated value must never
 * crash the ride or feed NaN coordinates into the deviation math, so these
 * helpers sanitize untrusted input into clean shapes (or empty), never throwing.
 *
 * Unit-testable in plain Node (see outbox-validate.test.ts).
 */

import type { LngLat } from "./deviation";
import type { TrackPoint } from "./track";

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** A well-formed [lng, lat] pair within valid geographic bounds. */
export function isValidLngLat(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    isFiniteNumber(v[0]) &&
    isFiniteNumber(v[1]) &&
    v[0] >= -180 &&
    v[0] <= 180 &&
    v[1] >= -90 &&
    v[1] <= 90
  );
}

/**
 * Turn persisted planned-route data into a clean `LngLat[]`. Accepts a GeoJSON
 * string, a parsed object with `.coordinates`, or a bare array; filters out any
 * malformed pairs. Anything unusable → `[]`. Never throws.
 */
export function sanitizePlannedLine(raw: unknown): LngLat[] {
  let value: unknown = raw;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  let coords: unknown = value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    coords = (value as { coordinates?: unknown }).coordinates;
  }

  if (!Array.isArray(coords)) return [];
  return coords.filter(isValidLngLat);
}

/**
 * Filter recovered track rows to those with usable coordinates + timestamp.
 * Drops any row with non-finite / out-of-range lng/lat/t. Never throws.
 */
export function sanitizeTrackPoints(
  raw: readonly unknown[] | null | undefined,
): TrackPoint[] {
  if (!Array.isArray(raw)) return [];

  const out: TrackPoint[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const p = r as Record<string, unknown>;
    if (!isFiniteNumber(p.lng) || !isFiniteNumber(p.lat) || !isFiniteNumber(p.t)) continue;
    if (p.lng < -180 || p.lng > 180 || p.lat < -90 || p.lat > 90) continue;
    out.push({
      lng: p.lng,
      lat: p.lat,
      t: p.t,
      accuracy: isFiniteNumber(p.accuracy) ? p.accuracy : null,
      speed: isFiniteNumber(p.speed) ? p.speed : null,
      deviated: p.deviated === true,
    });
  }
  return out;
}
