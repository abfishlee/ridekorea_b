/**
 * Stamp passport view-model (pure — no I/O, unit-testable in Node).
 *
 * Joins the full center list with the rider's earned stamps and computes
 * per-corridor completion (the 4대강 passport screen reads this directly).
 */

export interface CertificationCenter {
  id: string;
  name: string;
  name_en: string | null;
  corridor: string | null;
  lng: number;
  lat: number;
}

export interface StampRow {
  center_id: string;
  stamped_at: string;
}

export interface PassportEntry extends CertificationCenter {
  earned: boolean;
  stampedAt: string | null;
}

export interface CorridorProgress {
  corridor: string;
  earned: number;
  total: number;
}

export interface Passport {
  entries: PassportEntry[];
  byCorridor: CorridorProgress[];
  earnedTotal: number;
  total: number;
}

/** Join centers with earned stamps into a passport + per-corridor progress. */
export function buildPassport(
  centers: CertificationCenter[],
  stamps: StampRow[],
): Passport {
  const stampMap = new Map(stamps.map((s) => [s.center_id, s.stamped_at]));

  const entries: PassportEntry[] = centers.map((c) => ({
    ...c,
    earned: stampMap.has(c.id),
    stampedAt: stampMap.get(c.id) ?? null,
  }));

  const corridorMap = new Map<string, CorridorProgress>();
  for (const e of entries) {
    const key = e.corridor ?? "기타";
    const cur = corridorMap.get(key) ?? { corridor: key, earned: 0, total: 0 };
    cur.total += 1;
    if (e.earned) cur.earned += 1;
    corridorMap.set(key, cur);
  }

  return {
    entries,
    byCorridor: Array.from(corridorMap.values()),
    earnedTotal: entries.filter((e) => e.earned).length,
    total: entries.length,
  };
}
