/**
 * Stored-course provider — the top tier (skeleton via dependency injection).
 *
 * A안's tier 1: if a pre-stored official course matches the request, use it as-is
 * (best quality, curated). The actual lookup queries Supabase for an OFFICIAL
 * route whose endpoints are near from/to — that's async + DB-bound, so it is
 * INJECTED here, keeping the orchestrator pure/testable. Passing no lookup makes
 * this tier inert (returns null → fall through), which is the current default
 * until the DB-backed lookup is wired.
 */
import type { RoutingProvider } from "../RoutingProvider";
import type { RouteRequest, RouteResult } from "../types";

export type StoredCourseLookup = (req: RouteRequest) => Promise<RouteResult | null>;

export class StoredCourseProvider implements RoutingProvider {
  readonly id = "stored" as const;

  constructor(private readonly lookup?: StoredCourseLookup) {}

  get isConfigured(): boolean {
    return !!this.lookup;
  }

  async route(req: RouteRequest): Promise<RouteResult | null> {
    if (!this.lookup) return null;
    return this.lookup(req);
  }
}
