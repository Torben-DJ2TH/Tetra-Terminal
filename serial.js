import { print, delay } from './utils.js';
import { handleData } from './parsing.js';
import { logCommand } from './db.js';

export let port;
let reader, writer;
let pendingTime = null;
let lastOptions = { baudRate: 9600 };
export const defaultInitCommands = [
  'ATE0',
  'AT+CSCS="8859-1"',
  'AT+CTSP=1,1,11',
  'AT+CTSP=2,0,0',
  'AT+CREG=2',
  'AT+IFC=0,0',
  'AT+CTSP=1,3,2',
  'ATI',
  'AT+GMI',
  'AT+CTGS?',
  'AT+CTSP=2,2,20',
  'AT+CTSP=1,3,130',
  'AT+CTSP=1,3,137',
  'AT+CTSP=1,3,138',
  'AT+CTSP=1,3,140',
  'AT+GMI?',
  'AT+CNUMF?',
  'AT+GMM',
  'ATI1',
  'AT+CTSP=1,3,3',
  'AT+CTSP=1,3,131',
  'AT+CTSP=1,3,10',
  'AT+CTSP=1,3,224',
  'AT+CTSP=1,3,195',
  'AT+CTSP=1,3,204',
  'AT+CTSP=1,3,210',
  'AT+CTSP=1,3,220',
  'AT+CTSP=1,3,242',
  'ATI7',
  'AT+CTGL=0,0,1',
  'AT+MCDNTN=ComPort-Verbunden,TETRA-Terminal,10,4'
];

export async function connectSerial(options = {}) {
  try {
    if (!('serial' in navigator)) {
      print('❌ Web Serial API wird nicht unterstützt');
      return;
    }
    lastOptions = { baudRate: options.baudRate || 9600 };
    port = await navigator.serial.requestPort();
    await port.open(lastOptions);
    port.addEventListener('disconnect', () => {
      print('❌ Verbindung verloren');
    });

    const encoder = new TextEncoderStream();
    encoder.readable.pipeTo(port.writable);
    writer = encoder.writable.getWriter();

    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    reader = decoder.readable.getReader();

    print('✅ Verbindung hergestellt');
    listen();
    runInitialSetup(options.initCommands);
  } catch (e) {
    print('❌ Fehler beim Verbinden: ' + e);
  }
}

export async function disconnectSerial() {
  try {
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
      reader = null;
    }
    if (writer) {
      await writer.close();
      writer.releaseLock();
      writer = null;
    }
    if (port) {
      await port.close();
      port = null;
    }
    print('🔌 Verbindung getrennt');
  } catch (e) {
    print('❌ Fehler beim Trennen: ' + e);
  }
}

export async function sendCommand(cmd) {
  if (!writer) return print('⚠️ Nicht verbunden');
  print('➡️ ' + cmd);
  logCommand(cmd);
  pendingTime = Date.now();
  await writer.write(cmd + '\r\n');
}

async function listen() {
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        if (pendingTime) {
          const diff = Date.now() - pendingTime;
          pendingTime = null;
          print(`⏱️ Antwortzeit: ${diff} ms`);
        }
        handleData(value);
      }
    }
  } catch (e) {
    print('❌ Lesefehler: ' + e);
  }
}

export async function runInitialSetup(commands = defaultInitCommands) {
  const cmds = Array.isArray(commands) && commands.length ? commands : defaultInitCommands;
  for (const cmd of cmds) {
    await sendCommand(cmd);
    await delay(200);
  }
}

export async function enableAllTnp1Profiles() {
  for (let i = 0; i <= 15; i++) {
    await sendCommand(`AT+CTSP=1,${i},1`);
    await delay(100);
  }
  print('✅ Alle TNP1 Service-Profile aktiviert');
}

export async function enableTnp1Profile(profile) {
  const idx = parseInt(profile, 10);
  if (isNaN(idx) || idx < 0 || idx > 15) {
    return print('⚠️ Ungültiges Profil');
  }
  await sendCommand(`AT+CTSP=1,${idx},1`);
  print(`✅ TNP1 Service-Profile ${idx} aktiviert`);
}

