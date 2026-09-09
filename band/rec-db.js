// リハ録音の保存先:音声Blobは localStorage に入らないので IndexedDB を使う。

const DB_NAME = "setlism-rec";
const DB_VER = 1;
const STORE = "recordings";

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

// rec: {id, name, songId|null, date(ms), mime, sec, blob}
export function addRecording(rec) {
  return tx("readwrite", (s) => s.put(rec));
}

export function deleteRecording(id) {
  return tx("readwrite", (s) => s.delete(id));
}

export function updateRecording(id, patch) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, "readwrite");
        const s = t.objectStore(STORE);
        const get = s.get(id);
        get.onsuccess = () => {
          const rec = get.result;
          if (rec) s.put(Object.assign(rec, patch));
        };
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      })
  );
}

export async function listRecordings() {
  const all = (await tx("readonly", (s) => s.getAll())) || [];
  return all.sort((a, b) => b.date - a.date);
}

export async function storageEstimate() {
  try {
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage: usage || 0, quota: quota || 0 };
    }
  } catch { /* 対応外は無視 */ }
  return null;
}
