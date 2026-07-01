/**
 * GraphHopper provider — the OSM bike-routing tier (skeleton).
 *
 * The URL builder and response parser are PURE + unit-tested. The network call
 * is gated by `isConfigured`: with no self-hosted GraphHopper URL yet, route()
 * returns null so the orchestrator falls through to the straight-line estimate.
 * Wire a real host via EXPO_PUBLIC_GRAPHHOPPER_URL to activate this tier.
 *
 * Uses points_encoded=false so the API returns GeoJSON [lng,lat] coords directly
 * (no polyline decoding needed).
 */
import type { LngLat } from "../../ride/deviation";
import type { RoutingProvider } from "../RoutingProvider";
import type { RouteRequest, RouteResult } from "../types";

/** Build a GraphHopper GET URL. Pure/testable. */
export function buildGraphHopperUrl(base: string, req: RouteRequest, key?: string): string {
  const point = (c: LngLat) => `point=${c[1]},${c[0]}`; // GraphHopper wants lat,lng
  const params = [
    point(req.from),
    point(req.to),
    "profile=bike",
    "points_encoded=false",
    "locale=en",
  ];
  if (key) params.push(`key=${encodeURIComponent(key)}`);
  const root = base.replace(/\/+$/, "");
  return `${root}/route?${params.join("&")}`;
}

interface GHPath {
  distance?: number;
  time?: number;
  points?: { coordinates?: [number, number][] };
}

/** Parse a GraphHopper JSON response into a RouteResult, or null if unusable. Pure/testable. */
export function parseGraphHopperResponse(json: unknown): RouteResult | null {
  const paths = (json as { paths?: GHPath[] })?.paths;
  const path = Array.isArray(paths) ? paths[0] : undefined;
  const coords = path?.points?.coordinates;
  if (!path || !Array.isArray(coords) || coords.length < 2) return null;
  return {
    coordinates: coords as LngLat[],
    distanceM: typeof path.distance === "number" ? path.distance : 0,
    durationS: typeof path.time === "number" ? Math.round(path.time / 1000) : null,
    source: "graphhopper",
    estimated: false,
  };
}

export class GraphHopperProvider implements RoutingProvider {
  readonly id = "graphhopper" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly key?: string,
  ) {}

  get isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async route(req: RouteRequest): Promise<RouteResult | null> {
    if (!this.isConfigured) return null; // not hosted yet → fall through
    try {
      const res = await fetch(buildGraphHopperUrl(this.baseUrl, req, this.key));
      if (!res.ok) return null;
      return parseGraphHopperResponse(await res.json());
    } catch {
      return null; // network / parse failure → fall through
    }
  }
}
