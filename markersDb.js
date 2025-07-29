export let markersDb = null;

export function initMarkersDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tetraMarkers', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('markers')) {
        db.createObjectStore('markers', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => { markersDb = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

function getStore() {
  const tx = markersDb.transaction('markers', 'readwrite');
  return tx.objectStore('markers');
}

export function addMarker({ lat, lon, description }) {
  return new Promise(resolve => {
    if (!markersDb) return resolve(null);
    const req = getStore().add({ lat, lon, description: description || '', timestamp: new Date().toISOString() });
    req.onsuccess = () => { notifyChange(); resolve(req.result); };
    req.onerror = () => resolve(null);
  });
}

export function updateMarker(id, data) {
  if (!markersDb) return;
  const store = getStore();
  const req = store.get(id);
  req.onsuccess = () => {
    const entry = req.result;
    if (!entry) return;
    Object.assign(entry, data);
    store.put(entry);
    notifyChange();
  };
}

export function deleteMarker(id) {
  if (!markersDb) return;
  getStore().delete(id);
  notifyChange();
}

export function getMarkers() {
  if (!markersDb) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const req = markersDb.transaction('markers', 'readonly').objectStore('markers').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notifyChange() {
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('markersChange'));
  }
}
