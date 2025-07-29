import { connectSerial, disconnectSerial, sendCommand, enableAllTnp1Profiles, enableTnp1Profile, defaultInitCommands } from './serial.js';
import { connectPeiSerial, disconnectPeiSerial, sendPeiCommand, runPeiInit } from './serialPei.js';
import { sendSds, requestGps, sendLipRequest, sendLongLipRequest, sendLrrpRequest, sendSdsRaw, setAckEnabled } from './sds.js';
import { generateButtons } from './commands.js';
import { map, initMap, setHouseLabel, setKeepMarkers, addRemoteMarkers, addStaticMarker, loadMarkers, setIssiIconType, setCurrentTrack, loadTrackLines, clearTrack, getTracksData } from "./map.js";
import { initMarkersDb, getMarkers, addMarker } from "./markersDb.js";
import { initTracksDb, getTracks as getSavedTracks, saveTrack, deleteTrackDb, clearTracks } from './tracksDb.js';
import { initDb, clearDb, getContacts, clearStore } from './db.js';
import { initRssiChart } from './rssiChart.js';
import { initContactsViewer } from './contactsViewer.js';
import { print } from './utils.js';
import { initTalkGroupDisplay } from './tgDisplay.js';
import { initWebParser } from './webParser.js';
import { initLogViewer } from './logViewer.js';
import { importHamnetMarkers } from './hamnetParser.js';
import { initDapnetMonitor } from './dapnetMonitor.js';

const intervalHandles = {};
const MARKER_TIMEOUT = 5000;
let currentMarkerType = 'man';
let currentTrackId = null;

async function fetchRemoteMarkers() {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket('wss://core01.tmo.services/ws.io');
      ws.onopen = () => ws.send(JSON.stringify({ page: 'map' }));
      ws.onmessage = evt => {
        try {
          const data = JSON.parse(evt.data);
          if (Array.isArray(data)) {
            ws.close();
            resolve(data);
          }
        } catch (e) {
          console.error('Error parsing WebSocket data', e);
        }
      };
      ws.onerror = err => {
        ws.close();
        reject(err);
      };
    } catch (e) {
      reject(e);
    }
  });
}

function renderIntervalList() {
  const container = document.getElementById('intervalList');
  if (!container) return;
  container.innerHTML = '';
  Object.keys(intervalHandles).forEach(issi => {
    const item = document.createElement('div');
    item.className = 'interval-item';
    const span = document.createElement('span');
    span.textContent = issi;
    const btn = document.createElement('button');
    btn.textContent = 'X';
    btn.onclick = () => removeInterval(issi);
    item.appendChild(span);
    item.appendChild(btn);
    container.appendChild(item);
  });
}

function startInterval() {
  const issi = document.getElementById('gpsIssi').value.trim();
  if (!issi) return print('⚠️ ISSI fehlt');
  if (intervalHandles[issi]) return print(`⚠️ ISSI ${issi} bereits im Intervall`);
  setIssiIconType(issi, currentMarkerType);
  const secs = parseInt(document.getElementById('intervalSeconds').value, 10) || 30;
  sendSdsRaw(0, issi);
  intervalHandles[issi] = setInterval(() => sendSdsRaw(0, issi), secs * 1000);
  renderIntervalList();
  print(`⏲️ Starte Intervalabfrage für ${issi}`);
}

function removeInterval(issi) {
  const handle = intervalHandles[issi];
  if (handle) {
    clearInterval(handle);
    delete intervalHandles[issi];
    renderIntervalList();
    print(`🛑 Intervalabfrage für ${issi} gestoppt`);
  }
}

window.onload = async () => {
  try {
    await initDb();
  } catch (e) {
    console.error('DB init failed', e);
  }
  try {
    await initMarkersDb();
  } catch (e) {
    console.error('Markers DB init failed', e);
  }
  try {
    await initTracksDb();
  } catch (e) {
    console.error('Tracks DB init failed', e);
  }
  try {
    await initLogViewer();
  } catch (e) {
    console.error('Log viewer init failed', e);
  }
  try {
    await initContactsViewer();
  } catch (e) {
    console.error('Contacts viewer init failed', e);
  }
  try {
    await initTalkGroupDisplay(() => getContacts());
  } catch (e) {
    console.error('Talk group display init failed', e);
  }
  initWebParser();
  initRssiChart();
  initDapnetMonitor();

  const initArea = document.getElementById('initCommands');
  if (initArea) initArea.value = defaultInitCommands.join('\n');

  document.getElementById('connect').onclick = () => {
    const br = parseInt(document.getElementById('baudRate').value, 10);
    const cmds = (initArea.value || '').split(/\n/).map(l => l.trim()).filter(Boolean);
    connectSerial({ baudRate: br || 9600, initCommands: cmds });
  };
  document.getElementById('disconnect').onclick = disconnectSerial;
  document.getElementById('connectPei').onclick = () => {
    const br = parseInt(document.getElementById('baudRatePei').value, 10) || 9600;
    connectPeiSerial({ baudRate: br });
  };
  document.getElementById('disconnectPei').onclick = disconnectPeiSerial;
  const initPeiBtn = document.getElementById('initPei');
  if (initPeiBtn) initPeiBtn.onclick = () => runPeiInit();
  document.getElementById('sendSds').onclick = sendSds;
  const reqGpsBtn = document.getElementById('requestGps');
  if (reqGpsBtn) reqGpsBtn.onclick = () => {
    const issi = document.getElementById('gpsIssi').value.trim();
    if (!issi) return print('⚠️ ISSI fehlt');
    setIssiIconType(issi, currentMarkerType);
    requestGps();
  };
  document.getElementById('startInterval').onclick = startInterval;
  document.getElementById('requestLip').onclick = () => {
    const issi = document.getElementById('gpsIssi').value.trim();
    if (issi) sendLipRequest(issi);
  };
  document.getElementById('requestLongLip').onclick = () => {
    const issi = document.getElementById('gpsIssi').value.trim();
    if (issi) sendLongLipRequest(issi);
  };
  document.getElementById('requestLrrp').onclick = () => {
    const issi = document.getElementById('gpsIssi').value.trim();
    if (issi) sendLrrpRequest(issi);
  };
  document.getElementById('sendCustom').onclick = () => {
    const val = document.getElementById('customCommand').value;
    if (val) sendCommand(val);
  };
  const sendPeiBtn = document.getElementById('sendCustomPei');
  if (sendPeiBtn) sendPeiBtn.onclick = () => {
    const val = document.getElementById('customPeiCommand').value;
    if (val) sendPeiCommand(val);
  };
  const importBtn = document.getElementById('importWebMarkers');
  if (importBtn) importBtn.onclick = async () => {
    print('🌍 Lade Marker …');
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), MARKER_TIMEOUT)
      );
      const markers = await Promise.race([fetchRemoteMarkers(), timeout]);
      addRemoteMarkers(markers);
      print(`✅ ${markers.length} Marker importiert`);
    } catch {
      print('❌ Marker konnten nicht geladen werden');
    }
  };
  const hamnetBtn = document.getElementById('importHamnetMarkers');
  if (hamnetBtn) hamnetBtn.onclick = importHamnetMarkers;
  document.getElementById('enableTnp1').onclick = enableAllTnp1Profiles;
  const select = document.getElementById('tnp1ProfileSelect');
  for (let i = 0; i <= 15; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
  document.getElementById('enableTnp1Single').onclick = () => {
    const profile = select.value;
    enableTnp1Profile(profile);
  };
  document.getElementById('clearDb').onclick = () => {
    const storeSelect = document.getElementById('dbStore');
    const store = storeSelect ? storeSelect.value : 'all';
    if (store === 'all') {
      clearDb();
      clearTracks();
    } else {
      if (store === 'tracks') {
        clearTracks();
      } else {
        clearStore(store);
      }
    }
  };
  const clearLogBtn = document.getElementById('clearLog');
  if (clearLogBtn) clearLogBtn.onclick = () => {
    const out = document.getElementById('output');
    out.value = '';
  };
  const ackBox = document.getElementById('ackEnabled');
  if (ackBox) {
    setAckEnabled(ackBox.checked);
    ackBox.onchange = () => setAckEnabled(ackBox.checked);
  }
  const labelInput = document.getElementById('houseLabel');
  if (labelInput) {
    setHouseLabel(labelInput.value);
    labelInput.onchange = () => setHouseLabel(labelInput.value);
  }
  const keepBox = document.getElementById('keepMarkers');
  if (keepBox) {
    setKeepMarkers(keepBox.checked);
    keepBox.onchange = () => setKeepMarkers(keepBox.checked);
  }
  const markerSel = document.getElementById('markerSelect');
  if (markerSel) {
    currentMarkerType = markerSel.value;
    markerSel.onchange = () => { currentMarkerType = markerSel.value; };
  }
  const trackSel = document.getElementById('trackSelect');
  if (trackSel) {
    for (let i = 1; i <= 10; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      trackSel.appendChild(opt);
    }
    const val = parseInt(trackSel.value, 10);
    currentTrackId = isNaN(val) ? null : val;
    setCurrentTrack(currentTrackId);
    trackSel.onchange = () => {
      const v = parseInt(trackSel.value, 10);
      currentTrackId = isNaN(v) ? null : v;
      setCurrentTrack(currentTrackId);
    };
  }
  const clearTrackBtn = document.getElementById('clearTrack');
  if (clearTrackBtn) clearTrackBtn.onclick = () => {
    if (currentTrackId != null) {
      clearTrack(currentTrackId);
      deleteTrackDb(currentTrackId);
    }
  };
  const darkToggle = document.getElementById('darkModeToggle');
  if (darkToggle) {
    const applyDark = val => {
      document.body.classList.toggle('dark', val);
      localStorage.setItem('darkMode', val ? '1' : '0');
    };
    const current = localStorage.getItem('darkMode') === '1';
    applyDark(current);
    darkToggle.checked = current;
    darkToggle.onchange = () => applyDark(darkToggle.checked);
  }
  generateButtons(sendCommand);
  initMap();
  const storedMarkers = await getMarkers();
  loadMarkers(storedMarkers);
  const storedTracks = await getSavedTracks();
  loadTrackLines(storedTracks);
  if (map) {
    map.on('click', async e => {
      const desc = prompt('Beschreibung für Marker?');
      if (desc !== null) {
        const id = await addMarker({ lat: e.latlng.lat, lon: e.latlng.lng, description: desc });
        if (id !== null) addStaticMarker({ id, lat: e.latlng.lat, lon: e.latlng.lng, description: desc });
      }
    });
  }
  document.addEventListener('markersChange', async () => {
    const list = await getMarkers();
    loadMarkers(list);
  });
  document.addEventListener('trackChange', e => {
    const { id, points } = e.detail || {};
    if (id != null) saveTrack(id, points);
  });
  renderIntervalList();

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (e) {
      console.error('SW registration failed', e);
    }
  }

};
