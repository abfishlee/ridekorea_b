/**
 * Naver map adapter (cost-minimized per vision_doc/8).
 * Detail/Explore use the Web Dynamic Map (free tier); we draw the stored route
 * polyline + spot markers ourselves — NO paid Geocoding/Directions calls.
 *
 * Auth param note: new NCP "Maps" keys use `ncpKeyId`; older AI·NAVER keys use
 * `ncpClientId`. If the map shows an auth error, switch AUTH_PARAM below.
 */
export const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";
const AUTH_PARAM = "ncpKeyId"; // ← change to "ncpClientId" if using a legacy key

export type LngLat = [number, number];
export type SpotMarker = { lng: number; lat: number; type: string; title?: string | null };

/** Emoji shown for each spot type on the map (kept in sync with the timeline). */
export const SPOT_EMOJI: Record<string, string> = {
  START: "🚩",
  FINISH: "🏁",
  REPAIR: "🔧",
  FOOD: "🍜",
  LODGING: "🛏️",
  DANGER: "⚠️",
  SCENERY: "📷",
  GENERAL: "📍",
};

export function naverScriptSrc(): string {
  return `https://openapi.map.naver.com/openapi/v3/maps.js?${AUTH_PARAM}=${NAVER_CLIENT_ID}`;
}

/** HTML page for a WebView that draws a route polyline + spot markers. */
export function buildRouteMapHtml(
  coords: LngLat[],
  opts?: { strokeColor?: string; spots?: SpotMarker[] },
): string {
  const stroke = opts?.strokeColor ?? "#0EA5E9";
  const coordsJson = JSON.stringify(coords ?? []);
  const spotsJson = JSON.stringify(opts?.spots ?? []);
  const emojiJson = JSON.stringify(SPOT_EMOJI);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#E2E8F0}</style>
<script src="${naverScriptSrc()}"></script>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  var raw = ${coordsJson};
  var spots = ${spotsJson};
  var EMOJI = ${emojiJson};
  var tries = 0;
  function draw(){
    if (!window.naver || !naver.maps) { if (tries++ < 50) return setTimeout(draw, 100); return; }
    var map = new naver.maps.Map('map', {
      zoom: 7, center: new naver.maps.LatLng(36.5, 127.8),
      mapDataControl: false, scaleControl: false, zoomControl: false
    });
    var bounds = null;
    function extend(ll){ if (!bounds) bounds = new naver.maps.LatLngBounds(ll, ll); else bounds.extend(ll); }
    if (raw.length) {
      var path = raw.map(function(c){ return new naver.maps.LatLng(c[1], c[0]); });
      new naver.maps.Polyline({ map: map, path: path, strokeColor: '${stroke}', strokeOpacity: 0.95, strokeWeight: 5 });
      path.forEach(extend);
    }
    spots.forEach(function(sp){
      var ll = new naver.maps.LatLng(sp.lat, sp.lng);
      new naver.maps.Marker({ map: map, position: ll, title: sp.title || '',
        icon: { content: '<div style="font-size:22px;line-height:1;transform:translate(-50%,-100%);text-shadow:0 1px 2px rgba(0,0,0,.35)">' + (EMOJI[sp.type] || '📍') + '</div>', anchor: new naver.maps.Point(0,0) } });
      extend(ll);
    });
    if (!spots.length && raw.length) {
      var p = raw.map(function(c){ return new naver.maps.LatLng(c[1], c[0]); });
      new naver.maps.Marker({ map: map, position: p[0] });
      new naver.maps.Marker({ map: map, position: p[p.length-1] });
    }
    if (bounds) map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }
  draw();
})();
</script>
</body>
</html>`;
}

/**
 * Live-ride WebView page. Loads the Naver map ONCE, then accepts incremental
 * updates via `window.__rideUpdate({track, deviated, pos})` — no page/map reload,
 * so it does NOT incur a new map-load charge on every GPS fix.
 *   blue  = on-route track, pink = deviated segments, dot = current position.
 */
export function buildRideMapHtml(planned: LngLat[] = []): string {
  const plannedJson = JSON.stringify(planned ?? []);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#E2E8F0}</style>
<script src="${naverScriptSrc()}"></script>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  var planned = ${plannedJson};
  var map, blue, pinks = [], posMarker, ready = false, queued = null, tries = 0;
  function toPath(arr){ return arr.map(function(c){ return new naver.maps.LatLng(c[1], c[0]); }); }
  function init(){
    if (!window.naver || !naver.maps) { if (tries++ < 50) return setTimeout(init, 100); return; }
    map = new naver.maps.Map('map', {
      zoom: 15, center: new naver.maps.LatLng(36.5, 127.8),
      mapDataControl: false, scaleControl: false, zoomControl: false, logoControl: false
    });
    if (planned.length > 1) {
      new naver.maps.Polyline({ map: map, path: toPath(planned),
        strokeColor: '#94A3B8', strokeOpacity: 0.8, strokeWeight: 4, strokeStyle: 'shortdash' });
    }
    blue = new naver.maps.Polyline({ map: map, path: [], strokeColor: '#0EA5E9', strokeOpacity: 0.95, strokeWeight: 6 });
    ready = true;
    if (queued) { window.__rideUpdate(queued); queued = null; }
  }
  window.__rideUpdate = function(payload){
    var data = (typeof payload === 'string') ? JSON.parse(payload) : payload;
    if (!ready) { queued = data; return; }
    if (data.track) blue.setPath(toPath(data.track));
    pinks.forEach(function(p){ p.setMap(null); });
    pinks = [];
    (data.deviated || []).forEach(function(seg){
      pinks.push(new naver.maps.Polyline({ map: map, path: toPath(seg),
        strokeColor: '#EC4899', strokeOpacity: 0.95, strokeWeight: 6 }));
    });
    if (data.pos) {
      var ll = new naver.maps.LatLng(data.pos[1], data.pos[0]);
      if (!posMarker) {
        posMarker = new naver.maps.Marker({ map: map, position: ll,
          icon: { content: '<div style="width:18px;height:18px;border-radius:50%;background:#1E3A8A;border:3px solid #fff;box-shadow:0 0 0 2px rgba(30,58,138,.4)"></div>', anchor: new naver.maps.Point(9,9) } });
      } else { posMarker.setPosition(ll); }
      map.panTo(ll);
    }
  };
  init();
})();
</script>
</body>
</html>`;
}
