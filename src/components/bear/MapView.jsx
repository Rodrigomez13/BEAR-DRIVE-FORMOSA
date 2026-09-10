import React, { useEffect, useRef, useState } from "react";
import { loadMapsSDK } from "@/lib/mapsConfig";
import { MapPin } from "lucide-react";

const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0e1320" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e1320" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b93a8" }] },
  { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#c9a44e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#e0b85e" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#8a92a6" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#9aa2b5" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { featureType: "poi.business", elementType: "labels.text.fill", stylers: [{ color: "#b8a46e" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#101820" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6a8a6a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1c2236" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8b93a8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a3148" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#aab2c8" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#202840" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#181e30" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#7a8294" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#161b2a" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#6a7080" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#b8a46e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1018" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5a6a" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0b0f1c" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#121828" }] },
];

function originIcon(g) {
  return { path: g.SymbolPath.CIRCLE, scale: 11, fillColor: "#181E2F", fillOpacity: 1, strokeColor: "#E9B74E", strokeWeight: 3, labelOrigin: new g.Point(0, -16) };
}
function destinationIcon(g) {
  return { path: g.SymbolPath.CIRCLE, scale: 11, fillColor: "#E9B74E", fillOpacity: 1, strokeColor: "#181E2F", strokeWeight: 3, labelOrigin: new g.Point(0, -16) };
}
function carIcon(g) {
  return {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    scale: 1.6, fillColor: "#E9B74E", fillOpacity: 1, strokeColor: "#181E2F", strokeWeight: 1.5,
    anchor: new g.Point(12, 22),
  };
}

export default function MapView({
  center = { lat: -26.1849, lng: -58.1731 },
  zoom = 13,
  origin,
  destination,
  driverPos,
  path,
  onMapClick,
  className = "",
  recenter,
  interactive = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);
  const dirRendererRef = useRef(null);
  const dirServiceRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  // Initialize map
  useEffect(() => {
    let cancelled = false;
    loadMapsSDK()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        const map = new g.maps.Map(containerRef.current, {
          center,
          zoom,
          styles: DARK_MAP_STYLES,
          backgroundColor: "#0e1320",
          gestureHandling: interactive ? "auto" : "none",
          disableDefaultUI: true,
          clickableIcons: false,
        });
        mapRef.current = map;
        markersRef.current.origin = new g.maps.Marker({ map, icon: originIcon(g), label: { text: "Origen", color: "#E9B74E", fontSize: "11px", fontWeight: "bold" }, visible: false });
        markersRef.current.destination = new g.maps.Marker({ map, icon: destinationIcon(g), label: { text: "Destino", color: "#E9B74E", fontSize: "11px", fontWeight: "bold" }, visible: false });
        markersRef.current.driver = new g.maps.Marker({ map, icon: carIcon(g), visible: false });
        polylineRef.current = new g.maps.Polyline({ map, path: [], strokeColor: "#E9B74E", strokeWeight: 4, strokeOpacity: 0.85, visible: false });
        dirRendererRef.current = new g.maps.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: "#E9B74E", strokeWeight: 4, strokeOpacity: 0.9 } });
        dirRendererRef.current.setMap(map);
        dirServiceRef.current = new g.maps.DirectionsService();
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      Object.values(markersRef.current).forEach((m) => m && m.setMap(null));
      if (polylineRef.current) polylineRef.current.setMap(null);
      if (dirRendererRef.current) dirRendererRef.current.setMap(null);
      markersRef.current = {};
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers
  useEffect(() => {
    const m = markersRef.current;
    if (!m.origin) return;
    if (origin) { m.origin.setPosition(origin); m.origin.setVisible(true); } else m.origin.setVisible(false);
    if (destination) { m.destination.setPosition(destination); m.destination.setVisible(true); } else m.destination.setVisible(false);
    if (driverPos) { m.driver.setPosition(driverPos); m.driver.setVisible(true); } else m.driver.setVisible(false);
  }, [origin, destination, driverPos]);

  // Update route (polyline or directions)
  useEffect(() => {
    const g = window.google?.maps;
    if (!g || !mapRef.current || !dirServiceRef.current) return;
    if (path && path.length >= 2) {
      dirRendererRef.current.set("directions", null);
      polylineRef.current.setPath(path.map((p) => ({ lat: p.lat, lng: p.lng })));
      polylineRef.current.setVisible(true);
      return;
    }
    if (origin && destination) {
      polylineRef.current.setVisible(false);
      dirServiceRef.current.route(
        { origin, destination, travelMode: g.TravelMode.DRIVING },
        (res, stat) => {
          if (stat === "OK" && res) dirRendererRef.current.setDirections(res);
          else {
            dirRendererRef.current.set("directions", null);
            polylineRef.current.setPath([origin, destination]);
            polylineRef.current.setVisible(true);
          }
        }
      );
      return;
    }
    polylineRef.current.setVisible(false);
    dirRendererRef.current.set("directions", null);
  }, [origin, destination, path]);

  // Recenter
  useEffect(() => {
    if (mapRef.current && recenter) mapRef.current.panTo(recenter);
  }, [recenter]);

  // Click handler
  useEffect(() => {
    const g = window.google?.maps;
    if (!g || !mapRef.current || !interactive || !onMapClick) return;
    const handler = (e) => onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    const listener = g.event.addListener(mapRef.current, "click", handler);
    return () => g.event.removeListener(listener);
  }, [onMapClick, interactive]);

  if (status === "loading") {
    return (
      <div className={`relative w-full h-full bg-[#0e1320] flex items-center justify-center ${className}`}>
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`relative w-full h-full bg-[#0e1320] flex flex-col items-center justify-center gap-2 p-6 text-center ${className}`}>
        <MapPin className="w-8 h-8 text-accent/50" />
        <p className="text-sm text-white/60">No pudimos cargar el mapa. Verificá tu conexión e intentá nuevamente.</p>
        <button onClick={() => setStatus("loading")} className="text-xs text-accent underline mt-1">Reintentar</button>
      </div>
    );
  }

  return <div ref={containerRef} className={`w-full h-full ${className}`} style={{ background: "#0e1320" }} />;
}