export let tracksDb = null;

export function initTracksDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tetraTracks', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { tracksDb = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

function getStore() {
  const tx = tracksDb.transaction('tracks', 'readwrite');
  return tx.objectStore('tracks');
}

export function saveTrack(id, points) {
  return new Promise(resolve => {
    if (!tracksDb) return resolve();
    const req = getStore().put({ id, points });
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
}

export function deleteTrackDb(id) {
  if (!tracksDb) return;
  getStore().delete(id);
}

export function clearTracks() {
  if (!tracksDb) return;
  getStore().clear();
}

export function getTracks() {
  if (!tracksDb) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const req = tracksDb.transaction('tracks', 'readonly').objectStore('tracks').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
