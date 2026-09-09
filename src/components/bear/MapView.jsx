import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon paths for leaflet in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const goldIcon = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#E9B74E;border:3px solid #181E2F;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const navyIcon = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#181E2F;border:3px solid #E9B74E;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const carIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#E9B74E;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);font-size:14px">🚗</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || map.getZoom());
  }, [center, map]);
  return null;
}

function ClickHandler({ onClick }) {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return;
    const handler = (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on("click", handler);
    return () => map.off("click", handler);
  }, [map, onClick]);
  return null;
}

export default function MapView({
  center = [-26.1849, -58.1731],
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

  const polylinePositions = path && path.length >= 2 ? path.map((p) => [p.lat, p.lng]) : (origin && destination ? [[origin.lat, origin.lng], [destination.lat, destination.lng]] : []);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={false}
        style={{ width: "100%", height: "100%", background: "#0a0e1a" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        {origin && <Marker position={[origin.lat, origin.lng]} icon={navyIcon} />}
        {destination && <Marker position={[destination.lat, destination.lng]} icon={goldIcon} />}
        {driverPos && <Marker position={[driverPos.lat, driverPos.lng]} icon={carIcon} />}
        {polylinePositions.length >= 2 && (
          <Polyline positions={polylinePositions} pathOptions={{ color: "#E9B74E", weight: 4, opacity: 0.8, dashArray: origin && destination && !path ? "8 8" : null }} />
        )}
        <Recenter center={recenter} zoom={zoom} />
        <ClickHandler onClick={interactive ? onMapClick : null} />
      </MapContainer>
    </div>
  );
}