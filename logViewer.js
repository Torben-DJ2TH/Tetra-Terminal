export let logs = [];
import { getAllLogs, exportDbJson, importDbJson, deleteEntry, getStoreEntries } from './db.js';
import { getMarkers, deleteMarker, updateMarker } from './markersDb.js';
import { getTracks, deleteTrackDb } from './tracksDb.js';
import { updateMarkerPopup } from './map.js';

export async function initLogViewer() {
  await loadLogs();
  document.getElementById('dbFilter').addEventListener('input', renderTable);
  document.getElementById('dbSort').addEventListener('change', renderTable);
  const storeSelect = document.getElementById('dbStore');
  if (storeSelect) storeSelect.addEventListener('change', loadLogs);
  document.getElementById('exportDbCsv').addEventListener('click', exportDbCsv);
  document.getElementById('exportDbJson').addEventListener('click', exportDbJsonFile);
  document.getElementById('importDbJson').addEventListener('click', () => {
    const fileInput = document.getElementById('importDbFile');
    if (fileInput.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = e => importDbJson(e.target.result);
    reader.readAsText(fileInput.files[0]);
  });
  document.addEventListener('dbChange', loadLogs);
  document.addEventListener('markersChange', loadLogs);
  document.addEventListener('trackChange', loadLogs);
}

export async function loadLogs() {
  const storeSelect = document.getElementById('dbStore');
  const store = storeSelect ? storeSelect.value : 'all';
  if (store === 'all') {
    logs = await getAllLogs();
  } else {
    if (store === 'markers') {
      const entries = await getMarkers();
      logs = entries.map(e => ({ store, ...e, type: 'marker' }));
    } else if (store === 'tracks') {
      const entries = await getTracks();
      logs = entries.map(e => ({ store, ...e, type: 'track' }));
    } else {
      const entries = await getStoreEntries(store);
      logs = entries.map(e => ({ store, ...e, type: e.type || store }));
    }
  }
  renderTable();
}

function renderTable() {
  const filter = document.getElementById('dbFilter').value.toLowerCase();
  const sort = document.getElementById('dbSort').value;
  const storeSelect = document.getElementById('dbStore');
  const currentStore = storeSelect ? storeSelect.value : 'all';
  let items = logs.slice();
  if (filter) {
    items = items.filter(l => JSON.stringify(l).toLowerCase().includes(filter));
  }
  items.sort((a, b) => {
    const diff = new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
    return sort === 'timestamp_asc' ? diff : -diff;
  });
  const tbody = document.getElementById('dbTableBody');
  tbody.innerHTML = '';
  items.forEach(entry => {
    const tr = document.createElement('tr');
    const data = formatEntry(entry, currentStore === 'all' ? entry.store : currentStore);
    const ts = entry.timestamp || '';
    const type = entry.type || currentStore;
    if (entry.store === 'markers') {
      const desc = entry.description ? entry.description.replace(/"/g, '&quot;') : '';
      tr.innerHTML = `<td>${ts}</td><td>${type}</td><td>${entry.lat}, ${entry.lon} <input type="text" value="${desc}" data-id="${entry.id}"></td><td><button data-store="${entry.store}" data-id="${entry.id}">🗑️</button></td>`;
    } else {
      tr.innerHTML = `<td>${ts}</td><td>${type}</td><td>${data}</td><td><button data-store="${entry.store}" data-id="${entry.id}">🗑️</button></td>`;
    }
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-store]').forEach(btn => {
    btn.onclick = () => {
      const store = btn.getAttribute('data-store');
      const id = parseInt(btn.getAttribute('data-id'), 10);
      if (!isNaN(id)) {
        if (store === 'markers') {
          deleteMarker(id);
        } else if (store === 'tracks') {
          deleteTrackDb(id);
        } else {
          deleteEntry(store, id);
        }
      }
    };
  });

  tbody.querySelectorAll('input[data-id]').forEach(inp => {
    inp.onchange = () => {
      const id = parseInt(inp.getAttribute('data-id'), 10);
      if (!isNaN(id)) {
        const val = inp.value;
        updateMarker(id, { description: val });
        updateMarkerPopup(id, val);
      }
    };
  });
}

function formatEntry(entry, store) {
  const type = store || entry.type;
  switch (type) {
    case 'command':
    case 'commands':
      return entry.command;
    case 'sds':
      return entry.message || entry.hex;
    case 'gps':
      return `${entry.lat}, ${entry.lon}`;
    case 'contacts':
      return `${entry.index} ${entry.number} ${entry.name || ''}`;
    case 'web_status':
      return `${entry.site} ${entry.state} ${entry.groups}`;
    case 'web_qrv':
      return `${entry.issi} ${entry.callsign} ${entry.site} ${entry.groups}`;
    case 'web_logs':
      return `${entry.site} ${entry.module} ${entry.message}`;
    case 'markers':
    case 'marker':
      return entry.description || '';
    case 'tracks':
    case 'track':
      return (entry.points || []).map(p => p.join(',')).join(' | ');
    default:
      return '';
  }
}

function exportDbCsv() {
  const rows = ['timestamp,type,data'];
  logs.forEach(entry => {
    let data = formatEntry(entry, entry.store).replace(/"/g, '""');
    rows.push(`"${entry.timestamp}","${entry.type}","${data}"`);
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'db_logs.csv';
  link.click();
}

async function exportDbJsonFile() {
  const json = await exportDbJson();
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'db_logs.json';
  link.click();
}
