/**
 * Provider-neutral routing types (A→B cycling directions).
 *
 * This is the missing "compute a route between two points" capability. Modeled
 * as a tiered contract (A안 RoutingOrchestrator): a stored official course wins,
 * else an OSM bike engine (GraphHopper), else a straight-line estimate. Nothing
 * here references a concrete engine — see ./RoutingProvider + ./orchestrator.
 *
 * Coordinates are [lng, lat] tuples throughout (matching our geometry modules).
 */
import type { LngLat } from "../ride/deviation";

export type { LngLat };

export type RouteProfile = "bike";

export type RouteSource = "stored" | "graphhopper" | "straight";

export interface RouteRequest {
  from: LngLat;
  to: LngLat;
  profile?: RouteProfile;
}

export interface RouteResult {
  /** The routed polyline as [lng, lat][]. */
  coordinates: LngLat[];
  /** Route distance in meters. */
  distanceM: number;
  /** Estimated duration in seconds, or null if unknown. */
  durationS: number | null;
  /** Which tier produced this result. */
  source: RouteSource;
  /** True when distance/duration are rough (no real routing engine used). */
  estimated: boolean;
}
