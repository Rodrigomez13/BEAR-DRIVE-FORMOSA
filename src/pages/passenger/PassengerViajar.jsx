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
import { searchPlaces, geocodePlace, reverseGeocode, getCurrentPosition, FORMOSA_CENTER } from "@/lib/geo";
import { Navigation, MapPin, Search, Crosshair, Loader2, Car, Star, Phone, Shield, X, CheckCircle2, Wallet, QrCode, Banknote } from "lucide-react";

const CATEGORIES = [
  { code: "basic", name: "BearDrive", desc: "Servicio estándar" },
  { code: "flash", name: "BearFlash", desc: "Prioridad alta" },
  { code: "premium", name: "BearPremium", desc: "Gama superior" },
];

const ACTIVE_STATUSES = ["SEARCHING", "ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING", "PIN_VALIDATION", "IN_PROGRESS", "ARRIVED", "PAYMENT_PENDING", "COMPLETED"];

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
  const pollRef = useRef(null);

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
      } catch (err) {
        // ignore
      }
    };
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRide?.id]);

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
        passenger_name: user.full_name || user.email,
        status: "SEARCHING",
        origin_address: originAddress,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_address: destinationAddress,
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
  };

  const formatPrice = (v) => `$${(v || 0).toLocaleString("es-AR")}`;

  // ---- RENDER STATES ----

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  // Active ride view
  if (activeRide) {
    const status = activeRide.status;

    if (status === "COMPLETED") {
      return (
        <>
          <div className="max-w-md mx-auto px-5 pt-10 pb-10">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold">¡Viaje completado!</h1>
            </div>
            <Card className="p-5 mb-4 space-y-3">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Origen</span><span className="text-sm font-medium text-right truncate ml-3">{activeRide.origin_address}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Destino</span><span className="text-sm font-medium text-right truncate ml-3">{activeRide.destination_address}</span></div>
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
              <p className="font-semibold mb-3 text-center">Calificá a tu conductor</p>
              <div className="flex justify-center mb-4"><StarRating value={rating} onChange={setRating} size={32} /></div>
              <Input value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Comentario (opcional)" className="mb-3" />
              <Button onClick={handleRate} disabled={rating === 0} className="w-full bear-gold-gradient text-foreground border-0">Enviar calificación</Button>
              <Button variant="ghost" onClick={handleSkipRating} className="w-full mt-2 text-sm">Omitir</Button>
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
      <div className="relative h-screen">
        <MapView
          origin={origin}
          destination={destination}
          recenter={origin}
          interactive={false}
          className="absolute inset-0"
        />
        <div className="absolute inset-x-0 bottom-0 z-10">
          <Card className="mx-3 mb-3 rounded-2xl p-5 max-w-md mx-auto">
            {status === "SEARCHING" && (
              <div className="text-center py-2">
                <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-3" />
                <p className="font-semibold">Conductores cercanos están verificando disponibilidad para aceptar tu viaje.</p>
                <p className="text-sm text-muted-foreground mt-1">Buscando conductor...</p>
                <Button variant="outline" onClick={handleCancel} className="w-full mt-4 text-destructive">Cancelar viaje</Button>
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
                  <div className="w-12 h-12 rounded-full bear-gradient flex items-center justify-center text-accent font-bold text-lg">
                    {(activeRide.driver_name || "C").charAt(0)}
                  </div>
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
                <Button variant="outline" onClick={handleCancel} className="w-full mt-3 text-destructive text-sm">Cancelar viaje</Button>
              </div>
            )}
            {["PIN_VALIDATION", "IN_PROGRESS", "ARRIVED", "PAYMENT_PENDING"].includes(status) && (
              <div className="text-center py-2">
                {status === "IN_PROGRESS" && <><Car className="w-10 h-10 text-accent mx-auto mb-2" /><p className="font-semibold">En viaje</p><p className="text-sm text-muted-foreground">Llegando a destino...</p></>}
                {status === "ARRIVED" && <><CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-2" /><p className="font-semibold">Llegaste a destino</p></>}
                {status === "PAYMENT_PENDING" && <><Wallet className="w-10 h-10 text-accent mx-auto mb-2" /><p className="font-semibold">Pago pendiente</p><p className="text-sm text-muted-foreground capitalize">{activeRide.payment_method === "cash" ? "Pagá en efectivo al conductor" : "Escaneá el QR del conductor"}</p></>}
                {status === "PIN_VALIDATION" && <><Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-2" /><p className="font-semibold">Validando PIN...</p></>}
                <div className="mt-3 pt-3 border-t border-border text-left">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="font-bold text-accent">{formatPrice(activeRide.quoted_fare)}</span></div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Planning / quoting view
  return (
    <div className="relative h-screen">
      <MapView
        origin={origin}
        destination={destination}
        onMapClick={handleMapClick}
        recenter={origin || (destination ? null : null)}
        className="absolute inset-0"
      />

      {/* Top search bar */}
      <div className="absolute inset-x-0 top-0 z-10 p-3">
        <Card className="rounded-2xl p-3 max-w-md mx-auto">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setSelectingTarget("origin")}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${selectingTarget === "origin" ? "bear-gradient text-white" : "bg-secondary text-muted-foreground"}`}
            >
              <MapPin className="w-3 h-3 inline mr-1" />Origen
            </button>
            <button
              onClick={() => setSelectingTarget("destination")}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${selectingTarget === "destination" ? "bear-gradient text-white" : "bg-secondary text-muted-foreground"}`}
            >
              <Navigation className="w-3 h-3 inline mr-1" />Destino
            </button>
          </div>
          <div className="relative">
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
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border">
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => handleSelectPlace(r)} className="w-full text-left p-3 hover:bg-secondary/50 border-b border-border last:border-0">
                  <p className="text-sm font-medium truncate">{r.label.split(",")[0]}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.label}</p>
                </button>
              ))}
            </div>
          )}
          {searchResults.length === 0 && searchQuery.trim().length < 3 && (
            <div className="mt-2">
              <FavoritesBar onSelect={handleSelectFavorite} />
            </div>
          )}
          {(originAddress || destinationAddress) && (
            <div className="mt-2 space-y-1.5 text-xs">
              {originAddress && <p className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-foreground shrink-0" />{originAddress.split(",")[0]}</p>}
              {destinationAddress && <p className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-accent shrink-0" />{destinationAddress.split(",")[0]}</p>}
            </div>
          )}
        </Card>
      </div>

      {/* GPS button */}
      <button onClick={handleGPS} className="absolute right-4 top-44 z-10 w-12 h-12 rounded-full bg-card shadow-lg flex items-center justify-center hover:bg-secondary">
        <Crosshair className="w-5 h-5 text-accent" />
      </button>

      {/* Bottom panel */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-3 pb-24">
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
                <button onClick={() => setPaymentMethod("cash")} className={`flex-1 p-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors ${paymentMethod === "cash" ? "bear-gold-gradient text-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <Banknote className="w-4 h-4" />Efectivo
                </button>
                <button onClick={() => setPaymentMethod("qr")} className={`flex-1 p-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors ${paymentMethod === "qr" ? "bear-gold-gradient text-foreground" : "bg-secondary text-muted-foreground"}`}>
                  <QrCode className="w-4 h-4" />QR
                </button>
              </div>
              <Button onClick={handleRequestRide} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">
                Solicitar viaje
              </Button>
              <Button variant="ghost" onClick={() => setQuote(null)} className="w-full text-sm mt-1">Cambiar destino</Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground text-center mb-3">
                {origin && destination ? "Listo para cotizar" : "Elegí origen y destino en el mapa o buscá un lugar arriba"}
              </p>
              <Button
                onClick={handleQuote}
                disabled={!origin || !destination || quoteLoading}
                className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold"
              >
                {quoteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cotizando...</> : "Cotizar viaje"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}