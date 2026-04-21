import { openDB, type IDBPDatabase } from "idb";

import type { CamelotKey } from "./camelot";

export interface TrackRecord {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number | null;
  key: CamelotKey | null;
  color: string;
  addedAt: number;
  lastPlayed: number | null;
  blob: Blob;
  peaks?: number[];
  bands?: { lo: number[]; mid: number[]; hi: number[] };
  hotCues?: { id: number; pos: number; color: string; label?: string }[];
  folderId?: string | null;
  kind?: "audio" | "video";
  mime?: string;
  /** Free-form tags: genre, mood, energy. */
  tags?: string[];
  /** Auto-gain offset in dB to normalize loudness on import. */
  gainOffsetDb?: number;
  /** Times this track has been loaded onto a deck. */
  playCount?: number;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface FolderRecord {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  color?: string;
}

export interface RecordingRecord {
  id: string;
  name: string;
  createdAt: number;
  duration: number;
  blob: Blob;
  mime: string;
}

export interface SampleRecord {
  id: string;
  name: string;
  blob: Blob;
}

let _db: IDBPDatabase | null = null;
let _opening: Promise<IDBPDatabase> | null = null;

export async function getDB() {
  if (_db) return _db;
  if (_opening) return _opening;
  _opening = openDB("vdj-pro", 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("tracks")) db.createObjectStore("tracks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("playlists")) db.createObjectStore("playlists", { keyPath: "id" });
      if (!db.objectStoreNames.contains("recordings")) db.createObjectStore("recordings", { keyPath: "id" });
      if (!db.objectStoreNames.contains("samples")) db.createObjectStore("samples", { keyPath: "id" });
      if (!db.objectStoreNames.contains("folders")) db.createObjectStore("folders", { keyPath: "id" });
    },
    blocked() {
      // another tab is holding the old version open
      console.warn("[db] open blocked by another connection");
    },
    blocking() {
      // another tab requested a newer version — close so it can upgrade
      try { _db?.close(); } catch { /* noop */ }
      _db = null;
    },
    terminated() {
      _db = null;
    },
  }).then((db) => {
    _db = db;
    // If the browser closes the connection unexpectedly, drop the cache
    // so the next call reopens it instead of throwing
    // "The database connection is closing".
    db.addEventListener("close", () => { _db = null; });
    db.addEventListener("versionchange", () => {
      try { db.close(); } catch { /* noop */ }
      _db = null;
    });
    _opening = null;
    return db;
  }).catch((err) => {
    _opening = null;
    throw err;
  });
  return _opening;
}

/**
 * Wrap an IDB operation so that a transient "connection is closing"
 * (or InvalidStateError) reopens the DB and retries once.
 */
async function withDb<T>(op: (db: IDBPDatabase) => Promise<T>): Promise<T> {
  let db = await getDB();
  try {
    return await op(db);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    const name = (e as Error)?.name;
    const isClosing =
      name === "InvalidStateError" ||
      msg.includes("connection is closing") ||
      msg.includes("database connection is closing");
    if (!isClosing) throw e;
    _db = null;
    db = await getDB();
    return op(db);
  }
}

export async function listTracks(): Promise<TrackRecord[]> {
  const db = await getDB();
  return db.getAll("tracks");
}
export async function putTrack(t: TrackRecord) {
  const db = await getDB();
  await db.put("tracks", t);
}
export async function getTrack(id: string): Promise<TrackRecord | undefined> {
  const db = await getDB();
  return db.get("tracks", id);
}
export async function deleteTrack(id: string) {
  const db = await getDB();
  await db.delete("tracks", id);
}

export async function listPlaylists(): Promise<PlaylistRecord[]> {
  const db = await getDB();
  return db.getAll("playlists");
}
export async function putPlaylist(p: PlaylistRecord) {
  const db = await getDB();
  await db.put("playlists", p);
}
export async function deletePlaylist(id: string) {
  const db = await getDB();
  await db.delete("playlists", id);
}

export async function listRecordings(): Promise<RecordingRecord[]> {
  const db = await getDB();
  return db.getAll("recordings");
}
export async function putRecording(r: RecordingRecord) {
  const db = await getDB();
  await db.put("recordings", r);
}
export async function deleteRecording(id: string) {
  const db = await getDB();
  await db.delete("recordings", id);
}

export async function listSamples(): Promise<SampleRecord[]> {
  const db = await getDB();
  return db.getAll("samples");
}
export async function putSample(s: SampleRecord) {
  const db = await getDB();
  await db.put("samples", s);
}
export async function deleteSample(id: string) {
  const db = await getDB();
  await db.delete("samples", id);
}

export async function listFolders(): Promise<FolderRecord[]> {
  const db = await getDB();
  return db.getAll("folders");
}
export async function putFolder(f: FolderRecord) {
  const db = await getDB();
  await db.put("folders", f);
}
export async function deleteFolder(id: string) {
  const db = await getDB();
  await db.delete("folders", id);
}

export function uid() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}