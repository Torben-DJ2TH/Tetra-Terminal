export let map;
export let previewMap;
export let gpsHouseMarker = null;
export let gpsHouseMarkerPreview = null;
export const gpsPositions = {};
export let houseLabel = '🏠 DJ 2 TH (2631997)';
export let keepMarkers = false;
export const gpsMarkers = {};
export const gpsMarkersPreview = {};

export function setHouseLabel(label) {
  houseLabel = label || houseLabel;
  if (gpsHouseMarker) gpsHouseMarker.bindPopup(houseLabel);
  if (gpsHouseMarkerPreview) gpsHouseMarkerPreview.bindPopup(houseLabel);
}

export function setKeepMarkers(val) {
  keepMarkers = !!val;
}

const houseIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/25/25694.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const iconMap = {
  man: L.icon({ iconUrl: 'markers/man.png', iconSize: [22, 32], iconAnchor: [11, 32], popupAnchor: [0, -32] }),
  car: L.icon({ iconUrl: 'markers/car.png', iconSize: [22, 32], iconAnchor: [11, 32], popupAnchor: [0, -32] }),
  walkie: L.icon({ iconUrl: 'markers/walkie-talkie.png', iconSize: [22, 32], iconAnchor: [11, 32], popupAnchor: [0, -32] }),
  pin: L.icon({ iconUrl: 'markers/pin.png', iconSize: [22, 32], iconAnchor: [11, 32], popupAnchor: [0, -32] }),
  people: L.icon({ iconUrl: 'markers/people.png', iconSize: [22, 32], iconAnchor: [11, 32], popupAnchor: [0, -32] }),
  telecom: L.icon({ iconUrl: 'markers/telecommunication.png', iconSize: [22, 32], iconAnchor: [11, 32], popupAnchor: [0, -32] })
};

export const issiIconTypes = {};

export function setIssiIconType(issi, type) {
  issiIconTypes[issi] = type in iconMap ? type : 'man';
}

function getIconForIssi(issi) {
  const type = issiIconTypes[issi] || 'man';
  return iconMap[type] || iconMap.man;
}

const pinIcon = L.icon({
  iconUrl: 'markers/pin.png',
  iconSize: [22, 32],
  iconAnchor: [11, 32],
  popupAnchor: [0, -32]
});

export function initMap() {
  map = L.map("map").setView([51, 10], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  const prevEl = document.getElementById("mapPreview");
  if (prevEl) {
    previewMap = L.map(prevEl, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false
    }).setView([51, 10], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(previewMap);
  }
}

export function updateHousePosition(lat, lon) {
  if (gpsHouseMarker) {
    gpsHouseMarker.setLatLng([lat, lon]);
  } else {
    gpsHouseMarker = L.marker([lat, lon], { icon: houseIcon })
      .addTo(map)
      .bindPopup(houseLabel);
  }
  gpsHouseMarker.openPopup();
  map.setView([lat, lon], 14);

  if (previewMap) {
    if (gpsHouseMarkerPreview) {
      gpsHouseMarkerPreview.setLatLng([lat, lon]);
    } else {
      gpsHouseMarkerPreview = L.marker([lat, lon], { icon: houseIcon })
        .addTo(previewMap)
        .bindPopup(houseLabel);
    }
    gpsHouseMarkerPreview.openPopup();
    previewMap.setView([lat, lon], 14);
  }
}

export function updateMap() {
  const configs = [
    [map, gpsMarkers],
    [previewMap, gpsMarkersPreview]
  ];
  configs.forEach(([m, markerSet]) => {
    if (!m) return;
    if (!keepMarkers) {
      Object.keys(markerSet).forEach(id => {
        m.removeLayer(markerSet[id]);
        delete markerSet[id];
      });
    }
    Object.entries(gpsPositions).forEach(([issi, { lat, lon }]) => {
      const icon = getIconForIssi(issi);
      const marker = markerSet[issi];
      if (marker) {
        marker.setLatLng([lat, lon]).setIcon(icon).openPopup();
      } else {
        markerSet[issi] = L.marker([lat, lon], { icon })
          .addTo(m)
          .bindPopup(`📡 ISSI: ${issi}<br>Lat: ${lat}<br>Lon: ${lon}`)
          .openPopup();
      }
    });
  });
}

export function addRemoteMarkers(list) {
  if (!map || !Array.isArray(list)) return;
  list.forEach(item => {
    const loc = item.location;
    if (!Array.isArray(loc) || loc.length !== 2) return;
    const iconUrl = item.state === 'online' ? 'marker_online.png' : 'marker_offline.png';
    const icon = L.icon({ iconUrl, iconSize: [22, 32], iconAnchor: [11, 32], popupAnchor: [0, -32] });
    const popup = `<h6>${item.callsign || ''}</h6><table>` +
      `<tr><td><b>Sysop</b></td><td>${item.sysop || ''}</td></tr>` +
      `<tr><td><b>City</b></td><td>${item.city || ''}</td></tr>` +
      `<tr><td><b>Location Area</b></td><td>${item.area || ''}</td></tr>` +
      `<tr><td><b>Duplex Spacing</b></td><td>${item.spacing || ''}</td></tr>` +
      `<tr><td><b>Carrier</b></td><td>${item.carrier || ''}</td></tr>` +
      `<tr><td><b>State</b></td><td>${item.state || ''}</td></tr>` +
      `</table>`;
    L.marker(loc, { icon }).addTo(map).bindPopup(popup);
  });
}

export const staticMarkers = {};

export function addStaticMarker(marker) {
  if (!map) return;
  const { id, lat, lon, description } = marker;
  const isHamnet = description && description.includes('hamnetdb.net');
  const icon = isHamnet ? iconMap.telecom : pinIcon;
  const m = L.marker([lat, lon], { icon })
    .addTo(map)
    .bindPopup(description || '');
  staticMarkers[id] = m;
}

export function loadMarkers(list) {
  if (!map) return;
  const ids = list.map(m => m.id);
  Object.keys(staticMarkers).forEach(id => {
    if (!ids.includes(Number(id))) {
      map.removeLayer(staticMarkers[id]);
      delete staticMarkers[id];
    }
  });
  list.forEach(marker => {
    if (staticMarkers[marker.id]) {
      staticMarkers[marker.id]
        .setLatLng([marker.lat, marker.lon])
        .bindPopup(marker.description || '');
    } else {
      addStaticMarker(marker);
    }
  });
}

export function updateMarkerPopup(id, description) {
  const m = staticMarkers[id];
  if (m) m.bindPopup(description || '');
}

export function removeMarker(id) {
  const m = staticMarkers[id];
  if (m) {
    map.removeLayer(m);
    delete staticMarkers[id];
  }
}

export const trackPoints = {};
export const trackLines = {};
let currentTrackId = null;

export function setCurrentTrack(id) {
  const num = parseInt(id, 10);
  currentTrackId = isNaN(num) ? null : num;
}

export function addTrackPointForCurrent(lat, lon) {
  if (currentTrackId == null) return;
  addTrackPoint(currentTrackId, lat, lon);
}

export function addTrackPoint(id, lat, lon) {
  if (!map) return;
  if (!trackPoints[id]) trackPoints[id] = [];
  trackPoints[id].push([lat, lon]);
  if (trackLines[id]) {
    trackLines[id].setLatLngs(trackPoints[id]);
  } else {
    trackLines[id] = L.polyline(trackPoints[id], { color: 'red' }).addTo(map);
  }
  notifyTrackChange(id);
}

export function clearTrack(id) {
  trackPoints[id] = [];
  if (trackLines[id]) {
    map.removeLayer(trackLines[id]);
    delete trackLines[id];
  }
  notifyTrackChange(id);
}

export function loadTrackLines(list) {
  if (!map || !Array.isArray(list)) return;
  list.forEach(t => {
    trackPoints[t.id] = t.points || [];
    if (trackPoints[t.id].length) {
      trackLines[t.id] = L.polyline(trackPoints[t.id], { color: 'red' }).addTo(map);
    }
  });
}

export function getTracksData() {
  return Object.entries(trackPoints).map(([id, points]) => ({ id: Number(id), points }));
}

function notifyTrackChange(id) {
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('trackChange', {
      detail: { id, points: trackPoints[id] || [] }
    }));
  }
}
