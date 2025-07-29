import { sendCommand } from './serial.js';
import { print } from './utils.js';

let rssiHandle = null;

export function toggleRssiInterval() {
  const btn = document.getElementById('sigIntervalBtn');
  if (rssiHandle) {
    clearInterval(rssiHandle);
    rssiHandle = null;
    if (btn) btn.textContent = 'Sig Interval';
    print('🛑 Signalstärke-Intervall gestoppt');
  } else {
    sendCommand('AT+CSQ?');
    rssiHandle = setInterval(() => sendCommand('AT+CSQ?'), 30000);
    if (btn) btn.textContent = 'Stop Sig Interval';
    print('⏲️ Signalstärke-Intervall gestartet (30s)');
  }
}
