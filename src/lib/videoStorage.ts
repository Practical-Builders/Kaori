/**
 * IndexedDB helpers for storing session video files and pose frame data.
 * localStorage can't hold large binaries; IndexedDB handles files of any size.
 */

const DB_NAME    = "kickiq_videos";
const DB_VERSION = 2;
const VIDEO_STORE = "videos";
const POSE_STORE  = "pose_frames";

export interface PoseData {
  frames:   any[];
  metadata: { width: number; height: number };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(VIDEO_STORE))
        db.createObjectStore(VIDEO_STORE);
      if (!db.objectStoreNames.contains(POSE_STORE))
        db.createObjectStore(POSE_STORE);
    };
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Video ─────────────────────────────────────────────────────────────────────

export async function saveVideo(sessionId: string, file: File): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, "readwrite");
    tx.objectStore(VIDEO_STORE).put(file, sessionId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function getVideo(sessionId: string): Promise<File | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(VIDEO_STORE, "readonly").objectStore(VIDEO_STORE).get(sessionId);
    req.onsuccess = () => { db.close(); resolve((req.result as File) ?? null); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

export async function deleteVideo(sessionId: string): Promise<void> {
  const db = await openDb();
  return new Promise(resolve => {
    const tx = db.transaction(VIDEO_STORE, "readwrite");
    tx.objectStore(VIDEO_STORE).delete(sessionId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); resolve(); };
  });
}

// ── Pose frames ───────────────────────────────────────────────────────────────

export async function savePoseFrames(sessionId: string, data: PoseData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(POSE_STORE, "readwrite");
    tx.objectStore(POSE_STORE).put(data, sessionId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function getPoseFrames(sessionId: string): Promise<PoseData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(POSE_STORE, "readonly").objectStore(POSE_STORE).get(sessionId);
    req.onsuccess = () => { db.close(); resolve((req.result as PoseData) ?? null); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}
