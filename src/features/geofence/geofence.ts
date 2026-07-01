/**
 * Client-side geofencing (pure geometry, no React Native / expo imports).
 *
 * Caches region polygons and, as GPS fixes stream in, detects when the rider
 * ENTERs or EXITs a region. ENTER is the trigger for the voucher-claim prompt;
 * the server (claim_voucher RPC) re-verifies the location with PostGIS, so the
 * client check is a cheap, offline-capable gate rather than the source of truth.
 *
 * Geometry is GeoJSON-shaped:
 *   Polygon      coordinates: ring[]            (ring[0]=exterior, rest=holes)
 *   MultiPolygon coordinates: polygon[]         (each polygon = ring[])
 *   ring = [lng, lat][] ; first/last point may or may not be equal.
 *
 * Import-free of expo/react-native so it is unit-testable in Node and reusable
 * on web. Mirrors the deviation engine's shape.
 */

export type LngLat = [number, number];

export interface GeofenceRegion {
  id: string;
  name?: string | null;
  type: "Polygon" | "MultiPolygon";
  /** Polygon: number[][][] ; MultiPolygon: number[][][][] (GeoJSON order). */
  coordinates: number[][][] | number[][][][];
}

/** Ray-casting point-in-ring test. Ring is a closed/open list of [lng,lat]. */
function pointInRing(p: LngLat, ring: number[][]): boolean {
  const x = p[0];
  const y = p[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Inside exterior ring AND outside every hole. */
function pointInPolygon(p: LngLat, polygon: number[][][]): boolean {
  if (polygon.length === 0) return false;
  if (!pointInRing(p, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(p, polygon[i])) return false; // in a hole
  }
  return true;
}

export function pointInRegion(p: LngLat, region: GeofenceRegion): boolean {
  if (region.type === "Polygon") {
    return pointInPolygon(p, region.coordinates as number[][][]);
  }
  const multi = region.coordinates as number[][][][];
  for (let i = 0; i < multi.length; i++) {
    if (pointInPolygon(p, multi[i])) return true;
  }
  return false;
}

export interface GeofenceUpdate {
  /** Region the rider is currently inside (first match), or null. */
  inside: string | null;
  /** Region id newly entered on this fix (transition only), else null. */
  entered: string | null;
  /** Region id just left on this fix (transition only), else null. */
  exited: string | null;
}

export interface GeofenceDetector {
  readonly current: string | null;
  update(p: LngLat): GeofenceUpdate;
  reset(): void;
}

/**
 * Stateful region detector. Emits `entered`/`exited` only on transitions, so a
 * rider lingering inside a region won't re-trigger claims. Regions are assumed
 * non-overlapping (first containing region wins).
 *
 * `confirmFixes` debounces boundary jitter: ENTER for a region only fires after
 * the point has resolved to that region for N consecutive fixes (default 1 =
 * immediate). EXIT (to outside or another region) is immediate.
 */
export function createGeofenceDetector(
  regions: GeofenceRegion[],
  opts: { initial?: string | null; confirmFixes?: number } = {},
): GeofenceDetector {
  const confirmFixes = Math.max(1, opts.confirmFixes ?? 1);
  let current: string | null = opts.initial ?? null;
  let pending: string | null = null;
  let pendingCount = 0;

  const locate = (p: LngLat): string | null => {
    for (let i = 0; i < regions.length; i++) {
      if (pointInRegion(p, regions[i])) return regions[i].id;
    }
    return null;
  };

  return {
    get current() {
      return current;
    },
    update(p: LngLat): GeofenceUpdate {
      const raw = locate(p);
      const prev = current;

      // Leaving the current region (to outside or elsewhere) is immediate.
      if (raw !== current) {
        // Debounce the *entry* into a new region.
        if (raw === null) {
          current = null;
          pending = null;
          pendingCount = 0;
        } else {
          if (raw === pending) pendingCount++;
          else {
            pending = raw;
            pendingCount = 1;
          }
          if (pendingCount >= confirmFixes) {
            current = raw;
            pending = null;
            pendingCount = 0;
          }
        }
      } else {
        pending = null;
        pendingCount = 0;
      }

      return {
        inside: current,
        entered: current && current !== prev ? current : null,
        exited: prev && prev !== current ? prev : null,
      };
    },
    reset() {
      current = opts.initial ?? null;
      pending = null;
      pendingCount = 0;
    },
  };
}
