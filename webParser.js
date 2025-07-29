export let socket = null;
let webLogs = [];
let statusList = [];
let qrvList = [];
import { saveStatus, saveQrvUsers, saveWebLogs, getStatusEntries, getQrvUsers, getWebLogs } from './db.js';
import { print } from './utils.js';

export function initWebParser() {
  const btn = document.getElementById('toggleWebParser');
  if (btn) btn.onclick = toggleWebParser;
  loadFromDb();
}

export function toggleWebParser() {
  const btn = document.getElementById('toggleWebParser');
  if (socket) {
    socket.close();
    socket = null;
    if (btn) btn.textContent = 'Start Web Parser';
    print('🛑 Web Parsing gestoppt');
  } else {
    connectSocket();
    if (btn) btn.textContent = 'Stop Web Parser';
  }
}

async function loadFromDb() {
  const [status, qrv, logs] = await Promise.all([
    getStatusEntries(),
    getQrvUsers(),
    getWebLogs()
  ]);
  statusList = status.slice();
  qrvList = qrv.slice();
  webLogs = logs.slice();
  renderStatus(statusList);
  updateSiteDisplay(statusList);
  renderQrv(qrvList);
  renderLogs(webLogs);
}

function connectSocket() {
  const url = 'wss://core01.tmo.services/ws.io';
  socket = new WebSocket(url);
  socket.onopen = () => print('🔌 WebSocket verbunden');
  socket.onmessage = handleMessage;
  socket.onerror = e => print('❌ WebSocket-Fehler: ' + e.message);
  socket.onclose = () => {
    print('🛑 WebSocket getrennt');
    socket = null;
    const btn = document.getElementById('toggleWebParser');
    if (btn) btn.textContent = 'Start Web Parser';
  };
}

function handleMessage(evt) {
  let data;
  try {
    data = JSON.parse(evt.data);
  } catch {
    return;
  }

  if (data.type === 'status') {
    const obj = JSON.parse(data.msg);
    const list = Object.keys(obj).map(site => {
      const val = obj[site];
      const groups = [...(val.calls_out || []), ...(val.calls_in || []), ...(val.calls_ignore || [])].join(' ');
      return { site, state: val.ws_state || '', groups };
    });
    statusList = list;
    saveStatus(list);
    renderStatus(list);
    updateSiteDisplay(list);
  } else if (data.type === 'qrv') {
    const obj = JSON.parse(data.msg);
    const list = Object.keys(obj).map(key => {
      const val = obj[key];
      return { issi: val.issi || '', callsign: val.callsign || '', site: val.site || '', groups: val.groups || '' };
    });
    qrvList = list;
    saveQrvUsers(list);
    renderQrv(list);
    updateSiteDisplay(statusList);
  } else if (data.type === 'logging' && data.module && data.module.includes('log/')) {
    const entry = { site: data.origin || '', module: data.module || '', message: data.message || '', timestamp: data.timestamp || '' };
    webLogs.unshift(entry);
    if (webLogs.length > 100) webLogs.pop();
    saveWebLogs(webLogs);
    renderLogs(webLogs);
  }
}

function renderStatus(list) {
  const tbody = document.getElementById('webStatusBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.site}</td><td>${e.state}</td><td>${e.groups}</td>`;
    tbody.appendChild(tr);
  });
  statusList = list.slice();
  updateSiteDisplay(statusList);
}

function renderQrv(list) {
  const tbody = document.getElementById('webQrvBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.issi}</td><td>${e.callsign}</td><td>${e.site}</td><td>${e.groups}</td>`;
    tbody.appendChild(tr);
  });
  qrvList = list.slice();
  updateSiteDisplay(statusList);
}

function renderLogs(list) {
  const tbody = document.getElementById('webLoggingBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  list.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.site}</td><td>${e.module}</td><td>${e.message}</td><td>${e.timestamp}</td>`;
    tbody.appendChild(tr);
  });
}

function updateSiteDisplay(list) {
  const container = document.getElementById('siteStatusDisplay');
  if (!container) return;
  container.innerHTML = '';
  list.forEach(e => {
    const div = document.createElement('div');
    const isOnline = e.state && e.state.toLowerCase().includes('online');
    div.className = 'site-entry ' + (isOnline ? 'online' : 'offline');
    const users = qrvList
      .filter(u => u.site === e.site)
      .map(u => `${u.issi} ${u.callsign}`)
      .join('\n');
    if (users) div.title = users;
    div.textContent = e.site;
    container.appendChild(div);
  });
}
