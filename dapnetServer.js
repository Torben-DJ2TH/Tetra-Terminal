import { WebSocketServer } from 'ws';
import { connectDapnet } from './dapnetClient.js';

const port = process.env.DAPNET_WS_PORT ? Number(process.env.DAPNET_WS_PORT) : 9002;
const wss = new WebSocketServer({ port });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', 'http://localhost');
  const host = url.searchParams.get('host') || 'dapnet.afu.rwth-aachen.de';
  const port = Number(url.searchParams.get('port')) || 43434;
  const callsign = url.searchParams.get('callsign');
  const authKey = url.searchParams.get('auth');
  if (!callsign || !authKey) {
    ws.close();
    return;
  }
  const socket = connectDapnet({ host, port, callsign, authKey, onMessage: m => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  }, onError: err => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ error: err.message }));
  }});
  ws.on('close', () => socket.end());
});

console.log(`DAPNET WebSocket server running on port ${port}`);

