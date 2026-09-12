import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadMapsSDK, getAuthFailure, resetSdkPromise } from "@/lib/mapsConfig";
import { AlertTriangle, Navigation } from "lucide-react";

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
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: 11,
    fillColor: "#181E2F",
    fillOpacity: 1,
    strokeColor: "#E9B74E",
    strokeWeight: 3,
    labelOrigin: new g.maps.Point(0, -16),
  };
}

function destinationIcon(g) {
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: 11,
    fillColor: "#E9B74E",
    fillOpacity: 1,
    strokeColor: "#181E2F",
    strokeWeight: 3,
    labelOrigin: new g.maps.Point(0, -16),
  };
}

function carIcon(g) {
  return {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
    scale: 1.6,
    fillColor: "#E9B74E",
    fillOpacity: 1,
    strokeColor: "#181E2F",
    strokeWeight: 1.5,
    anchor: new g.maps.Point(12, 22),
  };
}

function stripHtml(value = "") {
  if (!value) return "";
  const node = document.createElement("div");
  node.innerHTML = value;
  return node.textContent || node.innerText || "";
}

function haversineMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function offsetCenter(pos, tilt, heading) {
  if (!tilt) return pos;
  const offsetDist = 0.004;
  const headingRad = ((heading || 0) * Math.PI) / 180;
  return {
    lat: pos.lat + offsetDist * Math.cos(headingRad),
    lng: pos.lng + offsetDist * Math.sin(headingRad),
  };
}

export default function MapView({
  center = { lat: -26.1849, lng: -58.1731 },
  zoom = 15,
  origin,
  destination,
  originLabel = "Origen",
  destinationLabel = "Destino",
  showOriginMarker = true,
  showDestinationMarker = true,
  driverPos,
  userPos,
  path,
  onMapClick,
  className = "",
  recenter,
  interactive = true,
  followDriver = false,
  navigationZoom = 17,
  onRouteInfo,
  tilt = 0,
  heading = 0,
  markerAnimationDuration = 900,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);
  const dirRendererRef = useRef(null);
  const dirServiceRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const mapListenersRef = useRef([]);
  const followDriverRef = useRef(followDriver);
  const onRouteInfoRef = useRef(onRouteInfo);
  const tiltRef = useRef(tilt);
  const headingRef = useRef(heading);
  const routeInfoRef = useRef(null);
  const routeStepsRef = useRef([]);
  const currentStepRef = useRef(0);
  const routePolylineRef = useRef([]);
  const lastRecalcRef = useRef(0);
  const recalculatingRef = useRef(false);
  const [deviatedOrigin, setDeviatedOrigin] = useState(null);

  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [debugInfo, setDebugInfo] = useState("Iniciando...");
  const [retryKey, setRetryKey] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [followSuspended, setFollowSuspended] = useState(false);

  const pathKey = useMemo(
    () => (path || []).map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join("|"),
    [path]
  );

  useEffect(() => {
    followDriverRef.current = followDriver;
    if (!followDriver) setFollowSuspended(false);
  }, [followDriver]);

  useEffect(() => {
    onRouteInfoRef.current = onRouteInfo;
  }, [onRouteInfo]);

  useEffect(() => {
    tiltRef.current = tilt;
    headingRef.current = heading;
  }, [tilt, heading]);

  // Initialize map.
  useEffect(() => {
    let cancelled = false;
    let dimObserver = null;
    setDebugInfo("Solicitando SDK de Google Maps...");

    const createMapInstance = (g) => {
      if (cancelled || !containerRef.current) return;
      setDebugInfo("SDK cargado, creando instancia del mapa...");

      const map = new g.maps.Map(containerRef.current, {
        center,
        zoom,
        styles: DARK_MAP_STYLES,
        backgroundColor: "#0e1320",
        gestureHandling: interactive ? "greedy" : "none",
        disableDefaultUI: true,
        clickableIcons: false,
      });

      mapRef.current = map;
      markersRef.current.origin = new g.maps.Marker({
        map,
        icon: originIcon(g),
        label: { text: originLabel, color: "#E9B74E", fontSize: "11px", fontWeight: "bold" },
        visible: false,
      });
      markersRef.current.destination = new g.maps.Marker({
        map,
        icon: destinationIcon(g),
        label: { text: destinationLabel, color: "#E9B74E", fontSize: "11px", fontWeight: "bold" },
        visible: false,
      });
      markersRef.current.driver = new g.maps.Marker({ map, icon: carIcon(g), visible: false, zIndex: 1000 });
      markersRef.current.user = new g.maps.Marker({
        map,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        visible: false,
        clickable: false,
        zIndex: 999,
      });
      polylineRef.current = new g.maps.Polyline({
        map,
        path: [],
        strokeColor: "#E9B74E",
        strokeWeight: 4,
        strokeOpacity: 0.85,
        visible: false,
      });
      dirRendererRef.current = new g.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: followDriverRef.current,
        polylineOptions: { strokeColor: "#E9B74E", strokeWeight: 5, strokeOpacity: 0.95 },
      });
      dirRendererRef.current.setMap(map);
      dirServiceRef.current = new g.maps.DirectionsService();

      mapListenersRef.current.push(
        g.maps.event.addListener(map, "dragstart", () => {
          if (followDriverRef.current) setFollowSuspended(true);
        })
      );

      resizeObserverRef.current = new ResizeObserver(() => {
        if (mapRef.current && window.google?.maps) {
          window.google.maps.event.trigger(mapRef.current, "resize");
        }
      });
      resizeObserverRef.current.observe(containerRef.current);

      const triggerResize = () => {
        if (mapRef.current && window.google?.maps) {
          window.google.maps.event.trigger(mapRef.current, "resize");
          mapRef.current.setCenter(center);
        }
      };
      requestAnimationFrame(triggerResize);
      setTimeout(triggerResize, 300);

      setDebugInfo("Mapa listo");
      setStatus("ready");
    };

    const initWhenReady = (g) => {
      if (cancelled || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        createMapInstance(g);
        return;
      }

      setDebugInfo("Esperando dimensiones del contenedor...");
      dimObserver = new ResizeObserver(() => {
        if (cancelled || !containerRef.current) return;
        const rectNow = containerRef.current.getBoundingClientRect();
        if (rectNow.width > 0 && rectNow.height > 0) {
          dimObserver.disconnect();
          dimObserver = null;
          createMapInstance(g);
        }
      });
      dimObserver.observe(containerRef.current);
    };

    loadMapsSDK()
      .then((g) => {
        if (!cancelled) initWhenReady(g);
      })
      .catch((err) => {
        if (cancelled) return;
        const authFail = getAuthFailure();
        setErrorMsg(authFail || err?.message || "Error desconocido");
        setStatus("error");
      });

    return () => {
      cancelled = true;
      if (dimObserver) dimObserver.disconnect();
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      mapListenersRef.current.forEach((listener) => listener?.remove?.());
      mapListenersRef.current = [];
      Object.values(markersRef.current).forEach((marker) => marker?.setMap(null));
      if (polylineRef.current) polylineRef.current.setMap(null);
      if (dirRendererRef.current) dirRendererRef.current.setMap(null);
      markersRef.current = {};
      routeInfoRef.current = null;
      routeStepsRef.current = [];
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // Update markers.
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers.origin || status !== "ready") return;

    markers.origin.setLabel({ text: originLabel, color: "#E9B74E", fontSize: "11px", fontWeight: "bold" });
    markers.destination.setLabel({ text: destinationLabel, color: "#E9B74E", fontSize: "11px", fontWeight: "bold" });

    if (origin && showOriginMarker) {
      markers.origin.setPosition(origin);
      markers.origin.setVisible(true);
    } else {
      markers.origin.setVisible(false);
    }

    if (destination && showDestinationMarker) {
      markers.destination.setPosition(destination);
      markers.destination.setVisible(true);
    } else {
      markers.destination.setVisible(false);
    }

    if (userPos && markers.user) {
      markers.user.setPosition(userPos);
      markers.user.setVisible(true);
    } else if (markers.user) {
      markers.user.setVisible(false);
    }
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, originLabel, destinationLabel, showOriginMarker, showDestinationMarker, userPos?.lat, userPos?.lng, status]);

  // Smooth driver marker, follow camera and advance maneuver guidance without new route API calls.
  useEffect(() => {
    const marker = markersRef.current.driver;
    if (!marker || status !== "ready") return;
    if (!driverPos) {
      marker.setVisible(false);
      return;
    }

    const startPos = marker.getPosition();
    if (!startPos || !marker.getVisible()) {
      marker.setPosition(driverPos);
      marker.setVisible(true);
    } else {
      const startLat = startPos.lat();
      const startLng = startPos.lng();
      const endLat = driverPos.lat;
      const endLng = driverPos.lng;
      const duration = markerAnimationDuration;
      const startTime = Date.now();
      let raf;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const easeT = 1 - Math.pow(1 - t, 3);
        marker.setPosition({
          lat: startLat + (endLat - startLat) * easeT,
          lng: startLng + (endLng - startLng) * easeT,
        });
        if (t < 1) raf = requestAnimationFrame(animate);
      };

      raf = requestAnimationFrame(animate);
      setTimeout(() => cancelAnimationFrame(raf), duration + 150);
    }

    if (followDriver && !followSuspended && mapRef.current) {
      mapRef.current.panTo(offsetCenter({ lat: driverPos.lat, lng: driverPos.lng }, tilt, heading));
      const currentZoom = mapRef.current.getZoom() || 0;
      if (currentZoom < navigationZoom - 1 || currentZoom > navigationZoom + 2) {
        mapRef.current.setZoom(navigationZoom);
      }
    }

    const routeInfo = routeInfoRef.current;
    const steps = routeStepsRef.current;
    if (routeInfo && steps.length > 0) {
      let stepIndex = Math.min(currentStepRef.current, steps.length - 1);
      let distanceToManeuver = haversineMeters(driverPos, steps[stepIndex].end);

      while (stepIndex < steps.length - 1 && distanceToManeuver < 35) {
        stepIndex += 1;
        distanceToManeuver = haversineMeters(driverPos, steps[stepIndex].end);
      }

      currentStepRef.current = stepIndex;
      onRouteInfoRef.current?.({
        ...routeInfo,
        currentStepIndex: stepIndex,
        nextInstruction: steps[stepIndex]?.instruction || "Seguí la ruta",
        nextManeuver: steps[stepIndex]?.maneuver || "",
        nextManeuverDistanceMeters: Math.round(distanceToManeuver),
        afterNextInstruction: steps[stepIndex + 1]?.instruction || "",
        afterNextManeuver: steps[stepIndex + 1]?.maneuver || "",
      });
    }

    // Event-driven route recalculation: only when the driver deviates >50m from
    // the route polyline (Gemini recommendation: no timer-based recalculation).
    if (followDriver && routePolylineRef.current.length > 2 && !recalculatingRef.current) {
      const minDist = routePolylineRef.current.reduce(
        (min, p) => Math.min(min, haversineMeters(driverPos, p)),
        Infinity
      );
      if (minDist > 50 && Date.now() - lastRecalcRef.current > 10000) {
        lastRecalcRef.current = Date.now();
        recalculatingRef.current = true;
        setDeviatedOrigin({ lat: driverPos.lat, lng: driverPos.lng });
      }
    }
  }, [driverPos?.lat, driverPos?.lng, driverPos?.heading, followDriver, followSuspended, navigationZoom, tilt, heading, status, markerAnimationDuration]);

  // Update route only when endpoints/path actually change. Driver GPS updates do not trigger route API calls.
  useEffect(() => {
    const g = window.google?.maps;
    if (!g || !mapRef.current || !dirServiceRef.current || status !== "ready") return;

    const effectiveOrigin = deviatedOrigin || origin;

    if (path && path.length >= 2) {
      dirRendererRef.current.set("directions", null);
      polylineRef.current.setPath(path.map((point) => ({ lat: point.lat, lng: point.lng })));
      polylineRef.current.setVisible(true);
      routeInfoRef.current = null;
      routeStepsRef.current = [];
      routePolylineRef.current = [];
      onRouteInfoRef.current?.(null);
      return;
    }

    if (effectiveOrigin && destination) {
      polylineRef.current.setVisible(false);
      dirRendererRef.current.setOptions({ preserveViewport: followDriverRef.current });
      dirServiceRef.current.route(
        { origin: effectiveOrigin, destination, travelMode: g.TravelMode.DRIVING },
        (result, routeStatus) => {
          if (routeStatus === "OK" && result) {
            dirRendererRef.current.setDirections(result);
            const leg = result.routes?.[0]?.legs?.[0];
            const steps = (leg?.steps || []).map((step) => ({
              instruction: stripHtml(step.instructions) || "Seguí la ruta",
              maneuver: step.maneuver || "",
              distanceMeters: step.distance?.value || 0,
              end: step.end_location
                ? { lat: step.end_location.lat(), lng: step.end_location.lng() }
                : destination,
            }));

            const overviewPolyline = result.routes?.[0]?.overview_polyline;
            if (overviewPolyline && g.geometry?.encoding) {
              routePolylineRef.current = g.geometry.encoding
                .decodePath(overviewPolyline)
                .map((p) => ({ lat: p.lat(), lng: p.lng() }));
            } else {
              routePolylineRef.current = steps.map((s) => s.end);
            }
            recalculatingRef.current = false;
            routeStepsRef.current = steps;
            currentStepRef.current = 0;
            routeInfoRef.current = {
              distanceMeters: leg?.distance?.value || null,
              distanceText: leg?.distance?.text || "",
              durationSeconds: leg?.duration?.value || null,
              durationText: leg?.duration?.text || "",
              nextInstruction: steps[0]?.instruction || "Seguí la ruta",
              nextManeuver: steps[0]?.maneuver || "",
              nextManeuverDistanceMeters: steps[0]?.distanceMeters || null,
              currentStepIndex: 0,
              afterNextInstruction: steps[1]?.instruction || "",
              afterNextManeuver: steps[1]?.maneuver || "",
            };
            onRouteInfoRef.current?.(routeInfoRef.current);

            if (followDriverRef.current && driverPos && mapRef.current) {
              mapRef.current.panTo(offsetCenter({ lat: driverPos.lat, lng: driverPos.lng }, tiltRef.current, headingRef.current));
              mapRef.current.setZoom(navigationZoom);
            }
          } else {
            recalculatingRef.current = false;
            dirRendererRef.current.set("directions", null);
            polylineRef.current.setPath([effectiveOrigin, destination]);
            polylineRef.current.setVisible(true);
            routeInfoRef.current = null;
            routeStepsRef.current = [];
            onRouteInfoRef.current?.(null);
          }
        }
      );
      return;
    }

    polylineRef.current.setVisible(false);
    dirRendererRef.current.set("directions", null);
    routeInfoRef.current = null;
    routeStepsRef.current = [];
    routePolylineRef.current = [];
    onRouteInfoRef.current?.(null);
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, deviatedOrigin?.lat, deviatedOrigin?.lng, pathKey, status, navigationZoom]);

  // Reset deviation tracking when endpoints change (new phase or new route).
  useEffect(() => {
    setDeviatedOrigin(null);
    recalculatingRef.current = false;
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Explicit recenter for non-navigation maps.
  useEffect(() => {
    if (mapRef.current && recenter && status === "ready" && !followDriver) {
      mapRef.current.panTo(recenter);
    }
  }, [recenter?.lat, recenter?.lng, status, followDriver]);

  // Detect gm_authFailure that fires after map load.
  useEffect(() => {
    if (status !== "ready") return;
    const check = setInterval(() => {
      const authFail = getAuthFailure();
      if (authFail) {
        setErrorMsg(authFail);
        setStatus("error");
      }
    }, 2000);
    return () => clearInterval(check);
  }, [status]);

  // Click handler.
  useEffect(() => {
    const g = window.google?.maps;
    if (!g || !mapRef.current || !interactive || !onMapClick || status !== "ready") return;
    const listener = g.event.addListener(mapRef.current, "click", (event) => {
      onMapClick({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    });
    return () => g.event.removeListener(listener);
  }, [onMapClick, interactive, status]);

  const resumeFollow = () => {
    setFollowSuspended(false);
    if (driverPos && mapRef.current) {
      mapRef.current.panTo(offsetCenter({ lat: driverPos.lat, lng: driverPos.lng }, tilt, heading));
      mapRef.current.setZoom(navigationZoom);
    }
  };

  return (
    <div className={className} style={{ background: "#0e1320" }}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{
          background: "#0e1320",
          transform: tilt > 0 ? `perspective(1200px) rotateX(${tilt}deg) rotateZ(${-heading}deg) scale(1.25)` : "none",
          transformOrigin: "center center",
          transition: "transform 0.4s ease-out",
          backfaceVisibility: "hidden",
        }}
      />

      {followDriver && followSuspended && status === "ready" && (
        <button
          type="button"
          onClick={resumeFollow}
          className="absolute right-3 top-[calc(env(safe-area-inset-top)+5rem)] z-20 flex items-center gap-2 rounded-full bg-[#181E2F]/95 px-3 py-2 text-xs font-semibold text-white shadow-lg border border-white/10 active:scale-95 transition"
          aria-label="Volver a seguir mi ubicación"
        >
          <Navigation className="w-4 h-4 text-accent" />
          Recentrar
        </button>
      )}

      {status === "loading" && (
        <div className="absolute inset-0 z-10 bg-[#0e1320] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
          <p className="text-xs text-white/50">{debugInfo}</p>
          <button
            onClick={() => {
              resetSdkPromise();
              setDebugInfo("Reintentando desde cero...");
              setStatus("loading");
              setRetryKey((key) => key + 1);
            }}
            className="text-xs text-accent underline font-medium mt-2"
          >
            Forzar reintentar
          </button>
          <button onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-white/30 underline">
            {showDebug ? "Ocultar debug" : "Ver debug"}
          </button>
          {showDebug && (
            <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10 max-w-xs text-left">
              <p className="text-[10px] text-white/40 font-mono mb-1">Estado: loading</p>
              <p className="text-[10px] text-white/50 font-mono break-all">{debugInfo}</p>
              <p className="text-[10px] text-white/30 font-mono mt-1">Reintentos: {retryKey}</p>
              <p className="text-[10px] text-white/30 font-mono">SDK cargado: {window.google?.maps ? "sí" : "no"}</p>
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-10 bg-[#0e1320] flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400/70" />
          <p className="text-sm text-white/70 font-medium">No pudimos cargar el mapa</p>
          {errorMsg && <p className="text-xs text-white/50 max-w-xs leading-relaxed">{errorMsg}</p>}
          <button
            onClick={() => {
              resetSdkPromise();
              setErrorMsg("");
              setDebugInfo("Reintentando desde cero...");
              setStatus("loading");
              setRetryKey((key) => key + 1);
            }}
            className="text-xs text-accent underline mt-1 font-medium"
          >
            Reintentar
          </button>
          <button onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-white/30 underline">
            {showDebug ? "Ocultar debug" : "Ver debug"}
          </button>
          {showDebug && (
            <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10 text-left max-w-xs">
              <p className="text-[10px] text-white/40 font-mono mb-1">Error detallado:</p>
              <p className="text-[10px] text-red-300/70 font-mono break-all">{errorMsg}</p>
              <p className="text-[10px] text-white/30 font-mono mt-2">Reintentos: {retryKey}</p>
              <p className="text-[10px] text-white/30 font-mono">SDK cargado: {window.google?.maps ? "sí" : "no"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}