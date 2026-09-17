import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { beardrive } from "@/services/beardrive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import MapView from "@/components/bear/MapView";
import MapBottomSheet from "@/components/bear/MapBottomSheet";
import RideMapView from "@/components/bear/RideMapView";
import StarRating from "@/components/bear/StarRating";
import FavoriteModal from "@/components/bear/FavoriteModal";
import FavoritesBar from "@/components/bear/FavoritesBar";
import { searchPlaces, geocodePlace, reverseGeocode, getCurrentPosition, FORMOSA_CENTER, displayAddress, FORMOSA_POIS } from "@/lib/geo";
import CancelRideDialog from "@/components/bear/CancelRideDialog";
import SosDialog from "@/components/bear/SosDialog";
import { useActiveRideGuard } from "@/hooks/useActiveRideGuard";
import { useRideSubscription } from "@/hooks/useRideSubscription";
import { sanitizeString } from "@/lib/sanitize";
import Haptics from "@/lib/haptics";
import BearAvatar from "@/components/bear/BearAvatar";
import { MapPin, Search, Crosshair, Loader2, Star, Shield, X, CheckCircle2, Wallet, QrCode, Banknote, CreditCard, ChevronUp, ChevronDown, Share2, MessageCircle, Sparkles } from "lucide-react";
import { Image } from "@/components/ui/image";
import { BEAR_LOGO_SVG } from "@/lib/brandAssets";
import LoadingScreen from "@/components/bear/LoadingScreen";
import SearchingDriverAnimation from "@/components/bear/SearchingDriverAnimation";
import RideChat from "@/components/bear/RideChat";

const CATEGORIES = [
  { code: "basic", name: "BearDrive", eta: "4 min", desc: "Económico estándar", badge: null },
  { code: "flash", name: "BearFlash", eta: "2 min", desc: "Prioritario", badge: "Más rápido" },
  { code: "premium", name: "BearPremium", eta: "5 min", desc: "Confort premium", badge: "Confort" },
];

const ACTIVE_STATUSES = ["SEARCHING", "ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING", "PIN_VALIDATION", "IN_PROGRESS", "ARRIVED", "PAYMENT_PENDING"];

export default function PassengerViajar() {
  const { user } = useAuth();
  const [origin, setOrigin] = useState(null);
  const [originAddress, setOriginAddress] = useState("");
  const [destination, setDestination] = useState(null);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchInputRef = useRef(null);
  const [geocoding, setGeocoding] = useState(false);
  const [selectingTarget, setSelectingTarget] = useState("destination");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [category, setCategory] = useState("basic");
  const [paymentMethod, setPaymentMethod] = useState(user?.preferred_payment_method || "cash");
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSosDialog, setShowSosDialog] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [savedCard, setSavedCard] = useState(null);
  const [linkingCard, setLinkingCard] = useState(false);
  const [paying, setPaying] = useState(false);
  const [driverPos, setDriverPos] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [cardMinimized, setCardMinimized] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [enableReview, setEnableReview] = useState(true);
  const [ratingTags, setRatingTags] = useState([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [originExpanded, setOriginExpanded] = useState(false);
  const [destExpanded, setDestExpanded] = useState(true);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [usePoints, setUsePoints] = useState(false);
  const [cashNoteOption, setCashNoteOption] = useState("exact");
  const [pickupReference, setPickupReference] = useState("");
  // Handle Stripe redirect return + card setup return + fetch saved card
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    if (paymentStatus === "success") {
      toast({ title: "Pago procesado", description: "Confirmando con el conductor..." });
    } else if (paymentStatus === "cancelled") {
      toast({ title: "Pago cancelado", description: "Podés reintentar el pago", variant: "destructive" });
    }
    if (paymentStatus) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("ride");
      window.history.replaceState({}, "", url);
    }

    // Handle card setup return
    const cardSetup = params.get("card_setup");
    if (cardSetup === "success") {
      toast({ title: "Tarjeta vinculada", description: "Ya podés pagar con tarjeta automáticamente" });
    } else if (cardSetup === "cancelled") {
      toast({ title: "Vinculación cancelada", variant: "destructive" });
    }
    if (cardSetup) {
      const url = new URL(window.location.href);
      url.searchParams.delete("card_setup");
      window.history.replaceState({}, "", url);
    }

    // Fetch saved card info
    const fetchCard = async () => {
      try {
        const res = await base44.functions.invoke("getPassengerPaymentMethod", {});
        if (res.data?.has_card) setSavedCard(res.data);
      } catch { /* ignore */ }
    };
    fetchCard();
  }, []);

  // Recover active ride on mount.
  // NOTE: setLoading(false) runs BEFORE reverseGeocode so the MapView can render
  // and load the Google Maps SDK. reverseGeocode depends on that SDK, so calling
  // it while loading=true would deadlock (map never renders, SDK never loads).
  useEffect(() => {
    const recover = async () => {
      try {
        const rides = await beardrive.rides.list({ passenger_id: user.id, status: { $in: ACTIVE_STATUSES } }, "-created_date", 1);
        if (rides.length > 0) {
          setActiveRide(rides[0]);
          if (rides[0].origin_lat) setOrigin({ lat: rides[0].origin_lat, lng: rides[0].origin_lng });
          if (rides[0].destination_lat) setDestination({ lat: rides[0].destination_lat, lng: rides[0].destination_lng });
          setOriginAddress(rides[0].origin_address || "");
          setDestinationAddress(rides[0].destination_address || "");
          setLoading(false);
        } else {
          // Get GPS position (doesn't need the Maps SDK), then let the map render
          // before resolving the address via reverseGeocode (which needs the SDK).
          let pos = null;
          try {
            pos = await getCurrentPosition();
            setOrigin(pos);
            setUserPos(pos);
          } catch (err) { /* ignore — user can pick origin manually */ }
          setLoading(false);
          // Resolve address now that the MapView is rendering and the SDK is loading.
          if (pos) {
            reverseGeocode(pos.lat, pos.lng)
              .then(setOriginAddress)
              .catch(() => {});
          }
        }
      } catch (err) {
        setLoading(false);
      }
    };
    recover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime ride status subscription — primary sync mechanism (replaces 3s polling).
  // A 15s fallback poll inside the hook covers recovery if a realtime event is missed.
  useRideSubscription(activeRide?.id, (updated) => {
    if (updated) setActiveRide(updated);
  });

  // Real-time driver location subscription — no polling delay
  useEffect(() => {
    if (!activeRide?.driver_id) return;

    // Initial fetch so the marker appears immediately
    beardrive.drivers.locations(activeRide.driver_id)
      .then((locs) => {
        if (locs.length > 0) setDriverPos({ lat: locs[0].lat, lng: locs[0].lng, heading: locs[0].heading });
      })
      .catch(() => {});

    const unsubscribe = beardrive.drivers.subscribeLocation((event) => {
      if (event.data?.driver_id !== activeRide.driver_id) return;
      if (event.type === "delete") return;
      setDriverPos({ lat: event.data.lat, lng: event.data.lng, heading: event.data.heading });
    });

    return () => unsubscribe();
  }, [activeRide?.driver_id]);

  // Auto-minimize/expand card and trigger tactile/audio feedback on status transitions
  const prevRideStatusRef = useRef(activeRide?.status);
  useEffect(() => {
    const prev = prevRideStatusRef.current;
    const current = activeRide?.status;
    prevRideStatusRef.current = current;

    if (!activeRide) {
      setCardMinimized(false);
      setRouteOrigin(null);
      return;
    }

    if (["ASSIGNED", "DRIVER_APPROACHING"].includes(current) && !prev) {
      setCardMinimized(true);
    } else if (current === "DRIVER_ARRIVED" && prev !== "DRIVER_ARRIVED") {
      setCardMinimized(false); // Auto-expand for instant PIN visibility
      Haptics.arrival();
      toast({
        title: "¡Tu conductor llegó!",
        description: "Mostrale o dictale el PIN de 4 dígitos al subir al auto.",
      });
    } else if (current === "IN_PROGRESS" && prev !== "IN_PROGRESS") {
      setCardMinimized(true); // Auto-minimize during trip so the route map is clear
      Haptics.success();
    } else if (current === "ARRIVED" && prev !== "ARRIVED") {
      setCardMinimized(false); // Auto-expand when reaching destination
      Haptics.arrival();
    }
  }, [activeRide?.status, activeRide?.id]);

  // Capture driver's initial position as route origin (avoids recalculating route every poll)
  useEffect(() => {
    if (driverPos && activeRide && ["ASSIGNED", "DRIVER_APPROACHING"].includes(activeRide.status) && !routeOrigin) {
      setRouteOrigin({ lat: driverPos.lat, lng: driverPos.lng });
    }
  }, [driverPos, activeRide?.status, routeOrigin]);

  // Guard against closing app during active ride
  useActiveRideGuard(!!activeRide);

  // GPS
  const handleGPS = async () => {
    try {
      const pos = await getCurrentPosition();
      setOrigin(pos);
      setUserPos(pos);
      const addr = await reverseGeocode(pos.lat, pos.lng);
      setOriginAddress(addr);
    } catch (err) {
      toast({ title: "No pudimos obtener tu ubicación", variant: "destructive" });
    }
  };

  // Ignore obsolete predictions when the query or target changes.
  useEffect(() => {
    let current = true;
    setSearchResults([]);
    setSearchError(false);
    if (searchQuery.trim().length < 3) { setSearchingPlace(false); return; }
    setSearchingPlace(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(searchQuery.trim());
        if (current) setSearchResults(results);
      } catch { if (current) setSearchError(true); }
      finally { if (current) setSearchingPlace(false); }
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [searchQuery, selectingTarget]);

  const chooseTarget = (target) => {
    setSelectingTarget(target);
    setSearchQuery("");
    setPanelExpanded(true);
    searchInputRef.current?.focus();
  };

  const handleSelectPlace = async (place) => {
    if (geocoding) return;
    const target = selectingTarget;
    setSearchQuery("");
    setSearchResults([]);
    setGeocoding(true);
    try {
      const geo = await geocodePlace(place.place_id);
      if (!geo) { toast({ title: "No se pudo obtener la ubicación", variant: "destructive" }); return; }
      if (target === "origin") {
        setOrigin({ lat: geo.lat, lng: geo.lng });
        setOriginAddress(geo.label);
        setSelectingTarget("destination");
      } else {
        setDestination({ lat: geo.lat, lng: geo.lng });
        setDestinationAddress(geo.label);
      }
    } catch {
      toast({ title: "Error al buscar el lugar", variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  };

  const handleSelectFavorite = (fav) => {
    if (selectingTarget === "origin") {
      setOrigin({ lat: fav.lat, lng: fav.lng });
      setOriginAddress(fav.address);
    } else {
      setDestination({ lat: fav.lat, lng: fav.lng });
      setDestinationAddress(fav.address);
    }
  };

  const handleMapClick = useCallback((pos) => {
    if (activeRide) return;
    if (selectingTarget === "origin") {
      setOrigin(pos);
      reverseGeocode(pos.lat, pos.lng).then(setOriginAddress);
    } else {
      setDestination(pos);
      reverseGeocode(pos.lat, pos.lng).then(setDestinationAddress);
    }
  }, [selectingTarget, activeRide]);

  // Recalculate quote when category changes (if quote already exists)
  useEffect(() => {
    if (!quote || !origin || !destination) return;
    let cancelled = false;
    const recalculate = async () => {
      try {
        const res = await beardrive.rides.quote({
          origin_lat: origin.lat, origin_lng: origin.lng,
          destination_lat: destination.lat, destination_lng: destination.lng,
          category,
        });
        if (!cancelled) setQuote(res.data.quote);
      } catch {
        // keep existing quote on error
      }
    };
    recalculate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Quote
  const handleQuote = async () => {
    if (!origin || !destination) {
      toast({ title: "Elegí origen y destino", variant: "destructive" });
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await beardrive.rides.quote({
        origin_lat: origin.lat, origin_lng: origin.lng,
        destination_lat: destination.lat, destination_lng: destination.lng,
        category,
      });
      setQuote(res.data.quote);
    } catch (err) {
      toast({ title: "No se pudo cotizar", description: err.message, variant: "destructive" });
    } finally {
      setQuoteLoading(false);
    }
  };

  // Request ride
  const handleRequestRide = async () => {
    if (!quote) return;
    if (paymentMethod === "card" && !savedCard) {
      toast({ title: "Vinculá una tarjeta primero", description: "Tocá \"Vincular tarjeta\" abajo", variant: "destructive" });
      return;
    }
    Haptics.medium();
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const availablePoints = user?.bear_points || 0;
    const pointsDiscount = (usePoints && availablePoints >= 50)
      ? Math.min(Math.floor(availablePoints / 10) * 100, Math.floor(quote.price * 0.3))
      : 0;
    const finalFare = Math.max(quote.price - pointsDiscount, 500);

    const notesList = [];
    if (pickupReference.trim()) notesList.push(`Ref: ${sanitizeString(pickupReference.trim(), 100)}`);
    if (paymentMethod === "cash") {
      if (cashNoteOption === "exact") notesList.push("Pago justo (sin vuelto)");
      else if (cashNoteOption === "change") notesList.push("Necesita cambio");
      else notesList.push(`Abona con billete de $${Number(cashNoteOption).toLocaleString("es-AR")}`);
    }
    if (pointsDiscount > 0) notesList.push(`Desc. BearPoints: -$${pointsDiscount}`);
    const finalNotes = notesList.join(" · ");

    // Optimistic: show searching state immediately, roll back on failure
    const tempRide = {
      status: "SEARCHING",
      origin_address: sanitizeString(originAddress, 300) || "Ubicación seleccionada",
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      destination_address: sanitizeString(destinationAddress, 300) || "Ubicación seleccionada",
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      category,
      payment_method: paymentMethod,
      quoted_fare: finalFare,
      distance_km: quote.distance_km,
      duration_min: quote.duration_min,
      start_pin: pin,
      notes: finalNotes,
    };
    setActiveRide(tempRide);
    setQuote(null);
    try {
      const quoteId = quote.id || quote.quote_id;
      let ride;
      if (quoteId) {
        const response = await beardrive.rides.request({
          quote_id: quoteId,
          payment_method: paymentMethod === "cash" ? "cash" : "qr",
          notes: finalNotes,
        });
        if (!response.data?.ride?.id) throw new Error("No se pudo confirmar la solicitud");
        ride = response.data.ride;
      } else {
        ride = await base44.entities.Ride.create({
          passenger_id: user.id,
          passenger_name: sanitizeString(user.full_name || user.email, 100),
          status: "SEARCHING",
          origin_address: sanitizeString(originAddress, 300) || "Ubicación seleccionada",
          origin_lat: origin.lat,
          origin_lng: origin.lng,
          destination_address: sanitizeString(destinationAddress, 300) || "Ubicación seleccionada",
          destination_lat: destination.lat,
          destination_lng: destination.lng,
          category,
          payment_method: paymentMethod,
          quoted_fare: finalFare,
          distance_km: quote.distance_km,
          duration_min: quote.duration_min,
          start_pin: pin,
          notes: finalNotes,
          quote_data: JSON.stringify(quote),
        });
      }
      setActiveRide(ride);
      Haptics.success();
      toast({ title: "Viaje solicitado", description: "Buscando conductores cercanos..." });
    } catch (err) {
      setActiveRide(null);
      setQuote(quote);
      toast({ title: "No se pudo solicitar el viaje", description: err.message, variant: "destructive" });
    }
  };

  // Cancel ride
  const handleCancel = async () => {
    if (!activeRide) return;
    if (!activeRide.id) {
      // Optimistic ride not yet created — just clear local state
      setActiveRide(null);
      setOrigin(null);
      setDestination(null);
      setOriginAddress("");
      setDestinationAddress("");
      setQuote(null);
      setDriverPos(null);
      setShowCancelDialog(false);
      return;
    }
    try {
      await beardrive.rides.cancelPassenger({ ride_id: activeRide.id });
      setActiveRide(null);
      setOrigin(null);
      setDestination(null);
      setOriginAddress("");
      setDestinationAddress("");
      setQuote(null);
      setDriverPos(null);
      setShowCancelDialog(false);
      toast({ title: "Viaje cancelado" });
    } catch (err) {
      toast({ title: "No se pudo cancelar", variant: "destructive" });
    }
  };

  // Rate ride — then offer to save favorite
  const handleRate = async () => {
    if (rating === 0) return;
    try {
      await beardrive.rides.rate({ ride_id: activeRide.id, score: rating, comment: ratingComment, tags: ratingTags.join(",") });
      toast({ title: "¡Gracias por tu calificación!" });
      setShowFavoriteModal(true);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Skip rating — go straight to favorite modal
  const handleSkipRating = () => {
    setShowFavoriteModal(true);
  };

  const handleFavoriteClose = () => {
    setShowFavoriteModal(false);
    setActiveRide(null);
    setRating(0);
    setRatingComment("");
    setRatingTags([]);
    setEnableReview(true);
    setDriverPos(null);
  };

  const handlePostpone = () => {
    setActiveRide(null);
    setRating(0);
    setRatingComment("");
    setRatingTags([]);
    setEnableReview(true);
    setDriverPos(null);
  };

  // Link a card for automatic payments (Stripe SetupIntent via Checkout)
  const handleLinkCard = async () => {
    if (window.self !== window.top) {
      toast({ title: "No disponible en vista previa", description: "Publicá la app para vincular tarjeta", variant: "destructive" });
      return;
    }
    setLinkingCard(true);
    try {
      const res = await base44.functions.invoke("setupPassengerCard", {});
      if (res.data?.checkout_url) window.location.href = res.data.checkout_url;
    } catch (err) {
      toast({ title: "Error al vincular tarjeta", description: err.message, variant: "destructive" });
    } finally {
      setLinkingCard(false);
    }
  };

  // Pay via QR — get the Checkout URL generated by the driver and redirect
  const handleQrPayment = async () => {
    if (window.self !== window.top) {
      toast({ title: "No disponible en vista previa", description: "Publicá la app para pagar", variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const res = await beardrive.payments.rideCheckout({ ride_id: activeRide.id });
      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        toast({ title: "No se pudo obtener el link de pago", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error al obtener link de pago", description: err.message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  // Pay with card via Stripe Checkout
  const handleCardPayment = async () => {
    if (!activeRide) return;
    // Block checkout inside iframe (preview)
    if (window.self !== window.top) {
      toast({ title: "Pago no disponible en vista previa", description: "Publicá la app para pagar con tarjeta", variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const res = await beardrive.payments.createRidePayment({ ride_id: activeRide.id });
      if (res.data?.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        toast({ title: "No se pudo iniciar el pago", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error al iniciar el pago", description: err.message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  // Share trip details via Web Share API (fallback: clipboard)
  const handleShareTrip = async () => {
    if (!activeRide) return;
    const approachPhase = ["ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING", "PIN_VALIDATION"].includes(activeRide.status);
    const driver = activeRide.driver_name || "Conductor asignado";
    const vehicle = [activeRide.vehicle_model, activeRide.vehicle_plate].filter(Boolean).join(" · ");
    const dest = displayAddress(activeRide.destination_address);
    const fare = formatPrice(activeRide.quoted_fare);
    const statusText = approachPhase ? "En camino a mi ubicación" : "En viaje";
    const text = `🚗 BearDrive — Mi viaje\nConductor: ${driver}${vehicle ? `\nVehículo: ${vehicle}` : ""}\nDestino: ${dest}\nEstado: ${statusText}\nTarifa: ${fare}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "BearDrive — Mi viaje", text, url: "https://bear-drive-go.base44.app" });
      } else {
        await navigator.clipboard?.writeText(text);
        toast({ title: "Detalle del viaje copiado", description: "Pegalo en tu contacto para compartirlo" });
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        try { await navigator.clipboard?.writeText(text); toast({ title: "Detalle del viaje copiado" }); } catch {}
      }
    }
  };

  const formatPrice = (v) => `$${(v || 0).toLocaleString("es-AR")}`;

  // ---- RENDER STATES ----

  if (loading) {
    return <LoadingScreen className="h-full" label="Preparando tu mapa en Formosa..." mascotImage="/assets/mascot/bear_cruz_running_hd.jpg" />;
  }

  // Active ride view
  if (activeRide) {
    const status = activeRide.status;
    const approachPhase = ["ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING", "PIN_VALIDATION"].includes(status);

    if (status === "COMPLETED") {
      return (
        <>
          <div className="max-w-md mx-auto px-4 pt-6 pb-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold">¡Viaje completado!</h1>
            </div>
            <Card className="p-5 mb-4 space-y-3">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Origen</span><span className="text-sm font-medium text-right truncate ml-3">{displayAddress(activeRide.origin_address)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Destino</span><span className="text-sm font-medium text-right truncate ml-3">{displayAddress(activeRide.destination_address)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Distancia</span><span className="text-sm font-medium">{activeRide.distance_km} km</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Duración</span><span className="text-sm font-medium">{activeRide.duration_min} min</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Pago</span><span className="text-sm font-medium capitalize">{activeRide.payment_method}</span></div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-extrabold text-accent">{formatPrice(activeRide.final_fare || activeRide.quoted_fare)}</span>
              </div>
            </Card>
            <Card className="p-5 mb-4">
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={enableReview} onChange={(e) => setEnableReview(e.target.checked)} className="w-4 h-4 rounded accent-accent" />
                <span className="text-sm font-medium">Calificar este viaje</span>
              </label>
              {enableReview ? (
                <>
                  <div className="flex justify-center mb-4"><StarRating value={rating} onChange={setRating} size={32} /></div>
                  <div className="flex flex-wrap gap-2 mb-3 justify-center">
                    {["Puntual", "Conductor amable", "Viaje seguro", "Vehículo limpio", "Conducción suave", "Buena conversación"].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setRatingTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ratingTags.includes(tag) ? "bg-accent text-accent-foreground border-accent" : "bg-secondary text-muted-foreground border-border"}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <Input value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Comentario (opcional)" className="mb-3" />
                  <Button onClick={handleRate} disabled={rating === 0} className="w-full bear-gold-gradient text-foreground border-0">Enviar calificación</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center mb-3">Calificación deshabilitada para este viaje</p>
              )}
              <Button variant="outline" onClick={() => setShowFavoriteModal(true)} className="w-full mt-2 text-sm">
                <Star className="w-4 h-4 mr-2" />Guardar destino como favorito
              </Button>
              <Button variant="ghost" onClick={handlePostpone} className="w-full mt-2 text-sm">Cerrar y calificar después</Button>
            </Card>
          </div>
          <FavoriteModal
            open={showFavoriteModal}
            onClose={handleFavoriteClose}
            destination={activeRide.destination_lat ? { lat: activeRide.destination_lat, lng: activeRide.destination_lng, address: activeRide.destination_address } : null}
          />
        </>
      );
    }

    return (
      <div className="absolute inset-0">
        <MapView
          center={origin || userPos || FORMOSA_CENTER}
          origin={approachPhase ? routeOrigin : origin}
          destination={approachPhase ? origin : destination}
          showOriginMarker={!approachPhase}
          showDestinationMarker={true}
          originLabel={approachPhase ? "" : "Origen"}
          destinationLabel={approachPhase ? "Tu ubicación" : "Destino"}
          driverPos={driverPos}
          userPos={userPos}
          recenter={origin || userPos}
          interactive={true}
          markerAnimationDuration={approachPhase ? 3500 : 900}
          className="absolute inset-0"
        />
        {cardMinimized && !["SEARCHING", "NO_DRIVERS"].includes(status) && (
          <div className="absolute inset-x-0 bottom-0 z-10 p-3">
            <button
              onClick={() => setCardMinimized(false)}
              className="w-full max-w-md mx-auto flex items-center gap-3 p-3 rounded-2xl bg-card shadow-lg border"
            >
              <BearAvatar size={40} />
              <div className="flex-1 text-left min-w-0">
                <p className="font-bold text-sm truncate">{activeRide.driver_name || "Conductor"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {status === "DRIVER_APPROACHING"
                    ? "En camino a tu ubicación"
                    : status === "DRIVER_ARRIVED"
                    ? "Llegó al punto de encuentro"
                    : status === "IN_PROGRESS"
                    ? `En viaje hacia destino (${activeRide.duration_min || 5} min)`
                    : status === "ARRIVED"
                    ? "Llegaste a destino"
                    : status === "PAYMENT_PENDING"
                    ? "Pendiente de cobro"
                    : "Conductor asignado"}
                </p>
              </div>
              <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>
          </div>
        )}
        {!cardMinimized && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <Card className="rounded-2xl p-4 max-w-md mx-auto">
            {!["SEARCHING", "NO_DRIVERS"].includes(status) && (
              <button onClick={() => setCardMinimized(true)} className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground mb-2">
                <ChevronDown className="w-4 h-4" /> Minimizar
              </button>
            )}
            {activeRide.destination_address && (
              <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-border">
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-muted-foreground font-semibold uppercase tracking-wide">Destino</p>
                  <p className="text-sm font-bold truncate leading-tight">{displayAddress(activeRide.destination_address)}</p>
                </div>
              </div>
            )}
            {status === "SEARCHING" && (
              <div className="text-center py-2">
                <SearchingDriverAnimation size={240} />
                <p className="font-semibold">Conductores cercanos están verificando disponibilidad para aceptar tu viaje.</p>
                <p className="text-sm text-muted-foreground mt-1">Buscando conductor...</p>
                <Button variant="outline" onClick={() => setShowCancelDialog(true)} className="w-full mt-4 text-destructive">Cancelar viaje</Button>
              </div>
            )}
            {status === "NO_DRIVERS" && (
              <div className="text-center py-2">
                <X className="w-10 h-10 text-destructive mx-auto mb-3" />
                <p className="font-semibold">No hay conductores disponibles</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Probá nuevamente en unos minutos</p>
                <Button onClick={() => setActiveRide(null)} className="w-full bear-gold-gradient text-foreground border-0">Aceptar</Button>
              </div>
            )}
            {["ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING", "IN_PROGRESS"].includes(status) && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <BearAvatar size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base truncate">{activeRide.driver_name || "Conductor"}</p>
                    <div className="flex items-center gap-2 text-xs truncate">
                      <Star className="w-3.5 h-3.5 fill-accent text-accent shrink-0" />
                      <span>{user?.rating_avg || "5.0"}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground truncate">{activeRide.vehicle_model || ""}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium text-foreground">{activeRide.vehicle_plate || ""}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowChat(true)} className="w-10 h-10 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center no-select transition" aria-label="Chat con conductor"><MessageCircle className="w-5 h-5 text-accent" /></button>
                    <button onClick={handleShareTrip} className="w-10 h-10 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center no-select transition" aria-label="Compartir viaje"><Share2 className="w-5 h-5 text-accent" /></button>
                    <button onClick={() => setShowSosDialog(true)} className="w-10 h-10 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center no-select transition" aria-label="Asistencia de seguridad"><Shield className="w-5 h-5 text-accent" /></button>
                  </div>
                </div>

                {status === "IN_PROGRESS" && (
                  <div className="rounded-2xl bg-accent/10 border border-accent/30 p-3 my-3 space-y-1.5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                        <span className="text-xs font-bold text-accent uppercase tracking-wide">
                          En viaje hacia destino
                        </span>
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {activeRide.duration_min} min · {activeRide.distance_km} km
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                      <span>Tarifa: <strong className="text-accent font-bold">{formatPrice(activeRide.quoted_fare)}</strong></span>
                      <span className="capitalize">{activeRide.payment_method === "cash" ? "Efectivo" : activeRide.payment_method === "qr" ? "QR" : "Tarjeta"}</span>
                    </div>
                  </div>
                )}

                {activeRide.start_pin && ["ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING"].includes(status) && (
                  <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 text-center mb-3 shadow-inner">
                    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                      PIN de inicio de viaje
                    </p>
                    <div className="text-3xl font-extrabold tracking-[0.4em] font-mono text-accent">
                      {activeRide.start_pin}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {status === "DRIVER_ARRIVED"
                        ? "El conductor llegó al punto. Dictale este código para iniciar."
                        : "Dictale este código a tu conductor al subir al auto."}
                    </p>
                  </div>
                )}
                {status === "ASSIGNED" || status === "DRIVER_APPROACHING" ? (
                  <p className="text-center text-sm text-muted-foreground">{status === "DRIVER_APPROACHING" ? "Tu conductor está en camino" : "Conductor asignado, en camino..."}</p>
                ) : null}
                {["ASSIGNED", "DRIVER_APPROACHING", "WAITING"].includes(status) && (
                  <Button variant="outline" onClick={() => setShowCancelDialog(true)} className="w-full mt-3 text-destructive text-sm">Cancelar viaje</Button>
                )}
              </div>
            )}
            {["PIN_VALIDATION", "ARRIVED", "PAYMENT_PENDING"].includes(status) && (
              <div className="text-center py-2">
                {status === "ARRIVED" && <><CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-2" /><p className="font-semibold">Llegaste a destino</p></>}
                {status === "PAYMENT_PENDING" && <>
                  <Wallet className="w-10 h-10 text-accent mx-auto mb-2" />
                  <p className="font-semibold">Pago pendiente</p>
                  {activeRide.payment_method === "card" ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-muted-foreground">Procesando pago automático con tu tarjeta...</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Esperando confirmación
                      </div>
                      <button onClick={handleCardPayment} disabled={paying} className="text-xs text-muted-foreground underline mt-2">
                        ¿Problemas? Pagar manualmente
                      </button>
                    </div>
                  ) : activeRide.payment_method === "qr" ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">Escaneá el código dinámico del chofer o abrí tu app de pagos</p>
                      <Button
                        onClick={() => {
                          Haptics.medium();
                          handleQrPayment();
                        }}
                        disabled={paying}
                        className="w-full h-12 bear-gold-gradient text-foreground border-0 font-bold shadow-md"
                      >
                        {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Abriendo pasarela de pago...</> : <><QrCode className="w-4 h-4 mr-2" />Pagar ahora con QR / App de pagos</>}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground capitalize">Pagá en efectivo al conductor</p>
                  )}
                </>}
                {status === "PIN_VALIDATION" && <><Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-2" /><p className="font-semibold">Validando PIN...</p></>}
                <div className="mt-3 pt-3 border-t border-border text-left">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="font-bold text-accent">{formatPrice(activeRide.quoted_fare)}</span></div>
                </div>
              </div>
            )}
          </Card>
        </div>
        )}
        <CancelRideDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancel}
          isDriver={false}
        />
        <SosDialog
          open={showSosDialog}
          onOpenChange={setShowSosDialog}
          ride={activeRide}
          userPos={userPos}
        />
        {showChat && (
          <RideChat
            rideId={activeRide.id}
            userId={user.id}
            peerName={activeRide.driver_name}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>
    );
  }

  // Planning / quoting view
  return (
    <div className="absolute inset-0">
      <RideMapView
        userLocation={userPos || origin}
        userPos={userPos}
        center={origin || userPos || FORMOSA_CENTER}
        origin={origin}
        destination={destination}
        onMapClick={handleMapClick}
        recenter={origin || userPos}
        categoryFilter={category}
        className="absolute inset-0"
      />

      {/* Top header */}
      <div className="absolute inset-x-0 top-0 z-10 p-3">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl glass-navy">
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <Image src={BEAR_LOGO_SVG} alt="BearDrive" className="w-full h-full object-contain" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold text-white">Bear<span className="text-accent">Drive</span></p>
            <p className="text-[14px] text-white/60 mt-0.5">Formosa</p>
          </div>
        </div>
      </div>

      {/* Bottom panel with search + collapsibles + quote */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="max-w-md mx-auto relative">
        <button aria-label="Centrar en mi ubicación" onClick={handleGPS} className="absolute -top-14 right-0 w-12 h-12 rounded-full bg-card shadow-lg flex items-center justify-center hover:bg-secondary no-select">
          <Crosshair className="w-5 h-5 text-accent" />
        </button>
        <MapBottomSheet
          title={quote ? "Confirmá tu viaje" : "¿A dónde vamos?"}
          subtitle={quote ? "Revisá el recorrido y cómo vas a pagar" : "Elegí tu destino y revisá el punto de encuentro"}
          expanded={panelExpanded}
          onToggle={quote ? undefined : () => setPanelExpanded(value => !value)}
        >
          {quote ? (
            <div>
              <div className="rounded-xl bg-secondary/60 p-3 mb-4 space-y-2 text-sm"><p><span className="text-muted-foreground">Desde: </span>{displayAddress(originAddress, "Origen seleccionado")}</p><p><span className="text-muted-foreground">Hasta: </span>{displayAddress(destinationAddress, "Destino seleccionado")}</p></div>
              {(() => {
                const ptsDiscount = (usePoints && (user?.bear_points || 0) >= 50)
                  ? Math.min(Math.floor((user?.bear_points || 0) / 10) * 100, Math.floor(quote.price * 0.3))
                  : 0;
                const effectivePrice = Math.max(quote.price - ptsDiscount, 500);

                return (
                  <div className="text-center mb-3">
                    <p className="text-sm text-muted-foreground">Precio del viaje</p>
                    <button onClick={() => setShowBreakdown(!showBreakdown)} className="text-4xl font-extrabold text-accent inline-flex items-center gap-1">
                      {formatPrice(effectivePrice)}
                      {ptsDiscount > 0 && (
                        <span className="text-xs line-through text-muted-foreground ml-2 font-normal">
                          {formatPrice(quote.price)}
                        </span>
                      )}
                      <ChevronDown className={`w-5 h-5 transition-transform ${showBreakdown ? "rotate-180" : ""}`} />
                    </button>
                    <p className="text-xs text-muted-foreground mt-1">{quote.distance_km} km · {quote.duration_min} min</p>
                    {quote.surge_multiplier > 1 && (
                      <p className="text-xs font-bold text-orange-500 mt-1">⚡ Demanda alta · x{quote.surge_multiplier}</p>
                    )}
                  </div>
                );
              })()}
              {showBreakdown && quote.breakdown && (
                <div className="mb-4 p-3 rounded-xl bg-secondary/50 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Tarifa base</span><span>{formatPrice(quote.breakdown.base)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Distancia</span><span>{formatPrice(quote.breakdown.distance)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tiempo</span><span>{formatPrice(quote.breakdown.time)}</span></div>
                  {Math.abs(quote.breakdown.category_adjustment) > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Ajuste de categoría</span><span>{formatPrice(quote.breakdown.category_adjustment)}</span></div>
                  )}
                  {quote.breakdown.surge > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Demanda alta</span><span className="text-orange-500">{formatPrice(quote.breakdown.surge)}</span></div>
                  )}
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold"><span>Total</span><span className="text-accent">{formatPrice(quote.price)}</span></div>
                </div>
              )}
              {/* Categories with ETA, Price & Badges */}
              <div className="flex gap-2 mb-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      Haptics.light();
                      setCategory(c.code);
                    }}
                    className={`relative flex-1 p-2.5 rounded-xl text-center transition-all ${
                      category === c.code
                        ? "bear-gradient text-white shadow-md scale-[1.02]"
                        : "bg-secondary/70 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {c.badge && (
                      <span className="absolute -top-2 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-accent text-accent-foreground shadow-sm">
                        {c.badge}
                      </span>
                    )}
                    <p className="text-xs font-bold leading-tight">{c.name}</p>
                    <p className="text-[11px] text-accent font-semibold">{c.eta}</p>
                    <p className="text-[10px] opacity-75 truncate">{c.desc}</p>
                  </button>
                ))}
              </div>

              {/* BearPoints Immediate Discount Toggle */}
              {user?.bear_points > 0 && (
                <div className="mb-3 p-2.5 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Usar BearPoints</p>
                      <p className="text-[11px] text-muted-foreground">
                        Tenés {user.bear_points} pts disponibles (-${Math.min(Math.floor(user.bear_points / 10) * 100, Math.floor(quote.price * 0.3))} OFF)
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={usePoints}
                    onChange={(e) => {
                      Haptics.light();
                      setUsePoints(e.target.checked);
                    }}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => {
                    Haptics.light();
                    setPaymentMethod("cash");
                  }}
                  className={`flex-1 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                    paymentMethod === "cash"
                      ? "bear-gold-gradient text-foreground font-bold"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Banknote className="w-4 h-4" />Efectivo
                </button>
                <button
                  onClick={() => {
                    Haptics.light();
                    setPaymentMethod("qr");
                  }}
                  className={`flex-1 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                    paymentMethod === "qr"
                      ? "bear-gold-gradient text-foreground font-bold"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <QrCode className="w-4 h-4" />QR
                </button>
                <button
                  onClick={() => {
                    Haptics.light();
                    setPaymentMethod("card");
                  }}
                  className={`flex-1 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                    paymentMethod === "card"
                      ? "bear-gold-gradient text-foreground font-bold"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />Tarjeta
                </button>
              </div>

              {/* Cash Options: Change requirement */}
              {paymentMethod === "cash" && (
                <div className="mb-3 p-2.5 rounded-xl bg-secondary/50 space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    ¿Con cuánto abonás? (para cambio)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "exact", label: "Pago justo" },
                      { id: "5000", label: "$5.000" },
                      { id: "10000", label: "$10.000" },
                      { id: "20000", label: "$20.000" },
                      { id: "change", label: "Necesito cambio" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          Haptics.light();
                          setCashNoteOption(opt.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          cashNoteOption === opt.id
                            ? "bg-accent text-accent-foreground font-bold shadow-sm"
                            : "bg-card border border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pickup Reference Input */}
              <div className="mb-3">
                <Input
                  value={pickupReference}
                  onChange={(e) => setPickupReference(e.target.value)}
                  placeholder="Referencia de recogida (ej. rejas blancas, frente al kiosco)"
                  className="h-10 text-xs bg-secondary/40 border-border/70"
                  maxLength={100}
                />
              </div>
              {paymentMethod === "card" && (
                <div className="mb-4 p-3 rounded-xl bg-secondary/50">
                  {savedCard ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-accent" />
                        <div>
                          <p className="text-sm font-medium capitalize">{savedCard.brand} ·· {savedCard.last4}</p>
                          <p className="text-xs text-muted-foreground">Venc: {String(savedCard.exp_month).padStart(2, "0")}/{String(savedCard.exp_year).slice(-2)}</p>
                        </div>
                      </div>
                      <button onClick={handleLinkCard} className="text-xs text-accent font-medium">Cambiar</button>
                    </div>
                  ) : (
                    <button onClick={handleLinkCard} disabled={linkingCard} className="w-full flex items-center justify-center gap-2 text-sm font-medium text-accent">
                      {linkingCard ? <><Loader2 className="w-4 h-4 animate-spin" />Vinculando...</> : <><CreditCard className="w-4 h-4" />Vincular tarjeta</>}
                    </button>
                  )}
                </div>
              )}
              <Button onClick={handleRequestRide} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">
                Solicitar viaje
              </Button>
              <Button variant="ghost" onClick={() => setQuote(null)} className="w-full text-sm mt-1">Cambiar destino</Button>
            </div>
          ) : (
            <div>
              <div className="flex gap-2 mb-3" role="group" aria-label="Elegir punto del recorrido">
                {[['origin', 'Origen'], ['destination', 'Destino']].map(([target, label]) => <button type="button" key={target} disabled={geocoding} aria-pressed={selectingTarget === target} onClick={() => chooseTarget(target)} className={`flex-1 min-h-12 rounded-xl text-sm font-semibold border ${selectingTarget === target ? 'border-accent bg-accent/10' : 'border-border text-muted-foreground'}`}>{label}</button>)}
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  aria-label={selectingTarget === "origin" ? "Buscar origen" : "Buscar destino"}
                  autoComplete="off"
                  disabled={geocoding}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setPanelExpanded(true)}
                  placeholder={selectingTarget === "origin" ? "Buscar origen..." : "¿A dónde vas?"}
                  className="pl-10 pr-12 h-12"
                />
                {panelExpanded && !searchingPlace && !geocoding ? (
                  <button aria-label="Mostrar más mapa" onClick={() => setPanelExpanded(false)} className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                ) : (searchingPlace || geocoding) ? (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                ) : null}
              </div>
              {panelExpanded && (
                <>
              {searchQuery.trim().length >= 3 && !searchingPlace && !geocoding && searchResults.length === 0 && <p role="status" className="text-sm text-muted-foreground rounded-xl bg-secondary p-3 mb-3">{searchError ? "No pudimos buscar lugares. Cambiá el texto para volver a intentar." : "No encontramos ese lugar. Probá con una calle, altura o punto conocido."}</p>}
              {searchResults.length > 0 && (
                <div className="mb-3 max-h-48 overflow-y-auto rounded-xl border border-border">
                  {searchResults.map((r, i) => (
                    <button key={i} disabled={geocoding} onClick={() => handleSelectPlace(r)} className="w-full text-left p-3 hover:bg-secondary/50 border-b border-border last:border-0">
                      <p className="text-sm font-medium truncate">{r.main_text}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.secondary_text || r.label}</p>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.length === 0 && searchQuery.trim().length < 2 && (
                <div className="mb-3 space-y-2.5">
                  <FavoritesBar onSelect={handleSelectFavorite} />
                  {/* Formosa Landmark Chips */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                      Puntos populares en Formosa
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                      {FORMOSA_POIS.slice(0, 6).map((poi) => (
                        <button
                          key={poi.name}
                          type="button"
                          onClick={() => {
                            Haptics.light();
                            if (selectingTarget === "origin") {
                              setOrigin({ lat: poi.lat, lng: poi.lng });
                              setOriginAddress(`${poi.name} (${poi.address})`);
                            } else {
                              setDestination({ lat: poi.lat, lng: poi.lng });
                              setDestinationAddress(`${poi.name} (${poi.address})`);
                            }
                            setSearchQuery("");
                          }}
                          className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary/80 hover:bg-accent/15 hover:border-accent border border-border/80 text-foreground transition active:scale-95"
                        >
                          {poi.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-2">
                <button
                  onClick={() => { setOriginExpanded(!originExpanded); chooseTarget("origin"); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${selectingTarget === "origin" ? "border-accent bg-accent/5" : "border-border bg-secondary/50"}`}
                >
                  <span className="w-3 h-3 rounded-full bg-foreground shrink-0" />
                  <span className="text-sm text-left flex-1 truncate">{originAddress ? displayAddress(originAddress) : "Mi ubicación"}</span>
                  {originExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
                {originExpanded && (
                  <div className="mt-1 flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleGPS} className="flex-1">
                      <Crosshair className="w-3.5 h-3.5 mr-1" />Usar ubicación actual
                    </Button>
                  </div>
                )}
              </div>

              <div className="mb-2">
                <button
                  onClick={() => { setDestExpanded(!destExpanded); chooseTarget("destination"); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${selectingTarget === "destination" ? "border-accent bg-accent/5" : "border-border bg-secondary/50"}`}
                >
                  <span className="w-3 h-3 rounded-full bg-accent shrink-0" />
                  <span className="text-sm text-left flex-1 truncate">{destinationAddress ? displayAddress(destinationAddress) : "Elegí destino"}</span>
                  {destination && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                  {destExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              </div>

              <div className="mb-3">
                <button
                  onClick={() => setPaymentExpanded(!paymentExpanded)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/50 transition-colors"
                >
                  {paymentMethod === "card" && <CreditCard className="w-4 h-4 text-accent shrink-0" />}
                  {paymentMethod === "cash" && <Banknote className="w-4 h-4 text-accent shrink-0" />}
                  {paymentMethod === "qr" && <QrCode className="w-4 h-4 text-accent shrink-0" />}
                  <span className="text-sm text-left flex-1">{paymentMethod === "card" ? "Tarjeta" : paymentMethod === "cash" ? "Efectivo" : "QR"}</span>
                  {paymentExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
                {paymentExpanded && (
                  <div className="mt-1 flex gap-2">
                    <button onClick={() => setPaymentMethod("cash")} className={`flex-1 p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${paymentMethod === "cash" ? "bear-gold-gradient text-foreground" : "bg-secondary text-muted-foreground"}`}>
                      <Banknote className="w-4 h-4" />Efectivo
                    </button>
                    <button onClick={() => setPaymentMethod("qr")} className={`flex-1 p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${paymentMethod === "qr" ? "bear-gold-gradient text-foreground" : "bg-secondary text-muted-foreground"}`}>
                      <QrCode className="w-4 h-4" />QR
                    </button>
                    <button onClick={() => setPaymentMethod("card")} className={`flex-1 p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${paymentMethod === "card" ? "bear-gold-gradient text-foreground" : "bg-secondary text-muted-foreground"}`}>
                      <CreditCard className="w-4 h-4" />Tarjeta
                    </button>
                  </div>
                )}
              </div>

              {(!origin || !destination) && <p className="text-xs text-muted-foreground py-2">{!origin ? "Seleccioná el origen o usá tu ubicación actual." : "Elegí el destino para consultar el precio."}</p>}
              {origin && destination && (
                <Button onClick={handleQuote} disabled={quoteLoading} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">
                  {quoteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cotizando...</> : "Ver precio del viaje"}
                </Button>
              )}
                </>
              )}
            </div>
          )}
        </MapBottomSheet>
        </div>
      </div>
    </div>
  );
}