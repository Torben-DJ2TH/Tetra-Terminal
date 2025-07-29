import { print } from './utils.js';
import { addMarker } from './markersDb.js';

// Proxy to bypass CORS restrictions of hamnetdb.net
const PROXY = 'https://r.jina.ai/https://';

const HAMNET_SITES = [
  'db0csh',
  'db0dtm',
  'db0hei',
  'db0mue',
  'db0oha',
  'db0pra',
  'db0vc',
  'db0vel',
  'db0xh',
  'db0xn',
  'db0zod',
  'dm0fl',
  'dm0hro',
  'dm0kil',
  'dm0sl',
  'do0atr'
];

function extractCoords(html) {
  let m = html.match(/ma_lat=([0-9.]+)&ma_lon=([0-9.]+)/i);
  if (m) {
    return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  }
  m = html.match(/Coordinates:\s*([0-9.]+),\s*([0-9.]+)/i);
  if (m) {
    return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  }
  return null;
}

async function fetchSite(site) {
  try {
    const resp = await fetch(`${PROXY}hamnetdb.net/?q=${site}`);
    if (!resp.ok) return null;
    const text = await resp.text();
    const coords = extractCoords(text);
    if (!coords) return null;
    return { ...coords, callsign: site };
  } catch {
    return null;
  }
}

export async function fetchHamnetSites() {
  const out = [];
  for (const s of HAMNET_SITES) {
    const entry = await fetchSite(s);
    if (entry) out.push(entry);
  }
  return out;
}

export async function importHamnetMarkers() {
  print('🌐 Lade HamnetDB Marker …');
  const markers = await fetchHamnetSites();
  for (const m of markers) {
    await addMarker({
      lat: m.lat,
      lon: m.lon,
      description: `<a href="https://hamnetdb.net/?q=${encodeURIComponent(m.callsign)}" target="_blank">${m.callsign}</a>`
    });
  }
  print(`✅ ${markers.length} HamnetDB Marker importiert`);
}
