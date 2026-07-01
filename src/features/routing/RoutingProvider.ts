/**
 * RoutingProvider — one tier of the routing fallback chain.
 *
 * `route()` returns a RouteResult, or null when this provider can't serve the
 * request (mirrors A안's tier returning None) so the orchestrator falls through
 * to the next tier. Providers must never throw for "can't serve" — return null.
 */
import type { RouteRequest, RouteResult, RouteSource } from "./types";

export interface RoutingProvider {
  readonly id: RouteSource;
  /** True when this provider has what it needs (key/host/lookup) to try. */
  readonly isConfigured: boolean;
  /** Resolve a route, or null to fall through to the next provider. */
  route(req: RouteRequest): Promise<RouteResult | null>;
}
