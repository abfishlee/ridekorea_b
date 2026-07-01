/**
 * MapProvider — the renderer contract the app depends on.
 *
 * Our maps are cost-minimized WebView pages (Naver Web Dynamic Map, free tier):
 * a page is built once and updated incrementally via injected JS — so the
 * contract is "build HTML" + "make an update script", not an imperative live-map
 * API. This keeps a long ride to a single map load (no per-fix billing) while
 * still hiding the concrete vendor behind an interface.
 *
 * Capability flags (`supportsOffline`, `hasKoreanRoadDetail`) let callers pick a
 * secondary provider later (e.g. Mapbox for offline) without branching on vendor.
 */
import type {
  LngLat,
  MapProviderId,
  RideUpdate,
  StaticRouteOptions,
} from "./types";

export interface MapProvider {
  readonly id: MapProviderId;

  /** Can render fully offline (Mapbox: yes; Naver: no). */
  readonly supportsOffline: boolean;
  /** Base map shows usable Korean road detail (Naver/Google: yes). */
  readonly hasKoreanRoadDetail: boolean;
  /** A usable credential/key is configured for this provider. */
  readonly isConfigured: boolean;

  /** HTML for a static route map (polyline + spot markers), rendered once. */
  buildStaticRouteHtml(coords: LngLat[], opts?: StaticRouteOptions): string;

  /** HTML for a live ride map that accepts incremental updates (loaded once). */
  buildLiveRideHtml(planned: LngLat[]): string;

  /** JS to inject for a single incremental ride update — no page reload. */
  liveRideUpdateScript(update: RideUpdate): string;
}
