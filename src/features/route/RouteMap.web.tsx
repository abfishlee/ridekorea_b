/// <reference lib="dom" />
/**
 * Web implementation of RouteMap. react-native-webview doesn't run on web,
 * so we inject the Naver Maps SDK into the page and render the map inline.
 * Metro picks this file on web; RouteMap.tsx (WebView) is used on native.
 *
 * The page origin on web is http://localhost:8081, so register that URL in the
 * NCP console (Web service URL) for the map to authenticate.
 */
import { useEffect, useRef } from "react";
import { NAVER_CLIENT_ID, naverScriptSrc, SPOT_EMOJI, LngLat, SpotMarker } from "../../lib/naverMap";

export function RouteMap({
  coords,
  spots = [],
  height = 220,
}: {
  coords: LngLat[];
  spots?: SpotMarker[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!NAVER_CLIENT_ID || !ref.current) return;
    const el = ref.current;

    const draw = () => {
      const n = (window as unknown as { naver?: any }).naver;
      if (!n?.maps) return;
      const map = new n.maps.Map(el, {
        zoom: 7,
        center: new n.maps.LatLng(36.5, 127.8),
        mapDataControl: false,
        scaleControl: false,
        zoomControl: false,
      });
      let bounds: any = null;
      const extend = (ll: any) => {
        if (!bounds) bounds = new n.maps.LatLngBounds(ll, ll);
        else bounds.extend(ll);
      };
      if (coords.length) {
        const path = coords.map((c) => new n.maps.LatLng(c[1], c[0]));
        new n.maps.Polyline({ map, path, strokeColor: "#0EA5E9", strokeOpacity: 0.95, strokeWeight: 5 });
        path.forEach(extend);
      }
      spots.forEach((sp) => {
        const ll = new n.maps.LatLng(sp.lat, sp.lng);
        new n.maps.Marker({
          map,
          position: ll,
          title: sp.title ?? "",
          icon: {
            content: `<div style="font-size:22px;line-height:1;transform:translate(-50%,-100%);text-shadow:0 1px 2px rgba(0,0,0,.35)">${SPOT_EMOJI[sp.type] ?? "📍"}</div>`,
            anchor: new n.maps.Point(0, 0),
          },
        });
        extend(ll);
      });
      if (!spots.length && coords.length) {
        const p = coords.map((c) => new n.maps.LatLng(c[1], c[0]));
        new n.maps.Marker({ map, position: p[0] });
        new n.maps.Marker({ map, position: p[p.length - 1] });
      }
      if (bounds) map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    };

    if ((window as unknown as { naver?: any }).naver?.maps) {
      draw();
      return;
    }
    let s = document.getElementById("naver-maps-sdk") as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = "naver-maps-sdk";
      s.src = naverScriptSrc();
      document.head.appendChild(s);
    }
    s.addEventListener("load", draw);
    return () => s?.removeEventListener("load", draw);
  }, [coords, spots]);

  const box = {
    height,
    borderRadius: 16,
    overflow: "hidden" as const,
    border: "1px solid #E2E8F0",
    background: "#E2E8F0",
  };

  if (!NAVER_CLIENT_ID) {
    return (
      <div
        style={{
          ...box,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontSize: 13,
        }}
      >
        Map preview needs a Naver Map client ID
      </div>
    );
  }

  return (
    <div style={box}>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default RouteMap;
