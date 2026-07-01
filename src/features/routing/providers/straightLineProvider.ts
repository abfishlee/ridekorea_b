/**
 * Straight-line provider — the last-resort tier (always available).
 *
 * Returns a 2-point line with the great-circle distance and a rough duration at
 * a nominal cycling speed. Clearly marked `estimated: true` — this is a stopgap
 * until a real bike-routing engine (GraphHopper) is hosted, NOT a real route.
 */
import { haversine, type LngLat } from "../../ride/deviation";
import type { RoutingProvider } from "../RoutingProvider";
import type { RouteRequest, RouteResult } from "../types";

/** Nominal cycling speed used only for the straight-line duration estimate. */
export const ESTIMATE_SPEED_KMH = 16;

export class StraightLineProvider implements RoutingProvider {
  readonly id = "straight" as const;
  readonly isConfigured = true; // always available

  async route(req: RouteRequest): Promise<RouteResult> {
    const coordinates: LngLat[] = [req.from, req.to];
    const distanceM = haversine(req.from, req.to);
    const durationS = Math.round((distanceM / 1000 / ESTIMATE_SPEED_KMH) * 3600);
    return { coordinates, distanceM, durationS, source: "straight", estimated: true };
  }
}
