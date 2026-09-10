import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import MapView from "@/components/bear/MapView";
import StarRating from "@/components/bear/StarRating";
import FavoriteModal from "@/components/bear/FavoriteModal";
import FavoritesBar from "@/components/bear/FavoritesBar";
import { searchPlaces, geocodePlace, reverseGeocode, getCurrentPosition, FORMOSA_CENTER, displayAddress } from "@/lib/geo";
import CancelRideDialog from "@/components/bear/CancelRideDialog";
import { useActiveRideGuard } from "@/hooks/useActiveRideGuard";
import { sanitizeString } from "@/lib/sanitize";
import BearAvatar from "@/components/bear/BearAvatar";
import { Navigation, MapPin, Search, Crosshair, Loader2, Car, Star, Phone, Shield, X, CheckCircle2, Wallet, QrCode, Banknote, CreditCard, ChevronUp, ChevronDown } from "lucide-react";
import { Image } from "@/components/ui/image";
import { BEAR_LOGO_MARK } from "@/lib/brandAssets";

const CATEGORIES = [
  { code: "basic", name: "BearDrive", desc: "Servicio estándar" },
  { code: "flash", name: "BearFlash", desc: "Prioridad alta" },
  { code: "premium", name: "BearPremium", desc: "Gama superior" },
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
  const [geocoding, setGeocoding] = useState(false);
  const [selectingTarget, setSelectingTarget] = useState("destination");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [category, setCategory] = useState("basic");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [paying, setPaying] = useState(false);
  const [driverPos, setDriverPos] = useState(null);
  const [enableReview, setEnableReview] = useState(true);
  const [originExpanded, setOriginExpanded] = useState(false);
  const [destExpanded, setDestExpanded] = useState(true);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const pollRef = useRef(null);

  // Handle Stripe redirect return
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
  }, []);

  // Recover active ride on mount
  useEffect(() => {
    const recover = async () => {
      try {
        const rides = await base44.entities.Ride.filter({ passenger_id: user.id, status: { $in: ACTIVE_STATUSES } }, "-created_date", 1);
        if (rides.length > 0) {
          setActiveRide(rides[0]);
          if (rides[0].origin_lat) setOrigin({ lat: rides[0].origin_lat, lng: rides[0].origin_lng });
          if (rides[0].destination_lat) setDestination({ lat: rides[0].destination_lat, lng: rides[0].destination_lng });
          setOriginAddress(rides[0].origin_address || "");
          setDestinationAddress(rides[0].destination_address || "");
        } else {
          try {
            const pos = await getCurrentPosition();
            setOrigin(pos);
            const addr = await reverseGeocode(pos.lat, pos.lng);
            setOriginAddress(addr);
          } catch (err) { /* ignore */ }
        }
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    recover();
  }, [user]);

  // Poll active ride
  useEffect(() => {
    if (!activeRide) return;
    const poll = async () => {
      try {
        const updated = await base44.entities.Ride.get(activeRide.id);
        if (updated) setActiveRide(updated);
        if (updated?.driver_id) {
          const locs = await base44.entities.DriverLocation.filter({ driver_id: updated.driver_id });
          if (locs.length > 0) setDriverPos({ lat: locs[0].lat, lng: locs[0].lng });
        }
      } catch (err) {
        // ignore
      }
    };
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRide?.id]);

  // Guard against closing app during active ride
  useActiveRideGuard(!!activeRide);

  // GPS
  const handleGPS = async () => {
    try {
      const pos = await getCurrentPosition();
      setOrigin(pos);
      const addr = await reverseGeocode(pos.lat, pos.lng);
      setOriginAddress(addr);
    } catch (err) {
      toast({ title: "No pudimos obtener tu ubicación", variant: "destructive" });
    }
  };

  // Instant place search — predictions only, no geocoding delay
  useEffect(() => {
    if (searchQuery.trim().length < 3) { setSearchResults([]); return; }
    setSearchingPlace(true);
    const t = setTimeout(async () => {
      const results = await searchPlaces(searchQuery);
      setSearchResults(results);
      setSearchingPlace(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSelectPlace = async (place) => {
    setSearchQuery("");
    setSearchResults([]);
    setGeocoding(true);
    try {
      const geo = await geocodePlace(place.place_id);
      if (!geo) { toast({ title: "No se pudo obtener la ubicación", variant: "destructive" }); return; }
      if (selectingTarget === "origin") {
        setOrigin({ lat: geo.lat, lng: geo.lng });
        setOriginAddress(geo.label);
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

  // Quote
  const handleQuote = async () => {
    if (!origin || !destination) {
      toast({ title: "Elegí origen y destino", variant: "destructive" });
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await base44.functions.invoke("calculateQuote", {
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
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    try {
      const ride = await base44.entities.Ride.create({
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
        quoted_fare: quote.price,
        distance_km: quote.distance_km,
        duration_min: quote.duration_min,
        start_pin: pin,
        quote_data: JSON.stringify(quote),
      });
      setActiveRide(ride);
      setQuote(null);
      toast({ title: "Viaje solicitado", description: "Buscando conductores cercanos..." });
    } catch (err) {
      toast({ title: "No se pudo solicitar el viaje", description: err.message, variant: "destructive" });
    }
  };

  // Cancel ride
  const handleCancel = async () => {
    if (!activeRide) return;
    try {
      await base44.entities.Ride.update(activeRide.id, { status: "CANCELLED", cancelled_date: new Date().toISOString(), cancel_reason: "passenger_cancelled" });
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
      await base44.functions.invoke("rateRide", { ride_id: activeRide.id, score: rating, comment: ratingComment });
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
    setEnableReview(true);
    setDriverPos(null);
  };

  const handlePostpone = () => {
    setActiveRide(null);
    setRating(0);
    setRatingComment("");
    setEnableReview(true);
    setDriverPos(null);
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
      const res = await base44.functions.invoke("createRidePayment", { ride_id: activeRide.id });
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

  const formatPrice = (v) => `$${(v || 0).toLocaleString("es-AR")}`;

  // ---- RENDER STATES ----

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  // Active ride view
  if (activeRide) {
    const status = activeRide.status;

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
          origin={origin}
          destination={destination}
          driverPos={driverPos}
          recenter={driverPos || origin}
          interactive={false}
          className="absolute inset-0"
        />
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <Card className="rounded-2xl p-4 max-w-md mx-auto">
            {status === "SEARCHING" && (
              <div className="text-center py-2">
                <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-3" />
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
            {["ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING"].includes(status) && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <BearAvatar size={48} />
                  <div className="flex-1">
                    <p className="font-semibold">{activeRide.driver_name || "Conductor"}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                      <span>{user?.rating_avg || "5.0"}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{activeRide.vehicle_model || ""}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium">{activeRide.vehicle_plate || ""}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center"><Phone className="w-5 h-5 text-accent" /></button>
                    <button className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center"><Shield className="w-5 h-5 text-accent" /></button>
                  </div>
                </div>
                {status === "DRIVER_ARRIVED" && (
                  <div className="bg-accent/10 rounded-xl p-4 text-center mb-3">
                    <p className="text-sm text-muted-foreground mb-1">Tu conductor llegó. Compartile este PIN:</p>
                    <p className="text-3xl font-extrabold tracking-[0.5em] text-accent">{activeRide.start_pin}</p>
                  </div>
                )}
                {status === "ASSIGNED" || status === "DRIVER_APPROACHING" ? (
                  <p className="text-center text-sm text-muted-foreground">{status === "DRIVER_APPROACHING" ? "Tu conductor está en camino" : "Conductor asignado, en camino..."}</p>
                ) : null}
                <Button variant="outline" onClick={() => setShowCancelDialog(true)} className="w-full mt-3 text-destructive text-sm">Cancelar viaje</Button>
              </div>
            )}
            {["PIN_VALIDATION", "IN_PROGRESS", "ARRIVED", "PAYMENT_PENDING"].includes(status) && (
              <div className="text-center py-2">
                {status === "IN_PROGRESS" && <><Car className="w-10 h-10 text-accent mx-auto mb-2" /><p className="font-semibold">En viaje</p><p className="text-sm text-muted-foreground">Llegando a destino...</p></>}
                {status === "ARRIVED" && <><CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-2" /><p className="font-semibold">Llegaste a destino</p></>}
                {status === "PAYMENT_PENDING" && <>
                  <Wallet className="w-10 h-10 text-accent mx-auto mb-2" />
                  <p className="font-semibold">Pago pendiente</p>
                  {activeRide.payment_method === "card" ? (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">Pagá con tarjeta para completar el viaje</p>
                      <Button onClick={handleCardPayment} disabled={paying} className="w-full bear-gold-gradient text-foreground border-0 font-semibold">
                        {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : <><CreditCard className="w-4 h-4 mr-2" />Pagar con tarjeta</>}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground capitalize">{activeRide.payment_method === "cash" ? "Pagá en efectivo al conductor" : "Escaneá el QR del conductor"}</p>
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
        <CancelRideDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancel}
          isDriver={false}
        />
      </div>
    );
  }

  // Planning / quoting view
  return (
    <div className="absolute inset-0">
      <MapView
        origin={origin}
        destination={destination}
        onMapClick={handleMapClick}
        recenter={origin || (destination ? null : null)}
        className="absolute inset-0"
      />

      {/* Top header */}
      <div className="absolute inset-x-0 top-0 z-10 p-3 safe-top">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl glass-navy">
          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
            <Image src={BEAR_LOGO_MARK} fittingType="fit" className="block w-full h-full" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold text-white">Bear<span className="text-accent">Drive</span></p>
            <p className="text-[10px] text-white/60 mt-0.5">Formosa</p>
          </div>
        </div>
      </div>

      {/* GPS button */}
      <button onClick={handleGPS} className="absolute right-4 bottom-[420px] z-10 w-11 h-11 rounded-full bg-card shadow-lg flex items-center justify-center hover:bg-secondary">
        <Crosshair className="w-5 h-5 text-accent" />
      </button>

      {/* Bottom panel with search + collapsibles + quote */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
        <Card className="rounded-2xl p-4 max-w-md mx-auto">
          {quote ? (
            <div>
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Precio del viaje</p>
                <p className="text-4xl font-extrabold text-accent">{formatPrice(quote.price)}</p>
                <p className="text-xs text-muted-foreground mt-1">{quote.distance_km} km · {quote.duration_min} min</p>
              </div>
              <div className="flex gap-2 mb-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCategory(c.code)}
                    className={`flex-1 p-2.5 rounded-xl text-center transition-colors ${category === c.code ? "bear-gradient text-white" : "bg-secondary text-muted-foreground"}`}
                  >
                    <p className="text-xs font-semibold">{c.name}</p>
                    <p className="text-[10px] opacity-70">{c.desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setPaymentMethod("cash")} className={`flex-1 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${paymentMethod === "cash" ? "bear-gold-gradient text-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <Banknote className="w-4 h-4" />Efectivo
                </button>
                <button onClick={() => setPaymentMethod("qr")} className={`flex-1 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${paymentMethod === "qr" ? "bear-gold-gradient text-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <QrCode className="w-4 h-4" />QR
                </button>
                <button onClick={() => setPaymentMethod("card")} className={`flex-1 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${paymentMethod === "card" ? "bear-gold-gradient text-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <CreditCard className="w-4 h-4" />Tarjeta
                </button>
              </div>
              <Button onClick={handleRequestRide} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">
                Solicitar viaje
              </Button>
              <Button variant="ghost" onClick={() => setQuote(null)} className="w-full text-sm mt-1">Cambiar destino</Button>
            </div>
          ) : (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={selectingTarget === "origin" ? "Buscar origen..." : "¿A dónde vas?"}
                  className="pl-10 h-11"
                />
                {(searchingPlace || geocoding) && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />}
              </div>
              {searchResults.length > 0 && (
                <div className="mb-3 max-h-48 overflow-y-auto rounded-xl border border-border">
                  {searchResults.map((r, i) => (
                    <button key={i} onClick={() => handleSelectPlace(r)} className="w-full text-left p-3 hover:bg-secondary/50 border-b border-border last:border-0">
                      <p className="text-sm font-medium truncate">{r.main_text}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.secondary_text || r.label}</p>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.length === 0 && searchQuery.trim().length < 3 && (
                <div className="mb-3">
                  <FavoritesBar onSelect={handleSelectFavorite} />
                </div>
              )}

              <div className="mb-2">
                <button
                  onClick={() => { setOriginExpanded(!originExpanded); setSelectingTarget("origin"); }}
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
                  onClick={() => { setDestExpanded(!destExpanded); setSelectingTarget("destination"); }}
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

              {origin && destination ? (
                <Button onClick={handleQuote} disabled={quoteLoading} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">
                  {quoteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cotizando...</> : "Cotizar viaje"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {origin ? "Elegí destino para cotizar" : "Activa tu ubicación para empezar"}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}