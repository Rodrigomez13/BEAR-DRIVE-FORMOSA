import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { loadMapsSDK, getAuthFailure, resetSdkPromise } from "@/lib/mapsConfig";
import { getCachedRoute, setCachedRoute } from "@/lib/routeCache";
import { getCurrentPosition, FORMOSA_CENTER } from "@/lib/geo";
import {
  Navigation,
  Car,
  Star,
  Clock,
  Compass,
  AlertTriangle,
  Plus,
  Minus,
  X,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DARK_MAP_STYLES, LIGHT_MAP_STYLES } from "@/components/bear/MapView";
import { useTheme } from "@/lib/ThemeContext";

function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Generate realistic simulated drivers near a given coordinate
function generateNearbyDrivers(center) {
  const c = center || FORMOSA_CENTER;
  const driverTemplates = [
    {
      id: "driver-1",
      name: "Martín Gómez",
      rating: 4.94,
      totalRides: 842,
      category: "basic",
      categoryName: "BearDrive",
      vehicle: "Toyota Etios Blanco",
      plate: "AF 421 KL",
      latOffset: 0.0035,
      lngOffset: 0.0028,
      heading: 45,
    },
    {
      id: "driver-2",
      name: "Camila Ruiz",
      rating: 4.98,
      totalRides: 1250,
      category: "flash",
      categoryName: "BearFlash",
      vehicle: "Chevrolet Onix Gris",
      plate: "AE 890 RT",
      latOffset: -0.0042,
      lngOffset: 0.0051,
      heading: 130,
    },
    {
      id: "driver-3",
      name: "Lucas Fernández",
      rating: 4.88,
      totalRides: 620,
      category: "basic",
      categoryName: "BearDrive",
      vehicle: "VW Gol Trend Negro",
      plate: "AD 732 OP",
      latOffset: -0.0028,
      lngOffset: -0.0045,
      heading: 210,
    },
    {
      id: "driver-4",
      name: "Sofía Benítez",
      rating: 5.0,
      totalRides: 1680,
      category: "premium",
      categoryName: "BearPremium",
      vehicle: "Toyota Corolla Azul",
      plate: "AG 319 BN",
      latOffset: 0.0055,
      lngOffset: -0.0032,
      heading: 320,
    },
    {
      id: "driver-5",
      name: "Rodrigo Morales",
      rating: 4.92,
      totalRides: 940,
      category: "basic",
      categoryName: "BearDrive",
      vehicle: "Fiat Cronos Rojo",
      plate: "AF 610 QM",
      latOffset: 0.0068,
      lngOffset: 0.0042,
      heading: 90,
    },
  ];

  return driverTemplates.map((d) => {
    const driverLat = c.lat + d.latOffset;
    const driverLng = c.lng + d.lngOffset;
    const distMeters = Math.round(haversineMeters(c, { lat: driverLat, lng: driverLng }));
    const etaMinutes = Math.max(1, Math.round(distMeters / 320));
    return {
      ...d,
      lat: driverLat,
      lng: driverLng,
      distanceMeters: distMeters,
      distanceKm: (distMeters / 1000).toFixed(1),
      etaMinutes,
    };
  });
}

// Marker Icon Builders
function createUserMarkerIcon(g) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="18" fill="rgba(66, 133, 244, 0.22)" />
      <circle cx="19" cy="19" r="12" fill="#181E2F" stroke="#4285F4" stroke-width="2.5" />
      <circle cx="19" cy="19" r="5" fill="#4285F4" />
    </svg>
  `;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new g.maps.Size(38, 38),
    anchor: new g.maps.Point(19, 19),
  };
}

function createDriverMarkerIcon(g, category = "basic", heading = 0) {
  const color = category === "flash" ? "#06B6D4" : category === "premium" ? "#A855F7" : "#E9B74E";
  const rot = heading || 0;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
      <defs>
        <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <circle cx="21" cy="21" r="18" fill="#181E2F" stroke="${color}" stroke-width="2.5" filter="url(#carShadow)" />
      <g transform="rotate(${rot} 21 21)">
        <path d="M16 11 C16 9.5 26 9.5 26 11 L27 18 L28 25 C28 28 27 30 26 30 L24 30 L24 32 C24 33 22 33 22 32 L22 30 L20 30 L20 32 C20 33 18 33 18 32 L18 30 L16 30 C15 30 14 28 14 25 L15 18 Z" fill="${color}" />
        <rect x="17" y="14" width="8" height="4.5" rx="1.5" fill="#181E2F" />
        <circle cx="17" cy="11.5" r="1.2" fill="#FFFFFF" />
        <circle cx="25" cy="11.5" r="1.2" fill="#FFFFFF" />
        <rect x="16.5" y="28" width="2.2" height="1.2" rx="0.5" fill="#EF4444" />
        <rect x="23.3" y="28" width="2.2" height="1.2" rx="0.5" fill="#EF4444" />
      </g>
    </svg>
  `;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new g.maps.Size(42, 42),
    anchor: new g.maps.Point(21, 21),
  };
}

function createOriginMarkerIcon(g) {
  const size = 44;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="originShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <circle cx="22" cy="22" r="20" fill="#181E2F" stroke="#E9B74E" stroke-width="3" filter="url(#originShadow)"/>
      <circle cx="22" cy="22" r="7" fill="#E9B74E" />
    </svg>
  `;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new g.maps.Size(size, size),
    anchor: new g.maps.Point(22, 22),
  };
}

function createDestinationMarkerIcon(g) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
      <defs>
        <filter id="destShadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <path d="M19 0C8.5 0 0 8.5 0 19C0 31 19 48 19 48C19 48 38 31 38 19C38 8.5 29.5 0 19 0Z" fill="#E9B74E" filter="url(#destShadow)" />
      <circle cx="19" cy="18" r="13" fill="#181E2F" />
      <circle cx="19" cy="18" r="6" fill="#E9B74E" />
    </svg>
  `;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new g.maps.Size(38, 48),
    anchor: new g.maps.Point(19, 46),
  };
}

export default function RideMapView({
  userLocation = null,
  userPos = null,
  center = null,
  zoom = 15,
  nearbyDrivers: externalNearbyDrivers = null,
  showNearbyDrivers = true,
  origin = null,
  destination = null,
  originLabel = "Origen",
  destinationLabel = "Destino",
  route = null,
  recenter = null,
  onMapClick = null,
  onDriverClick = null,
  onRouteCalculated = null,
  interactive = true,
  className = "",
  showControls = true,
  showRouteStats = true,
  categoryFilter: initialCategoryFilter = "all",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dirServiceRef = useRef(null);
  const routePolylineRef = useRef(null);
  const routeOutlineRef = useRef(null);
  const markersRef = useRef({
    user: null,
    origin: null,
    destination: null,
    drivers: {},
  });
  const resizeObserverRef = useRef(null);
  const isInteractingRef = useRef(false);

  // States
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const effectiveUserLocation = userLocation || userPos || null;
  const [currentUserPos, setCurrentUserPos] = useState(effectiveUserLocation);
  const [locatingUser, setLocatingUser] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter);
  const [routeInfo, setRouteInfo] = useState(null);
  const [simulatedDrivers, setSimulatedDrivers] = useState([]);
  const [retryKey, setRetryKey] = useState(0);

  const themeContext = useTheme();
  const isDark = themeContext?.theme !== "light";

  // Update map visual style when day/night theme changes
  useEffect(() => {
    if (!mapRef.current || status !== "ready") return;
    const styles = isDark ? DARK_MAP_STYLES : LIGHT_MAP_STYLES;
    const backgroundColor = isDark ? "#0e1320" : "#f4f6f9";
    mapRef.current.setOptions({ styles, backgroundColor });
    if (routePolylineRef.current) {
      routePolylineRef.current.setOptions({
        strokeColor: isDark ? "#E9B74E" : "#d97706",
      });
    }
  }, [isDark, status]);

  // Sync categoryFilter prop changes
  useEffect(() => {
    if (initialCategoryFilter) {
      setCategoryFilter(initialCategoryFilter);
    }
  }, [initialCategoryFilter]);

  // Recenter when recenter prop changes
  useEffect(() => {
    if (recenter && mapRef.current && status === "ready") {
      mapRef.current.panTo(recenter);
    }
  }, [recenter?.lat, recenter?.lng, status]);

  // Determine effective drivers list (external or generated)
  const activeDrivers = useMemo(() => {
    const list = externalNearbyDrivers && externalNearbyDrivers.length > 0
      ? externalNearbyDrivers
      : simulatedDrivers;
    if (categoryFilter === "all") return list;
    return list.filter((d) => d.category === categoryFilter);
  }, [externalNearbyDrivers, simulatedDrivers, categoryFilter]);

  // Sync prop userLocation
  useEffect(() => {
    if (userLocation) {
      setCurrentUserPos(userLocation);
    }
  }, [userLocation]);

  // Locate user automatically on mount if no location was provided
  useEffect(() => {
    if (!currentUserPos) {
      setLocatingUser(true);
      getCurrentPosition({ enableHighAccuracy: true })
        .then((pos) => {
          setCurrentUserPos({ lat: pos.lat, lng: pos.lng });
          setSimulatedDrivers(generateNearbyDrivers({ lat: pos.lat, lng: pos.lng }));
        })
        .catch(() => {
          setCurrentUserPos(FORMOSA_CENTER);
          setSimulatedDrivers(generateNearbyDrivers(FORMOSA_CENTER));
        })
        .finally(() => setLocatingUser(false));
    } else if (simulatedDrivers.length === 0) {
      setSimulatedDrivers(generateNearbyDrivers(currentUserPos));
    }
  }, [currentUserPos, simulatedDrivers.length]);

  // Gentle drift simulation for nearby drivers so they feel active and alive
  useEffect(() => {
    if (!showNearbyDrivers || (externalNearbyDrivers && externalNearbyDrivers.length > 0)) return;

    const interval = setInterval(() => {
      setSimulatedDrivers((prev) =>
        prev.map((driver) => {
          const deltaLat = (Math.random() - 0.5) * 0.0003;
          const deltaLng = (Math.random() - 0.5) * 0.0003;
          const newHeading = Math.round((Math.atan2(deltaLng, deltaLat) * 180) / Math.PI + 360) % 360;
          return {
            ...driver,
            lat: driver.lat + deltaLat,
            lng: driver.lng + deltaLng,
            heading: newHeading || driver.heading,
          };
        })
      );
    }, 4500);

    return () => clearInterval(interval);
  }, [showNearbyDrivers, externalNearbyDrivers]);

  // Initialize Google Maps instance
  useEffect(() => {
    let cancelled = false;
    let dimObserver = null;

    const initMap = (g) => {
      if (cancelled || !containerRef.current) return;

      const initialCenter = center || currentUserPos || FORMOSA_CENTER;
      const initialStyles = isDark ? DARK_MAP_STYLES : LIGHT_MAP_STYLES;
      const initialBg = isDark ? "#0e1320" : "#f4f6f9";

      const map = new g.maps.Map(containerRef.current, {
        center: initialCenter,
        zoom: zoom,
        styles: initialStyles,
        backgroundColor: initialBg,
        gestureHandling: interactive ? "greedy" : "none",
        disableDefaultUI: true,
        clickableIcons: false,
      });

      mapRef.current = map;
      dirServiceRef.current = new g.maps.DirectionsService();

      // Route outline & main polyline
      routeOutlineRef.current = new g.maps.Polyline({
        map,
        path: [],
        strokeColor: "#181E2F",
        strokeWeight: 8,
        strokeOpacity: 0.6,
        zIndex: 20,
        visible: false,
      });

      routePolylineRef.current = new g.maps.Polyline({
        map,
        path: [],
        strokeColor: "#E9B74E",
        strokeWeight: 5,
        strokeOpacity: 0.95,
        zIndex: 21,
        visible: false,
      });

      // User location marker
      markersRef.current.user = new g.maps.Marker({
        map,
        icon: createUserMarkerIcon(g),
        visible: false,
        zIndex: 90,
      });

      // Origin & Destination markers
      markersRef.current.origin = new g.maps.Marker({
        map,
        icon: createOriginMarkerIcon(g),
        visible: false,
        zIndex: 100,
      });

      markersRef.current.destination = new g.maps.Marker({
        map,
        icon: createDestinationMarkerIcon(g),
        visible: false,
        zIndex: 101,
      });

      // Map click handler
      if (onMapClick) {
        map.addListener("click", (e) => {
          onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      }

      // Close selected driver when clicking blank map space
      map.addListener("click", () => {
        setSelectedDriver(null);
      });

      // Resize observer
      resizeObserverRef.current = new ResizeObserver(() => {
        if (mapRef.current && window.google?.maps) {
          window.google.maps.event.trigger(mapRef.current, "resize");
        }
      });
      resizeObserverRef.current.observe(containerRef.current);

      setStatus("ready");
    };

    const initWhenReady = (g) => {
      if (cancelled || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        initMap(g);
        return;
      }

      dimObserver = new ResizeObserver(() => {
        if (cancelled || !containerRef.current) return;
        const rectNow = containerRef.current.getBoundingClientRect();
        if (rectNow.width > 0 && rectNow.height > 0) {
          dimObserver.disconnect();
          dimObserver = null;
          initMap(g);
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
        setErrorMsg(authFail || err?.message || "No se pudo cargar Google Maps");
        setStatus("error");
      });

    return () => {
      cancelled = true;
      if (dimObserver) dimObserver.disconnect();
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (routeOutlineRef.current) routeOutlineRef.current.setMap(null);
      if (routePolylineRef.current) routePolylineRef.current.setMap(null);
      Object.values(markersRef.current.drivers).forEach((m) => m?.setMap(null));
      markersRef.current.drivers = {};
      if (markersRef.current.user) markersRef.current.user.setMap(null);
      if (markersRef.current.origin) markersRef.current.origin.setMap(null);
      if (markersRef.current.destination) markersRef.current.destination.setMap(null);
      mapRef.current = null;
    };
  }, [retryKey]);

  // Update user marker position and auto-center once ready
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !markersRef.current.user) return;
    if (currentUserPos) {
      markersRef.current.user.setPosition(currentUserPos);
      markersRef.current.user.setVisible(true);
    } else {
      markersRef.current.user.setVisible(false);
    }
  }, [currentUserPos, status]);

  // Update nearby driver markers on the map
  useEffect(() => {
    const g = window.google;
    if (status !== "ready" || !mapRef.current || !g?.maps) return;

    const existingMarkers = markersRef.current.drivers;
    const currentDriverIds = new Set();

    if (showNearbyDrivers) {
      activeDrivers.forEach((driver) => {
        currentDriverIds.add(driver.id);
        let marker = existingMarkers[driver.id];

        if (!marker) {
          marker = new g.maps.Marker({
            map: mapRef.current,
            position: { lat: driver.lat, lng: driver.lng },
            icon: createDriverMarkerIcon(g, driver.category, driver.heading),
            title: `${driver.name} - ${driver.categoryName || "BearDrive"}`,
            zIndex: 80,
          });

          marker.addListener("click", () => {
            setSelectedDriver(driver);
            if (onDriverClick) onDriverClick(driver);
          });

          existingMarkers[driver.id] = marker;
        } else {
          marker.setPosition({ lat: driver.lat, lng: driver.lng });
          marker.setIcon(createDriverMarkerIcon(g, driver.category, driver.heading));
          marker.setVisible(true);
        }
      });
    }

    // Clean up removed or filtered out drivers
    Object.keys(existingMarkers).forEach((id) => {
      if (!currentDriverIds.has(id)) {
        existingMarkers[id].setMap(null);
        delete existingMarkers[id];
      }
    });
  }, [activeDrivers, showNearbyDrivers, status, onDriverClick]);

  // Update Origin and Destination markers and Directions Route
  useEffect(() => {
    const g = window.google;
    if (status !== "ready" || !mapRef.current || !g?.maps) return;

    const originMarker = markersRef.current.origin;
    const destMarker = markersRef.current.destination;
    const outlinePolyline = routeOutlineRef.current;
    const mainPolyline = routePolylineRef.current;

    // Origin marker
    if (origin) {
      originMarker.setPosition({ lat: origin.lat, lng: origin.lng });
      originMarker.setVisible(true);
    } else {
      originMarker.setVisible(false);
    }

    // Destination marker
    if (destination) {
      destMarker.setPosition({ lat: destination.lat, lng: destination.lng });
      destMarker.setVisible(true);
    } else {
      destMarker.setVisible(false);
    }

    // Explicit Route path passed via prop
    if (route && route.length >= 2) {
      outlinePolyline.setPath(route);
      mainPolyline.setPath(route);
      outlinePolyline.setVisible(true);
      mainPolyline.setVisible(true);

      const bounds = new g.maps.LatLngBounds();
      route.forEach((pt) => bounds.extend(pt));
      mapRef.current.fitBounds(bounds, { top: 60, right: 40, bottom: 120, left: 40 });
      return;
    }

    // Calculate directions between Origin and Destination
    if (origin && destination && dirServiceRef.current) {
      const origPos = { lat: origin.lat, lng: origin.lng };
      const destPos = { lat: destination.lat, lng: destination.lng };

      const applyRoute = (fullPath, info) => {
        outlinePolyline.setPath(fullPath);
        mainPolyline.setPath(fullPath);
        outlinePolyline.setVisible(true);
        mainPolyline.setVisible(true);
        setRouteInfo(info);
        if (onRouteCalculated) onRouteCalculated(info);

        const bounds = new g.maps.LatLngBounds();
        fullPath.forEach((p) => bounds.extend(p));
        mapRef.current.fitBounds(bounds, { top: 80, right: 50, bottom: 140, left: 50 });
      };

      // 1. Check local route cache
      const cached = getCachedRoute(origPos, destPos);
      if (cached && cached.fullPath) {
        applyRoute(cached.fullPath, cached.routeInfo);
        return;
      }

      // 2. Fetch fresh directions
      dirServiceRef.current.route(
        {
          origin: origPos,
          destination: destPos,
          travelMode: g.maps.TravelMode.DRIVING,
        },
        (result, routeStatus) => {
          if (routeStatus === g.maps.DirectionsStatus.OK && result) {
            const leg = result.routes?.[0]?.legs?.[0];
            const overviewPath = result.routes?.[0]?.overview_path;
            const fullPath =
              overviewPath && overviewPath.length > 0
                ? overviewPath.map((p) => ({ lat: p.lat(), lng: p.lng() }))
                : [origPos, destPos];

            const info = {
              distanceText: leg?.distance?.text || "",
              distanceKm: leg?.distance?.value ? (leg.distance.value / 1000).toFixed(1) : "0",
              distanceMeters: leg?.distance?.value || 0,
              durationText: leg?.duration?.text || "",
              durationMinutes: leg?.duration?.value ? Math.ceil(leg.duration.value / 60) : 1,
              startAddress: leg?.start_address || "",
              endAddress: leg?.end_address || "",
            };

            applyRoute(fullPath, info);
            setCachedRoute(origPos, destPos, { fullPath, routeInfo: info });
          } else {
            // Fallback straight line
            const fallbackPath = [origPos, destPos];
            outlinePolyline.setPath(fallbackPath);
            mainPolyline.setPath(fallbackPath);
            outlinePolyline.setVisible(true);
            mainPolyline.setVisible(true);

            const distMeters = Math.round(haversineMeters(origPos, destPos));
            const info = {
              distanceText: `${(distMeters / 1000).toFixed(1)} km`,
              distanceKm: (distMeters / 1000).toFixed(1),
              durationText: `${Math.max(1, Math.ceil(distMeters / 300))} min`,
              durationMinutes: Math.max(1, Math.ceil(distMeters / 300)),
            };
            setRouteInfo(info);
            if (onRouteCalculated) onRouteCalculated(info);

            const bounds = new g.maps.LatLngBounds();
            fallbackPath.forEach((p) => bounds.extend(p));
            mapRef.current.fitBounds(bounds, { top: 80, right: 50, bottom: 140, left: 50 });
          }
        }
      );
    } else {
      outlinePolyline.setVisible(false);
      mainPolyline.setVisible(false);
      setRouteInfo(null);
    }
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, route, status, onRouteCalculated]);

  // Recenter map on user location
  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return;
    setLocatingUser(true);
    getCurrentPosition({ enableHighAccuracy: true })
      .then((pos) => {
        const newPos = { lat: pos.lat, lng: pos.lng };
        setCurrentUserPos(newPos);
        mapRef.current.panTo(newPos);
        mapRef.current.setZoom(16);
      })
      .catch(() => {
        if (currentUserPos) {
          mapRef.current.panTo(currentUserPos);
          mapRef.current.setZoom(16);
        }
      })
      .finally(() => setLocatingUser(false));
  }, [currentUserPos]);

  // Zoom helpers
  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.setZoom((mapRef.current.getZoom() || 15) + 1);
  };
  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.setZoom((mapRef.current.getZoom() || 15) - 1);
  };

  return (
    <div className={`relative w-full h-full min-h-[300px] overflow-hidden ${isDark ? "bg-[#0e1320]" : "bg-[#f4f6f9]"} select-none ${className}`}>
      {/* Map Canvas Container */}
      <div ref={containerRef} className={`absolute inset-0 w-full h-full ${isDark ? "bg-[#0e1320]" : "bg-[#f4f6f9]"}`} />

      {/* Floating Controls (Top & Right) */}
      {showControls && status === "ready" && (
        <>
          {/* Active Drivers Pill & Filter Bar (positioned cleanly below top header) */}
          <div className="absolute top-[calc(env(safe-area-inset-top)+4.75rem)] inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            {/* Nearby Drivers Count Badge */}
            {showNearbyDrivers && (
              <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#181E2F]/90 backdrop-blur-md border border-[#E9B74E]/30 text-white shadow-lg text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E9B74E] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E9B74E]" />
                </span>
                <span>{activeDrivers.length} conductores cerca</span>
              </div>
            )}

            {/* Category Filter Chips */}
            {showNearbyDrivers && (
              <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-full bg-[#181E2F]/85 backdrop-blur-md border border-white/10 shadow-lg">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                    categoryFilter === "all"
                      ? "bg-[#E9B74E] text-[#181E2F] font-bold shadow"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("basic")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                    categoryFilter === "basic"
                      ? "bg-[#E9B74E] text-[#181E2F] font-bold shadow"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("flash")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                    categoryFilter === "flash"
                      ? "bg-[#06B6D4] text-[#181E2F] font-bold shadow"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Flash
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("premium")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                    categoryFilter === "premium"
                      ? "bg-[#A855F7] text-white font-bold shadow"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Premium
                </button>
              </div>
            )}
          </div>

          {/* Right Floating Actions: Recenter & Zoom */}
          <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+8.25rem)] z-10 flex flex-col gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={handleRecenter}
              disabled={locatingUser}
              className="w-10 h-10 rounded-xl bg-[#181E2F]/90 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shadow-lg active:scale-95 transition hover:border-[#E9B74E]/50"
              title="Recentrar en mi ubicación"
              aria-label="Recentrar en mi ubicación"
            >
              <Navigation className={`w-4 h-4 text-[#E9B74E] ${locatingUser ? "animate-spin" : ""}`} />
            </button>

            <div className="flex flex-col rounded-xl overflow-hidden bg-[#181E2F]/90 backdrop-blur-md border border-white/15 shadow-lg">
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white active:bg-white/10 transition border-b border-white/10"
                aria-label="Acercar mapa"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white active:bg-white/10 transition"
                aria-label="Alejar mapa"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Route Statistics Floating Card */}
      {showRouteStats && routeInfo && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+4.75rem)] left-3 right-16 z-10 pointer-events-auto max-w-sm animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="p-3 rounded-2xl bg-[#181E2F]/95 backdrop-blur-md border border-[#E9B74E]/30 shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E9B74E]/20 flex items-center justify-center border border-[#E9B74E]/40">
                <Compass className="w-5 h-5 text-[#E9B74E]" />
              </div>
              <div>
                <p className="text-xs text-white/60 font-medium">Ruta sugerida</p>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{routeInfo.distanceText || `${routeInfo.distanceKm} km`}</span>
                  <span className="text-white/40">•</span>
                  <span className="text-[#E9B74E]">{routeInfo.durationText || `${routeInfo.durationMinutes} min`}</span>
                </p>
              </div>
            </div>
            <Badge className="bg-[#E9B74E]/20 text-[#E9B74E] border-[#E9B74E]/30 text-[11px] font-semibold">
              Rápida
            </Badge>
          </div>
        </div>
      )}

      {/* Selected Driver Drawer / Popover Card */}
      {selectedDriver && (
        <div className="absolute inset-x-3 bottom-3 z-20 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
          <Card className="p-4 rounded-2xl bg-[#181E2F]/95 backdrop-blur-xl border border-[#E9B74E]/30 shadow-2xl text-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[#202840] border-2 border-[#E9B74E] flex items-center justify-center font-bold text-lg text-[#E9B74E]">
                    {selectedDriver.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#181E2F] border border-white/20 flex items-center justify-center">
                    <Car className="w-3 h-3 text-[#E9B74E]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-white">{selectedDriver.name}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        selectedDriver.category === "flash"
                          ? "bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30"
                          : selectedDriver.category === "premium"
                          ? "bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30"
                          : "bg-[#E9B74E]/20 text-[#E9B74E] border border-[#E9B74E]/30"
                      }`}
                    >
                      {selectedDriver.categoryName || "BearDrive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/70 mt-0.5">
                    <span className="flex items-center text-[#E9B74E] font-semibold">
                      <Star className="w-3.5 h-3.5 fill-[#E9B74E] mr-1" />
                      {selectedDriver.rating}
                    </span>
                    <span>•</span>
                    <span>{selectedDriver.totalRides || 500}+ viajes</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDriver(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vehicle & ETA info */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs mb-3">
              <div>
                <p className="text-white/50 text-[10px] uppercase font-bold tracking-wider">Vehículo</p>
                <p className="font-semibold text-white mt-0.5 truncate">{selectedDriver.vehicle}</p>
                <p className="text-white/60 font-mono text-[11px]">{selectedDriver.plate}</p>
              </div>
              <div>
                <p className="text-white/50 text-[10px] uppercase font-bold tracking-wider">Llegada estimada</p>
                <p className="font-bold text-[#E9B74E] text-sm mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  ~{selectedDriver.etaMinutes} min
                </p>
                <p className="text-white/60 text-[11px]">{selectedDriver.distanceKm} km de distancia</p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                if (onDriverClick) onDriverClick(selectedDriver);
                setSelectedDriver(null);
              }}
              className="w-full bg-gradient-to-r from-[#E9B74E] to-[#F5C467] text-[#181E2F] font-bold rounded-xl shadow-lg hover:opacity-95 transition"
            >
              Seleccionar este conductor
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>
        </div>
      )}

      {/* Loading State Overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 z-20 bg-[#0e1320] flex flex-col items-center justify-center gap-3 p-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-[#181E2F] border-t-[#E9B74E] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Car className="w-5 h-5 text-[#E9B74E]" />
            </div>
          </div>
          <p className="text-sm text-white/80 font-semibold">Cargando mapa de BearDrive...</p>
          <p className="text-xs text-white/40">Conectando con Google Maps y localizando conductores</p>
        </div>
      )}

      {/* Error State Overlay */}
      {status === "error" && (
        <div className="absolute inset-0 z-20 bg-[#0e1320] flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No se pudo cargar el mapa</h3>
          <p className="text-xs text-white/60 max-w-xs leading-relaxed">
            {errorMsg || "Comprobá tu conexión a internet o la configuración de Google Maps."}
          </p>
          <Button
            type="button"
            onClick={() => {
              resetSdkPromise();
              setErrorMsg("");
              setStatus("loading");
              setRetryKey((k) => k + 1);
            }}
            className="mt-2 bg-[#E9B74E] text-[#181E2F] font-semibold text-xs px-4 py-2 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Reintentar carga
          </Button>
        </div>
      )}
    </div>
  );
}
