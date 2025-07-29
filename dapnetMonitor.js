import { print } from './utils.js';

let socket = null;

export function initDapnetMonitor() {
  const btn = document.getElementById('dapnetConnect');
  if (btn) btn.onclick = toggleMonitor;
}

function toggleMonitor() {
  const btn = document.getElementById('dapnetConnect');
  if (socket) {
    socket.close();
    socket = null;
    if (btn) btn.textContent = 'Start Monitor';
    print('🛑 DAPNET Monitor gestoppt');
    return;
  }
  const hostInput = document.getElementById('dapnetHost').value.trim();
  const host = hostInput || 'wss://www.hampager.de/api/ws';
  const callsign = document.getElementById('dapnetUser').value.trim();
  const auth = document.getElementById('dapnetKey').value.trim();
  if (!callsign || !auth) return print('⚠️ Benutzer oder Auth Key fehlt');
  const url = host.startsWith('ws') ? host : `wss://${host}`;
  socket = new WebSocket(url);
  socket.onopen = () => {
    socket.send(`[DAPNETGateway v1.0 ${callsign.toLowerCase()} ${auth}]\r\n`);
    if (btn) btn.textContent = 'Stop Monitor';
    print('🔌 DAPNET Monitor verbunden');
  };
  socket.onmessage = e => {
    try {
      const data = JSON.parse(e.data);
      const out = document.getElementById('dapnetMessages');
      if (out) {
        const line = `${data.timestamp || ''} ${data.address}: ${data.text}`.trim();
        out.value = line + '\n' + out.value;
        out.scrollTop = 0;
      }
    } catch (e) {
      console.error('Error parsing DAPNET data', e);
    }
  };
  socket.onclose = () => {
    if (btn) btn.textContent = 'Start Monitor';
    socket = null;
    print('🛑 DAPNET Monitor getrennt');
  };
  socket.onerror = () => {
    print('❌ DAPNET WebSocket Fehler');
    socket.close();
  };
}

