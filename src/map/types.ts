/**
 * Provider-neutral map types.
 *
 * Nothing here references Naver/Mapbox/Google. Screens and features depend on
 * these shapes + the MapProvider interface, never on a concrete renderer, so we
 * can swap the primary map (or add an offline one) by writing one provider — no
 * feature-code changes. See ./MapProvider and ./index.
 *
 * Coordinates are [lng, lat] tuples throughout, matching our GeoJSON adapters
 * and the ride/deviation modules (NOT {lat,lng}).
 */

export type LngLat = [number, number];

export type MapProviderId = "naver" | "mapbox" | "google";

/** Map UI language. Naver supports ko/en/zh/ja; others fall back to en. */
export type MapLanguage = "ko" | "en" | "zh" | "ja";

/** A spot marker drawn on a static route map. */
export interface SpotMarker {
  lng: number;
  lat: number;
  /** Spot type key (drives the emoji/icon), e.g. "FOOD" | "REPAIR" | ... */
  type: string;
  title?: string | null;
}

/** Options for a static route map (polyline + markers). */
export interface StaticRouteOptions {
  /** Polyline stroke color. Defaults to the provider's on-route color. */
  strokeColor?: string;
  spots?: SpotMarker[];
}

/** One incremental update pushed into a live ride map (no page reload). */
export interface RideUpdate {
  /** On-route (blue) track so far. */
  track: LngLat[];
  /** Deviated (pink) segments. */
  deviated: LngLat[][];
  /** Current position dot, or null. */
  pos: LngLat | null;
}
