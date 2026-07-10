// Offline upload queue — IndexedDB-backed so files a guest picked on dead
// venue Wi-Fi survive tab closes and auto-upload when the network returns.
//
// Deliberately NOT built on the Background Sync API: it has zero iOS/Safari
// support (and no sign of arriving). The workable cross-platform pattern is
// foreground persistence: store the File blobs in IndexedDB, retry while
// the tab is open (online event) and resume on the next visit.
//
// Everything here is best-effort: if IndexedDB is unavailable (private
// browsing on some engines, storage pressure), every call resolves to a
// no-op and the app behaves exactly as before the queue existed.

export interface QueuedUpload {
  /** UploadItem id — reused so a drained item maps back cleanly. */
  id: string;
  eventSlug: string;
  /** The actual file payload. Files are structured-cloneable into IDB. */
  blob: Blob;
  name: string;
  type: string;
  tableLabel: string | null;
  challengeId: string | null;
  addedAt: number;
}

const DB_NAME = "wgp-offline-queue";
const STORE = "uploads";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function txDone(tx: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function queueAdd(items: QueuedUpload[]): Promise<boolean> {
  if (items.length === 0) return true;
  const db = await openDb();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const item of items) store.put(item);
    const ok = await txDone(tx);
    db.close();
    return ok;
  } catch {
    db.close();
    return false;
  }
}

export async function queueList(eventSlug: string): Promise<QueuedUpload[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const all = await new Promise<QueuedUpload[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as QueuedUpload[]) ?? []);
      req.onerror = () => resolve([]);
    });
    db.close();
    return all.filter((i) => i.eventSlug === eventSlug);
  } catch {
    db.close();
    return [];
  }
}

export async function queueRemove(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  } catch {
    // best-effort
  }
  db.close();
}

export async function queueCount(eventSlug: string): Promise<number> {
  return (await queueList(eventSlug)).length;
}
