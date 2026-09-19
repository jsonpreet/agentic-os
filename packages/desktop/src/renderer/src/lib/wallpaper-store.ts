const DB_NAME = 'agentic-wallpapers';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

interface StoredWallpaper {
  id: string;
  blob: Blob;
  mediaType: 'image' | 'video';
  name: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveCustomWallpaper(
  file: File
): Promise<{ storeId: string; mediaType: 'image' | 'video'; name: string }> {
  const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
  const storeId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredWallpaper = {
      id: storeId,
      blob: file,
      mediaType,
      name: file.name,
      createdAt: Date.now()
    };
    store.put(record);
    tx.oncomplete = () => resolve({ storeId, mediaType, name: file.name });
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCustomWallpaperUrl(storeId: string): Promise<string | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(storeId);
    request.onsuccess = () => {
      const record = request.result as StoredWallpaper | undefined;
      if (!record) {
        resolve(null);
        return;
      }
      resolve(URL.createObjectURL(record.blob));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCustomWallpaper(storeId: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(storeId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
