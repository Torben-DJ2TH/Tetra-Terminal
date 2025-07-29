import { print, delay } from './utils.js';
import { sendCommand } from './serial.js';
import { logSds } from './db.js';

export const gpsRequestRetries = {};
export let lastGpsIssi = null;
export let ackEnabled = false;

export function setAckEnabled(val) {
  ackEnabled = !!val;
}

export async function sendSdsHex(dest, hex, type = 0) {
  if (!dest || !hex) {
    return print('⚠️ Ziel und Daten erforderlich');
  }

  const bitLength = hex.length * 4;

  try {
    await sendCommand('AT+CTSDS=12,' + type + ',0,0,0');
    await delay(300);
    await sendCommand(`AT+CMGS=${dest},${bitLength}`);
    await delay(4000);
    await sendCommand(hex + String.fromCharCode(26));
    print(`✅ SDS an ${dest} gesendet`);
    logSds({ direction: 'out', dest, hex, type });
  } catch (err) {
    print('❌ Fehler beim Senden der SDS-Daten: ' + err);
  }
}

export async function sendSds() {
  const dest = document.getElementById('destination').value.trim();
  const msg = document.getElementById('message').value.trim();
  const type = document.getElementById('sdsType').value;

  if (!dest || !msg) return print('⚠️ Zielnummer und Nachricht erforderlich');

  const textHex = [...msg].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase();
  const pdu = '8200010D' + textHex;
  const bitLength = (pdu.length / 2) * 8;

  try {
    await sendCommand('AT+CTSP=1,3,2');
    await delay(200);
    await sendCommand(`AT+CTSDS=12,${type},0,0,0`);
    await delay(200);
    await sendCommand(`AT+CMGS=${dest},${bitLength}`);
    await delay(4000);
    await sendCommand(pdu + String.fromCharCode(26));
    print('✅ SDS gesendet');
    logSds({ direction: 'out', dest, message: msg, type });
  } catch (err) {
    print('❌ Fehler beim Senden der SDS: ' + err);
  }
}

export async function sendSdsRaw(retryCount = 0, issiOverride = null) {
  const issi = issiOverride || document.getElementById('gpsIssi').value.trim();
  if (!issi) return print('⚠️ ISSI fehlt');

  lastGpsIssi = issi;
  gpsRequestRetries[issi] = retryCount;

  try {
    await sendLipRequest(issi);
    print(`✅ GPS-SDS an ISSI ${issi} gesendet (Versuch ${retryCount + 1})`);
  } catch (err) {
    print('❌ Fehler beim Senden der SDS-Rohdaten: ' + err);
  }
}

export async function requestGps() {
  const issi = document.getElementById('gpsIssi').value;
  if (!issi) return print('⚠️ ISSI fehlt');
  await sendSdsRaw(0, issi);
}

export function sendLipRequest(issi) {
  const hex = '0A4591C128293D';
  return sendSdsHex(issi, hex);
}

export function sendLongLipRequest(issi) {
  const hex = '0A4591C128293D00';
  return sendSdsHex(issi, hex);
}

export function sendLrrpRequest(issi) {
  const hex = '0B01A1000000';
  return sendSdsHex(issi, hex);
}

export function sendSdsAck(issi) {
  if (!ackEnabled) return;
  // ETSI-konforme Empfangsbestätigung (ACK-Zeichen 0x06)
  const ackHex = '8200010D06';
  return sendSdsHex(issi, ackHex);
}
