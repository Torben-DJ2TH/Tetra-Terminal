import net from 'net';

function parseMessage(line) {
  const id = parseInt(line.slice(1,3), 16);
  const parts = line.slice(4).split(':');
  if (parts.length < 5) return null;
  const type = parseInt(parts[0], 10);
  const timestamp = parts[1];
  const address = parseInt(parts[2], 16);
  const func = parseInt(parts[3], 10);
  const text = parts.slice(4).join(':').replace(/\r?\n$/, '');
  return { id, type, timestamp, address, func, text };
}

export function connectDapnet({ host = 'dapnet.afu.rwth-aachen.de', port = 43434, callsign, authKey, onMessage, onError }) {
  if (!callsign || !authKey) throw new Error('callsign and authKey required');
  const socket = net.createConnection({ host, port }, () => {
    const login = `[DAPNETGateway v1.0 ${callsign.toLowerCase()} ${authKey}]\r\n`;
    socket.write(login);
  });
  let buffer = '';
  socket.on('data', data => {
    buffer += data.toString();
    let lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith('#')) {
        const msg = parseMessage(line);
        if (msg && onMessage) onMessage(msg);
        const replyId = ((msg?.id ?? 0) + 1) % 256;
        socket.write(`#${replyId.toString(16).padStart(2,'0')} +\r\n`);
      } else if (line.startsWith('2')) {
        socket.write(line.replace(/\r?\n/, '') + ':0000\r\n');
        socket.write('+\r\n');
      } else if (line.startsWith('7')) {
        socket.write('+\r\n');
      } else {
        socket.write('-\r\n');
      }
    }
  });
  socket.on('error', err => {
    if (onError) onError(err); else console.error(err);
  });
  return socket;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [host, port, callsign, authKey] = process.argv.slice(2);
  connectDapnet({ host, port: Number(port) || 43434, callsign, authKey, onMessage: m => console.log(m) });
}
