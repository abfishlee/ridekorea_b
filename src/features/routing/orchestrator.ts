/**
 * Routing orchestrator — the 3-tier fallback (pure).
 *
 * Tries providers in order and returns the first non-null result. This is the
 * heart of A안's RoutingOrchestrator, kept pure/import-light so it is unit-tested
 * in plain Node with fake providers.
 */
import type { RoutingProvider } from "./RoutingProvider";
import type { RouteRequest, RouteResult } from "./types";

export interface Router {
  route(req: RouteRequest): Promise<RouteResult | null>;
}

export function createRoutingOrchestrator(providers: RoutingProvider[]): Router {
  return {
    async route(req: RouteRequest): Promise<RouteResult | null> {
      for (const provider of providers) {
        const result = await provider.route(req);
        if (result) return result;
      }
      return null;
    },
  };
}
