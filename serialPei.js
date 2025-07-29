import { print, delay } from './utils.js';

let peiInit = [];
async function loadPeiInit() {
  if (peiInit.length) return;
  try {
    const resp = await fetch('peiInit.json');
    peiInit = await resp.json();
  } catch (e) {
    print('❌ PEI Init-Datei konnte nicht geladen werden: ' + e);
  }
}

export let port2;
let reader2, writer2;
let pendingTime2 = null;
let lastOptions2 = { baudRate: 9600 };

export async function connectPeiSerial(options = {}) {
  try {
    if (!('serial' in navigator)) {
      print('❌ Web Serial API wird nicht unterstützt');
      return;
    }
    lastOptions2 = { baudRate: options.baudRate || 9600 };
    port2 = await navigator.serial.requestPort();
    await port2.open(lastOptions2);
    port2.addEventListener('disconnect', () => {
      print('❌ PEI Verbindung verloren');
    });

    const encoder = new TextEncoderStream();
    encoder.readable.pipeTo(port2.writable);
    writer2 = encoder.writable.getWriter();

    const decoder = new TextDecoderStream();
    port2.readable.pipeTo(decoder.writable);
    reader2 = decoder.readable.getReader();

    print('✅ PEI Verbindung hergestellt');
    listenPei();
    if (options.mode) runPeiInit(options.mode);
  } catch (e) {
    print('❌ Fehler beim Verbinden (PEI): ' + e);
  }
}

export async function disconnectPeiSerial() {
  try {
    if (reader2) {
      await reader2.cancel();
      reader2.releaseLock();
      reader2 = null;
    }
    if (writer2) {
      await writer2.close();
      writer2.releaseLock();
      writer2 = null;
    }
    if (port2) {
      await port2.close();
      port2 = null;
    }
    print('🔌 PEI Verbindung getrennt');
  } catch (e) {
    print('❌ Fehler beim Trennen (PEI): ' + e);
  }
}

export async function sendPeiCommand(cmd) {
  if (!writer2) return print('⚠️ PEI nicht verbunden');
  let send = cmd;
  if (!send.endsWith('\x1a')) {
    send += '\r';
  }
  pendingTime2 = Date.now();
  await writer2.write(send + '\n');
  print('➡️ [PEI] ' + cmd);
}

async function listenPei() {
  try {
    let buffer = '';
    while (true) {
      const { value, done } = await reader2.read();
      if (done) break;
      if (value) {
        buffer += value;
        let idx;
        while ((idx = buffer.indexOf('\r\n')) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (pendingTime2) {
            const diff = Date.now() - pendingTime2;
            pendingTime2 = null;
            print(`⏱️ PEI Antwortzeit: ${diff} ms`);
          }
          if (line.trim()) {
            print('⬅️ [PEI] ' + line.trim());
          }
        }
      }
    }
  } catch (e) {
    print('❌ Lesefehler (PEI): ' + e);
  }
}

export async function runPeiInit(mode = 'DMO-MS') {
  await loadPeiInit();
  const entry = peiInit.find(e => e.mode === mode);
  if (!entry) return print('⚠️ PEI Init-Modus nicht gefunden');
  for (const cmd of entry.commands) {
    await sendPeiCommand(cmd);
    await delay(200);
  }
  print('✅ PEI Init abgeschlossen');
}
