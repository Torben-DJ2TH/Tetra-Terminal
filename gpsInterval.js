import { sendCommand } from './serial.js';
import { print } from './utils.js';

let gpsHandle = null;

export function toggleGpsInterval() {
  const btn = document.getElementById('gpsIntervalBtn');
  if (gpsHandle) {
    clearInterval(gpsHandle);
    gpsHandle = null;
    if (btn) btn.textContent = 'GPS Interval';
    print('🛑 GPS-Intervall gestoppt');
  } else {
    sendCommand('AT+GPSPOS?');
    gpsHandle = setInterval(() => sendCommand('AT+GPSPOS?'), 30000);
    if (btn) btn.textContent = 'Stop GPS Interval';
    print('⏲️ GPS-Intervall gestartet (30s)');
  }
}
