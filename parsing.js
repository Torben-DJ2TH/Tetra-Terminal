import { print } from './utils.js';
import { updateMap, updateHousePosition, gpsPositions, addTrackPointForCurrent } from './map.js';
import { sendSdsRaw, gpsRequestRetries, sendSdsAck } from './sds.js';
import { logGps, logSds } from './db.js';
import { addRssi } from './rssiChart.js';
import { markGroupActive } from './tgDisplay.js';

const lineListeners = [];

export function addLineListener(fn) {
  if (typeof fn === 'function') lineListeners.push(fn);
}

export function removeLineListener(fn) {
  const idx = lineListeners.indexOf(fn);
  if (idx >= 0) lineListeners.splice(idx, 1);
}

let pendingCtsdsr = null;
let pendingGcliLines = 0;

const knownTgs = ['1', '2', '3', '4', '91102', '262', '26200'];

const callRefToTg = {};

function parseGroupActivity(line) {
  let tg = null;
  let issi = null;
  let ref = null;

  if (line.startsWith('+CTICN:')) {
    const parts = line.split(':')[1].split(',').map(p => p.trim());
    if (parts.length >= 6) {
      ref = parts[0];
      issi = parts[4];
      tg = parts[parts.length - 2];
      callRefToTg[ref] = tg;
    }
  } else if (line.startsWith('+CTGS:')) {
    const parts = line.split(':')[1].split(',').map(p => p.trim());
    if (parts.length >= 2) {
      ref = parts[0];
      tg = parts[1];
      callRefToTg[ref] = tg;
    }
  } else if (line.startsWith('+CTXG:')) {
    const parts = line.split(':')[1].split(',').map(p => p.trim());
    if (parts.length >= 6) {
      ref = parts[0];
      issi = parts[5];
      tg = callRefToTg[ref];
    }
  } else if (line.startsWith('+CTCR:')) {
    const parts = line.split(':')[1].split(',').map(p => p.trim());
    if (parts.length >= 1) {
      ref = parts[0];
      delete callRefToTg[ref];
    }
  }

  if (tg && knownTgs.includes(tg)) {
    markGroupActive(tg, issi);
  }
}

export function handleData(data) {
  const lines = data.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    print('⬅️ ' + line);
    parseGroupActivity(line);

    lineListeners.forEach(fn => {
      try { fn(line); } catch (e) { console.error(e); }
    });

    if (line.includes('+CME ERROR: 35')) {
      print('⚠️ Hinweis: CME ERROR 35 — ggf. harmlos (Nachricht evtl. trotzdem gesendet)');
      continue;
    }

    if (line.startsWith('+CTSDSR')) {
      pendingCtsdsr = line;
      continue;
    } else if (pendingCtsdsr && line.match(/^\s*,/)) {
      pendingCtsdsr += line;
      continue;
    } else if (pendingCtsdsr && /^[0-9A-Fa-f]+$/.test(line.trim())) {
      parseSds(line.trim(), pendingCtsdsr);
      pendingCtsdsr = null;
      continue;
    }

    if (line.startsWith('+GCLI:')) {
      const count = parseInt(line.split(':')[1]);
      if (!isNaN(count)) pendingGcliLines = count;
      continue;
    } else if (pendingGcliLines > 0) {
      parseGcliEntry(line);
      pendingGcliLines--;
      continue;
    }

    if (line.startsWith('+CSQ: ')) parseSignalStrength(line);
    if (line.startsWith('+CREG:')) parseCreg(line);
    if (line.includes('+GPSPOS:')) parseGps(line);
    if (line.includes('+CMGS:')) print('✅ Empfangsbestätigung: ' + line);
  }
}

export function parseSignalStrength(line) {
  const match = /\+CSQ:\s*(\d+)/.exec(line);
  if (match) {
    const rssi = parseInt(match[1]);
    const dbm = -113 + rssi * 2;
    print(`📶 RSSI: ${rssi} → ${dbm} dBm`);
    addRssi(dbm);
  }
}

export function parseCreg(line) {
  // Try to detect explicit dBm values first
  const dbmMatch = /(-?\d+)\s*dBm/i.exec(line);
  if (dbmMatch) {
    const dbm = parseInt(dbmMatch[1]);
    if (!isNaN(dbm)) {
      print(`📶 CREG: ${dbm} dBm`);
      return;
    }
  }

  // Otherwise look for a RSSI-style value (0-31) at the end
  const parts = line.split(',');
  const rssiVal = parseInt(parts[parts.length - 1]);
  if (!isNaN(rssiVal) && rssiVal >= 0 && rssiVal <= 31) {
    const dbm = -113 + rssiVal * 2;
    print(`📶 CREG RSSI: ${rssiVal} → ${dbm} dBm`);
    addRssi(dbm);
  }
}

export function parseGps(line) {
  const match = /\+GPSPOS:\s+\d{2}:\d{2}:\d{2},N:\s*(\d{2})_(\d{2}\.\d+),E:\s*(\d{3})_(\d{2}\.\d+)/.exec(line);
  if (match) {
    const [latD, latM, lonD, lonM] = match.slice(1).map(Number);
    const lat = latD + latM / 60;
    const lon = lonD + lonM / 60;
    if (!isNaN(lat) && !isNaN(lon)) {
      updateHousePosition(lat, lon);
      logGps({ from: 'terminal', lat, lon });
    }
  } else {
    print('⚠️ Unbekanntes GPS-Format');
  }
}

export function parseGcliEntry(line) {
  const parts = line.split(',');
  if (parts.length < 4) return;
  const cell = parts[0].trim();
  const freq = parts[1].trim();
  const rssiVal = parseInt(parts[2]);
  if (!isNaN(rssiVal)) {
    const dbm = -113 + rssiVal * 2;
    print(`📶 GCLI Zelle ${cell} (${freq}): ${rssiVal} → ${dbm} dBm`);
  } else {
    print(`📶 GCLI: ${line}`);
  }
}

export function parseSds(line, previousLine = '') {
  if (!previousLine.includes('+CTSDSR')) return;

  const parts = previousLine.split(',');
  const fromIssi = parts[1]?.trim() || 'Unbekannt';
  const destIssi = parts[3]?.trim() || null;
  const hex = line.trim();

  logSds({ direction: 'in', from: fromIssi, dest: destIssi, hex });

  print(`🧪 Verarbeite SDS-Antwort von ISSI ${fromIssi}`);
  print(`🧪 Hexdaten: ${hex}`);
  print(`🧪 Länge: ${hex.length} Zeichen (${(hex.length / 2).toFixed(1)} Bytes)`);

  if (hex === '8200010D06') {
    print(`✅ ACK von ${fromIssi}`);
    return;
  }

  if (hex.startsWith('8200010D')) {
    const text = hexToAscii(hex.slice(8));
    print(`📩 Text-SDS von ${fromIssi}: ${text}`);
    sendSdsAck(fromIssi);
    return;
  }

  // Heuristic: if the payload after the first 4 bytes is mostly printable ASCII,
  // treat it as a text SDS to avoid misinterpreting it as GPS data.
  if (isLikelyText(hex.slice(8))) {
    const text = hexToAscii(hex.slice(8));
    print(`📩 Text-SDS von ${fromIssi}: ${text}`);
    sendSdsAck(fromIssi);
    return;
  }

  if (hex.length === 22 && hex.startsWith('0A00')) {
    parseCompactLipSds(hex, fromIssi);
    sendSdsAck(fromIssi);
    return;
  }

  if (hex.length >= 18) {
    parseLipSds(hex, fromIssi);
    if (hex.length >= 40) parseLongLipSds(hex, fromIssi);
    if (hex.startsWith('01') || hex.startsWith('81')) parseLrrpSds(hex, fromIssi);
  } else {
    print(`⚠️ SDS-Daten zu kurz für GPS-Parsing: ${hex}`);
    if (hex.length >= 8) {
      const text = hexToAscii(hex.slice(8));
      print(`📩 Text-SDS von ${fromIssi}: ${text}`);
    }
    sendSdsAck(fromIssi);
    return;
  }

  const latHex = hex.slice(10, 18);
  const latRaw = parseLittleEndianSigned(latHex) / 1e6;
  print(`🧪 LAT HEX: ${latHex} → ${latRaw}`);

  let lonRaw = NaN;
  if (hex.length >= 26) {
    let lonHex = hex.slice(18, 26);
    print(`🧪 LON HEX (original): ${lonHex}`);

    if (lonHex.length === 6) {
      lonHex += '00';
      print(`🧪 LON HEX (aufgefüllt): ${lonHex}`);
    }

    if (lonHex.length === 8) {
      lonRaw = parseLittleEndianSigned(lonHex) / 1e6;
      print(`🧪 LON Wert: ${lonRaw}`);
    }
  } else {
    print(`⚠️ LON-Feld nicht vorhanden`);
  }

  let speed = null, heading = null, accuracy = null;

  if (hex.length >= 30) {
    const speedHex = hex.slice(26, 30);
    speed = parseInt(swapBytes(speedHex), 16) / 10;
    print(`🧪 SPEED: ${speedHex} → ${speed} km/h`);
  }

  if (hex.length >= 34) {
    const headingHex = hex.slice(30, 34);
    heading = parseInt(swapBytes(headingHex), 16);
    print(`🧪 HEADING: ${headingHex} → ${heading}°`);
  }

  if (hex.length >= 36) {
    const accuracyHex = hex.slice(34, 36);
    accuracy = parseInt(accuracyHex, 16);
    print(`🧪 ACCURACY: ${accuracyHex} → ±${accuracy} m`);
  }

  if (!isNaN(latRaw) && !isNaN(lonRaw)) {
    gpsPositions[fromIssi] = { lat: latRaw, lon: lonRaw };
    addTrackPointForCurrent(latRaw, lonRaw);
    logGps({ from: fromIssi, lat: latRaw, lon: lonRaw, speed, heading, accuracy });
    let info = `📍 GPS von ISSI ${fromIssi}: ${latRaw.toFixed(6)}, ${lonRaw.toFixed(6)}`;
    if (speed != null) info += ` 🚗 ${speed.toFixed(1)} km/h`;
    if (heading != null) info += ` 🧭 ${heading}°`;
    if (accuracy != null) info += ` ±${accuracy} m`;
    print(info);
    updateMap();
    gpsRequestRetries[fromIssi] = 0;
  } else if (!isNaN(latRaw)) {
    print(`⚠️ Nur LAT empfangen von ISSI ${fromIssi}: ${latRaw.toFixed(6)}, LON fehlt`);
    const retryCount = gpsRequestRetries[fromIssi] || 0;
    if (retryCount < 2) {
      print(`🔁 SDS-Antwort zu kurz – versuche erneut (Versuch ${retryCount + 2}/3)`);
      setTimeout(() => sendSdsRaw(retryCount + 1, fromIssi), 1000);
    } else {
      print(`❌ Maximale Wiederholungsversuche erreicht. Keine vollständige GPS-Antwort.`);
    }
  } else {
    print(`⚠️ Ungültige GPS-Daten empfangen: ${hex}`);
  }
  sendSdsAck(fromIssi);
}

function parseLipSds(hex, issi) {
  print(`🧪 SDS (LIP) von ISSI ${issi}: ${hex}`);

  if (hex.length < 26) {
    print('⚠️ LIP-Daten zu kurz für vollständige Koordinaten');
    return;
  }

  const latHex = hex.slice(10, 18);
  const lonHex = hex.slice(18, 26);

  const lat = parseLittleEndianSigned(latHex) / 1e6;
  const lon = parseLittleEndianSigned(lonHex) / 1e6;

  let speed = null, heading = null, accuracy = null;

  if (hex.length >= 30) {
    const speedHex = hex.slice(26, 30);
    speed = parseInt(swapBytes(speedHex), 16) / 10;
  }

  if (hex.length >= 34) {
    const headingHex = hex.slice(30, 34);
    heading = parseInt(swapBytes(headingHex), 16);
  }

  if (hex.length >= 36) {
    const accHex = hex.slice(34, 36);
    accuracy = parseInt(accHex, 16);
  }

  gpsPositions[issi] = { lat, lon };
  addTrackPointForCurrent(lat, lon);
  logGps({ from: issi, lat, lon, speed, heading, accuracy });

  let info = `📍 GPS von ISSI ${issi}: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  if (speed != null) info += ` 🚗 ${speed.toFixed(1)} km/h`;
  if (heading != null) info += ` 🧭 ${heading}°`;
  if (accuracy != null) info += ` ±${accuracy} m`;

  print(info);
  updateMap();
}

function parseLongLipSds(hex, issi) {
  print(`🧪 SDS (Long LIP) von ISSI ${issi}: ${hex}`);
  if (hex.length < 40) {
    print('⚠️ Long LIP Daten zu kurz');
    return;
  }
  const latHex = hex.slice(10, 18);
  const lonHex = hex.slice(18, 26);
  const altHex = hex.slice(26, 30);
  const lat = parseLittleEndianSigned(latHex) / 1e6;
  const lon = parseLittleEndianSigned(lonHex) / 1e6;
  const alt = parseInt(swapBytes(altHex), 16);
  gpsPositions[issi] = { lat, lon };
  addTrackPointForCurrent(lat, lon);
  logGps({ from: issi, lat, lon, altitude: alt });
  print(`📍 Long LIP ${issi}: ${lat.toFixed(6)}, ${lon.toFixed(6)} → ${alt} m`);
  updateMap();
}

function parseCompactLipSds(hex, issi) {
  print(`🧪 SDS (Compact LIP) von ISSI ${issi}: ${hex}`);
  if (hex.length !== 22) {
    print('⚠️ Compact LIP Daten ungültig');
    return;
  }
  const latHex = hex.slice(4, 10);
  const lonHex = hex.slice(10, 16);
  const speedHex = hex.slice(16, 18);
  const headingHex = hex.slice(18, 20);
  const accHex = hex.slice(20, 22);

  const latVal = parse24Signed(latHex);
  const lonVal = parse24Signed(lonHex);

  const COMPACT_LAT_OFFSET = 1.554295;
  const COMPACT_LON_OFFSET = 43.045017;

  const lat = latVal / 131072 - COMPACT_LAT_OFFSET;
  const lon = lonVal / 131072 - COMPACT_LON_OFFSET;

  let speed = null, heading = null, accuracy = null;
  if (speedHex) speed = parseInt(speedHex, 16);
  if (headingHex) heading = parseInt(headingHex, 16);
  if (accHex) accuracy = parseInt(accHex, 16);

  gpsPositions[issi] = { lat, lon };
  addTrackPointForCurrent(lat, lon);
  logGps({ from: issi, lat, lon, speed, heading, accuracy });

  let info = `📍 GPS von ISSI ${issi}: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  if (speed != null) info += ` 🚗 ${speed} km/h`;
  if (heading != null) info += ` 🧭 ${heading}°`;
  if (accuracy != null) info += ` ±${accuracy} m`;
  print(info);
  updateMap();
}

function parseLrrpSds(hex, issi) {
  print(`🧪 SDS (LRRP) von ISSI ${issi}: ${hex}`);
  if (hex.length < 28) return;
  const latHex = hex.slice(12, 20);
  const lonHex = hex.slice(20, 28);
  const lat = parseLittleEndianSigned(latHex) / 1e6;
  const lon = parseLittleEndianSigned(lonHex) / 1e6;
  gpsPositions[issi] = { lat, lon };
  addTrackPointForCurrent(lat, lon);
  logGps({ from: issi, lat, lon });
  print(`📍 LRRP ${issi}: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  updateMap();
}

function parse24Signed(hex) {
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return NaN;
  let val = parseInt(hex, 16);
  if (val & 0x800000) val -= 0x1000000;
  return val;
}

function parseLittleEndianSigned(hex) {
  if (!/^[0-9a-fA-F]{8}$/.test(hex)) return NaN;
  const bytes = hex.match(/../g);
  const reversed = bytes.reverse().join('');
  return hexToSigned(reversed);
}

function hexToSigned(hex) {
  const num = parseInt(hex, 16);
  const bitLength = hex.length * 4;
  const max = 1 << (bitLength - 1);
  return num >= max ? num - (1 << bitLength) : num;
}

function swapBytes(hex) {
  const bytes = hex.match(/../g);
  if (!bytes || bytes.length !== 2) return hex;
  return bytes.reverse().join('');
}

function hexToAscii(hex) {
  let text = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (!isNaN(code)) text += String.fromCharCode(code);
  }
  return text;
}

function isLikelyText(hex) {
  const ascii = hexToAscii(hex);
  if (!ascii) return false;
  let printable = 0;
  for (const ch of ascii) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) printable++;
  }
  return printable / ascii.length > 0.8;
}
