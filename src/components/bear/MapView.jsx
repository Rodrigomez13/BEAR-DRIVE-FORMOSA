import React, { useEffect, useRef, useState } from "react";
import { APILoader, Map, useMap } from "@vis.gl/react-google-maps";
import { getMapsApiKey } from "@/lib/mapsConfig";

const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0d111c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d111c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a8294" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#c9a44e" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#8a92a6" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6a7080" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "simplified" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1f30" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#252b3f" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#9aa0b0" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#7d8294" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#6a6f80" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#161b2a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#070a12" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a4a5a" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0a0e1a" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#10141f" }] },
];

function originIcon(g) {
  return { path: g.SymbolPath.CIRCLE, scale: 11, fillColor: "#181E2F", fillOpacity: 1, strokeColor: "#E9B74E", strokeWeight: 3 };
}
function destinationIcon(g) {
  return { path: g.SymbolPath.CIRCLE, scale: 11, fillColor: "#E9B74E", fillOpacity: 1, strokeColor: "#181E2F", strokeWeight: 3 };
}
function carIcon(g) {
  return {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    scale: 1.6, fillColor: "#E9B74E", fillOpacity: 1, strokeColor: "#181E2F", strokeWeight: 1.5,
    anchor: new g.Point(12, 22),
  };
}

function MapContent({ origin, destination, driverPos, path, onMapClick, recenter, interactive }) {
  const map = useMap();
  const markersRef = useRef({});
  const polylineRef = useRef(null);
  const dirRendererRef = useRef(null);
  const dirServiceRef = useRef(null);

  // Init overlays once the map is ready
  useEffect(() => {
    if (!map) return;
    const g = window.google.maps;
    map.setOptions({ styles: DARK_MAP_STYLES, backgroundColor: "#0a0e1a" });
    markersRef.current.origin = new g.Marker({ map, icon: originIcon(g), visible: false });
    markersRef.current.destination = new g.Marker({ map, icon: destinationIcon(g), visible: false });
    markersRef.current.driver = new g.Marker({ map, icon: carIcon(g), visible: false });
    polylineRef.current = new g.Polyline({ map, path: [], strokeColor: "#E9B74E", strokeWeight: 4, strokeOpacity: 0.85, visible: false });
    dirRendererRef.current = new g.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: "#E9B74E", strokeWeight: 4, strokeOpacity: 0.9 } });
    dirRendererRef.current.setMap(map);
    dirServiceRef.current = new g.DirectionsService();
    return () => {
      Object.values(markersRef.current).forEach((m) => m && m.setMap(null));
      if (polylineRef.current) polylineRef.current.setMap(null);
      if (dirRendererRef.current) dirRendererRef.current.setMap(null);
    };
  }, [map]);

  // Update markers
  useEffect(() => {
    if (!map) return;
    const m = markersRef.current;
    if (origin) { m.origin.setPosition(origin); m.origin.setVisible(true); } else if (m.origin) m.origin.setVisible(false);
    if (destination) { m.destination.setPosition(destination); m.destination.setVisible(true); } else if (m.destination) m.destination.setVisible(false);
    if (driverPos) { m.driver.setPosition(driverPos); m.driver.setVisible(true); } else if (m.driver) m.driver.setVisible(false);
  }, [origin, destination, driverPos, map]);

  // Route: real Google Directions, or provided path, or fallback straight line
  useEffect(() => {
    if (!map || !dirServiceRef.current) return;
    const g = window.google.maps;
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
        (res, status) => {
          if (status === "OK" && res) {
            dirRendererRef.current.setDirections(res);
          } else {
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
  }, [origin, destination, path, map]);

  // Recenter
  useEffect(() => {
    if (!map || !recenter) return;
    map.panTo(recenter);
  }, [recenter, map]);

  // Click handler
  useEffect(() => {
    if (!map || !interactive || !onMapClick) return;
    const g = window.google.maps;
    const handler = (e) => onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    const listener = g.event.addListener(map, "click", handler);
    return () => g.event.removeListener(listener);
  }, [map, onMapClick, interactive]);

  return null;
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
  const [apiKey, setApiKey] = useState(null);

  useEffect(() => {
    getMapsApiKey().then(setApiKey);
  }, []);

  if (!apiKey) {
    return (
      <div className={`relative w-full h-full bg-[#0a0e1a] flex items-center justify-center ${className}`}>
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      <APILoader apiKey={apiKey} libraries={["places"]} language="es" region="AR">
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling={interactive ? "auto" : "none"}
          disableDefaultUI
          clickableIcons={false}
          backgroundColor="#0a0e1a"
          style={{ width: "100%", height: "100%", background: "#0a0e1a" }}
        >
          <MapContent
            origin={origin}
            destination={destination}
            driverPos={driverPos}
            path={path}
            onMapClick={onMapClick}
            recenter={recenter}
            interactive={interactive}
          />
        </Map>
      </APILoader>
    </div>
  );
}