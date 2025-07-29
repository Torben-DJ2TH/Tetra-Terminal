export let db = null;

export function initDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tetraLogs', 3);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('commands')) {
        db.createObjectStore('commands', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('sds')) {
        db.createObjectStore('sds', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('gps')) {
        db.createObjectStore('gps', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('web_status')) {
        db.createObjectStore('web_status', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('web_qrv')) {
        db.createObjectStore('web_qrv', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('web_logs')) {
        db.createObjectStore('web_logs', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => { db = request.result; resolve(); };
    request.onerror = () => reject(request.error);
  });
}

function getStore(name) {
  const tx = db.transaction(name, 'readwrite');
  return tx.objectStore(name);
}

export function logCommand(command) {
  if (!db) return;
  getStore('commands').add({ timestamp: new Date().toISOString(), command });
  notifyChange();
}

export function logSds(data) {
  if (!db) return;
  getStore('sds').add({ timestamp: new Date().toISOString(), ...data });
  notifyChange();
}

export function logGps(data) {
  if (!db) return;
  getStore('gps').add({ timestamp: new Date().toISOString(), ...data });
  notifyChange();
}

export function saveContacts(list) {
  if (!db || !Array.isArray(list)) return;
  const store = getStore('contacts');
  list.forEach(c => store.add({ ...c }));
  notifyChange();
}

export function saveStatus(list) {
  if (!db || !Array.isArray(list)) return;
  const store = getStore('web_status');
  store.clear();
  list.forEach(e => store.add({ ...e }));
  notifyChange();
}

export function saveQrvUsers(list) {
  if (!db || !Array.isArray(list)) return;
  const store = getStore('web_qrv');
  store.clear();
  list.forEach(e => store.add({ ...e }));
  notifyChange();
}

export function saveWebLogs(list) {
  if (!db || !Array.isArray(list)) return;
  const store = getStore('web_logs');
  store.clear();
  list.forEach(e => store.add({ ...e }));
  notifyChange();
}

export async function clearDb() {
  if (!db) return;
  await Promise.all([
    getStore('commands').clear(),
    getStore('sds').clear(),
    getStore('gps').clear(),
    getStore('contacts').clear(),
    getStore('web_status').clear(),
    getStore('web_qrv').clear(),
    getStore('web_logs').clear()
  ]);
  notifyChange();
}

export function deleteEntry(store, id) {
  if (!db) return;
  const s = getStore(store);
  s.delete(id);
  notifyChange();
}

export function clearStore(store) {
  if (!db) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = getStore(store);
    const req = s.clear();
    req.onsuccess = () => {
      notifyChange();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getStoreEntries(store) {
  if (!db) return [];
  return getAllFromStore(store);
}

function notifyChange() {
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('dbChange'));
  }
}

function getAllFromStore(name) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readonly');
    const store = tx.objectStore(name);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLogs() {
  if (!db) return [];
  const [cmds, sds, gps] = await Promise.all([
    getAllFromStore('commands'),
    getAllFromStore('sds'),
    getAllFromStore('gps')
  ]);
  const all = [
    ...cmds.map(e => ({ type: 'command', store: 'commands', ...e })),
    ...sds.map(e => ({ type: 'sds', store: 'sds', ...e })),
    ...gps.map(e => ({ type: 'gps', store: 'gps', ...e }))
  ];
  return all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export async function getContacts() {
  if (!db) return [];
  return getAllFromStore('contacts');
}

export async function getStatusEntries() {
  if (!db) return [];
  return getAllFromStore('web_status');
}

export async function getQrvUsers() {
  if (!db) return [];
  return getAllFromStore('web_qrv');
}

export async function getWebLogs() {
  if (!db) return [];
  return getAllFromStore('web_logs');
}

export async function exportDbJson() {
  const [cmds, sds, gps, contacts, status, qrv, logs] = await Promise.all([
    getAllFromStore('commands'),
    getAllFromStore('sds'),
    getAllFromStore('gps'),
    getAllFromStore('contacts'),
    getAllFromStore('web_status'),
    getAllFromStore('web_qrv'),
    getAllFromStore('web_logs')
  ]);
  return JSON.stringify({ commands: cmds, sds, gps, contacts, status, qrv, logs }, null, 2);
}

export async function importDbJson(json) {
  if (!db) return;
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    console.error(e);
    return;
  }
  await clearDb();
  const cmds = data.commands || [];
  const sds = data.sds || [];
  const gps = data.gps || [];
  const contacts = data.contacts || [];
  const status = data.status || [];
  const qrv = data.qrv || [];
  const logs = data.logs || [];
  const storeCmd = getStore('commands');
  cmds.forEach(c => storeCmd.add(c));
  const storeSds = getStore('sds');
  sds.forEach(s => storeSds.add(s));
  const storeGps = getStore('gps');
  gps.forEach(g => storeGps.add(g));
  const storeContacts = getStore('contacts');
  contacts.forEach(c => storeContacts.add(c));
  const storeStatus = getStore('web_status');
  status.forEach(s => storeStatus.add(s));
  const storeQrv = getStore('web_qrv');
  qrv.forEach(q => storeQrv.add(q));
  const storeLogs = getStore('web_logs');
  logs.forEach(l => storeLogs.add(l));
  notifyChange();
}
