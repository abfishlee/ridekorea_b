/**
 * Offline-first ride outbox backed by expo-sqlite.
 *
 * Every accepted GPS fix is persisted locally BEFORE anything else, so a ride
 * survives connectivity loss or an app crash mid-route. On relaunch, an
 * unfinished ride can be recovered (see store `recover()`), and at finalize the
 * track is rebuilt from these rows and sent up via the `finalize_ride` RPC.
 *
 * Photos are queued here too (4.4) and uploaded to Storage when online.
 *
 * This module touches the native SQLite layer, so it is not unit-tested in Node;
 * the pure ride logic lives in ./track and ./deviation (which are tested).
 */

import * as SQLite from "expo-sqlite";
import type { TrackPoint } from "./track";

const DB_NAME = "ridekorea.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS ride_meta (
          ride_id          TEXT PRIMARY KEY,
          route_id         TEXT NOT NULL,
          started_at       INTEGER NOT NULL,
          status           TEXT NOT NULL DEFAULT 'active',
          planned_geojson  TEXT
        );

        CREATE TABLE IF NOT EXISTS ride_point (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          ride_id   TEXT NOT NULL,
          lng       REAL NOT NULL,
          lat       REAL NOT NULL,
          t         INTEGER NOT NULL,
          accuracy  REAL,
          speed     REAL,
          deviated  INTEGER NOT NULL DEFAULT 0,
          synced    INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_ride_point_ride ON ride_point(ride_id, t);

        CREATE TABLE IF NOT EXISTS ride_photo (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          ride_id     TEXT NOT NULL,
          local_uri   TEXT NOT NULL,
          lng         REAL,
          lat         REAL,
          caption     TEXT,
          spot_type   TEXT,
          t           INTEGER NOT NULL,
          remote_url  TEXT,
          synced      INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_ride_photo_ride ON ride_photo(ride_id, t);
      `);
      return db;
    });
  }
  return dbPromise;
}

/** Ensure the schema exists (safe to call repeatedly). */
export async function initOutbox(): Promise<void> {
  await getDb();
}

export interface RideRecord {
  rideId: string;
  routeId: string;
  startedAt: number;
  plannedGeoJSON: string | null;
}

export async function startRideRecord(rec: RideRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO ride_meta (ride_id, route_id, started_at, status, planned_geojson)
     VALUES (?, ?, ?, 'active', ?)`,
    [rec.rideId, rec.routeId, rec.startedAt, rec.plannedGeoJSON],
  );
}

export async function enqueuePoint(rideId: string, p: TrackPoint): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ride_point (ride_id, lng, lat, t, accuracy, speed, deviated, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [rideId, p.lng, p.lat, p.t, p.accuracy, p.speed, p.deviated ? 1 : 0],
  );
}

interface PointRow {
  lng: number;
  lat: number;
  t: number;
  accuracy: number | null;
  speed: number | null;
  deviated: number;
}

export async function getRidePoints(rideId: string): Promise<TrackPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PointRow>(
    `SELECT lng, lat, t, accuracy, speed, deviated
     FROM ride_point WHERE ride_id = ? ORDER BY t ASC, id ASC`,
    [rideId],
  );
  return rows.map((r) => ({
    lng: r.lng,
    lat: r.lat,
    t: r.t,
    accuracy: r.accuracy,
    speed: r.speed,
    deviated: r.deviated === 1,
  }));
}

/** The most recent still-active ride, if any (for crash/offline recovery). */
export async function getActiveRide(): Promise<RideRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    ride_id: string;
    route_id: string;
    started_at: number;
    planned_geojson: string | null;
  }>(
    `SELECT ride_id, route_id, started_at, planned_geojson
     FROM ride_meta WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`,
  );
  if (!row) return null;
  return {
    rideId: row.ride_id,
    routeId: row.route_id,
    startedAt: row.started_at,
    plannedGeoJSON: row.planned_geojson,
  };
}

export async function finishRideRecord(rideId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE ride_meta SET status = 'finished' WHERE ride_id = ?`, [
    rideId,
  ]);
}

/** Remove a ride's local rows entirely (after a confirmed finalize sync). */
export async function clearRide(rideId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ride_point WHERE ride_id = ?`, [rideId]);
  await db.runAsync(`DELETE FROM ride_photo WHERE ride_id = ?`, [rideId]);
  await db.runAsync(`DELETE FROM ride_meta WHERE ride_id = ?`, [rideId]);
}

export async function pointCount(rideId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ride_point WHERE ride_id = ?`,
    [rideId],
  );
  return row?.n ?? 0;
}

/* ----------------------------- photo queue (4.4) ----------------------------- */

export interface QueuedPhoto {
  rideId: string;
  localUri: string;
  lng: number | null;
  lat: number | null;
  caption: string | null;
  spotType: string | null;
  t: number;
}

export async function enqueuePhoto(photo: QueuedPhoto): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ride_photo (ride_id, local_uri, lng, lat, caption, spot_type, t, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      photo.rideId,
      photo.localUri,
      photo.lng,
      photo.lat,
      photo.caption,
      photo.spotType,
      photo.t,
    ],
  );
}

export interface PhotoRow extends QueuedPhoto {
  id: number;
  remoteUrl: string | null;
}

export async function getUnsyncedPhotos(rideId: string): Promise<PhotoRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    ride_id: string;
    local_uri: string;
    lng: number | null;
    lat: number | null;
    caption: string | null;
    spot_type: string | null;
    t: number;
    remote_url: string | null;
  }>(
    `SELECT id, ride_id, local_uri, lng, lat, caption, spot_type, t, remote_url
     FROM ride_photo WHERE ride_id = ? AND synced = 0 ORDER BY t ASC`,
    [rideId],
  );
  return rows.map((r) => ({
    id: r.id,
    rideId: r.ride_id,
    localUri: r.local_uri,
    lng: r.lng,
    lat: r.lat,
    caption: r.caption,
    spotType: r.spot_type,
    t: r.t,
    remoteUrl: r.remote_url,
  }));
}

export async function markPhotoSynced(id: number, remoteUrl: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE ride_photo SET synced = 1, remote_url = ? WHERE id = ?`,
    [remoteUrl, id],
  );
}
