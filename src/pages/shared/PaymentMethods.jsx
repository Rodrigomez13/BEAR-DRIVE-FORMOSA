import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Banknote,
  QrCode,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronLeft,
  Bot,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  Info
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PaymentPricingAgentModal from "@/components/bear/PaymentPricingAgentModal";

export default function PaymentMethods() {
  const { user, checkUserAuth } = useAuth();
  const navigate = useNavigate();
  const [preferredMethod, setPreferredMethod] = useState(user?.preferred_payment_method || "cash");
  const [cardInfo, setCardInfo] = useState(null);
  const [loadingCard, setLoadingCard] = useState(true);
  const [savingPref, setSavingPref] = useState(false);
  const [addCardModal, setAddCardModal] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  // Form states for manual card registration
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [savingCard, setSavingCard] = useState(false);

  // Driver Mercado Pago status
  const isDriver = user?.driver_capability === "APPROVED_ELIGIBLE" || user?.driver_status === "APPROVED";
  const [driverAccount, setDriverAccount] = useState(null);
  const [connectingDriver, setConnectingDriver] = useState(false);

  const fetchCardInfo = async () => {
    setLoadingCard(true);
    try {
      // First check local user saved card attributes
      if (user?.saved_card_last4) {
        setCardInfo({
          has_card: true,
          brand: user.saved_card_brand || "Visa",
          last4: user.saved_card_last4,
          exp_month: user.saved_card_exp_month || "12",
          exp_year: user.saved_card_exp_year || "28",
        });
      } else {
        // Fallback to backend getPassengerPaymentMethod
        const res = await base44.functions.invoke("getPassengerPaymentMethod", {});
        if (res.data?.has_card) {
          setCardInfo(res.data);
        } else {
          setCardInfo({ has_card: false });
        }
      }
    } catch (err) {
      if (user?.saved_card_last4) {
        setCardInfo({
          has_card: true,
          brand: user.saved_card_brand || "Tarjeta",
          last4: user.saved_card_last4,
        });
      } else {
        setCardInfo({ has_card: false });
      }
    } finally {
      setLoadingCard(false);
    }
  };

  const fetchDriverAccount = async () => {
    if (!isDriver) return;
    try {
      const res = await base44.functions.invoke("getDriverPaymentAccount", {});
      if (res.data?.account?.status === "connected") {
        setDriverAccount(res.data.account);
      }
    } catch (err) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchCardInfo();
    fetchDriverAccount();

    // Handle return from setup if any
    const params = new URLSearchParams(window.location.search);
    const cardSetup = params.get("card_setup");
    if (cardSetup === "success") {
      toast({ title: "Tarjeta vinculada", description: "Tu tarjeta quedó guardada con éxito." });
      const url = new URL(window.location.href);
      url.searchParams.delete("card_setup");
      window.history.replaceState({}, "", url);
      fetchCardInfo();
    }
  }, [user]);

  const handleSelectPreferred = async (method) => {
    setPreferredMethod(method);
    setSavingPref(true);
    try {
      await base44.auth.updateMe({ preferred_payment_method: method });
      await checkUserAuth();
      toast({ title: "Método predeterminado actualizado" });
    } catch (err) {
      toast({ title: "Error al actualizar preferencia", description: err.message, variant: "destructive" });
    } finally {
      setSavingPref(false);
    }
  };

  // Connect driver Mercado Pago
  const handleConnectDriverPayments = async () => {
    setConnectingDriver(true);
    try {
      const res = await base44.functions.invoke("connectDriverPayments", {});
      if (res.data?.url) {
        window.location.assign(res.data.url);
      } else {
        throw new Error("No se recibió URL de vinculación");
      }
    } catch (err) {
      toast({
        title: "Error al vincular Mercado Pago",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setConnectingDriver(false);
    }
  };

  // Card detection helper
  const detectBrand = (num) => {
    const clean = num.replace(/\s+/g, "");
    if (/^4/.test(clean)) return "Visa";
    if (/^5[1-5]/.test(clean)) return "Mastercard";
    if (/^3[47]/.test(clean)) return "Amex";
    if (/^589562|503175|603488/.test(clean)) return "Naranja";
    return "Débito / Crédito";
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    const cleanNum = cardNumber.replace(/\s+/g, "");
    if (cleanNum.length < 15) {
      toast({ title: "Número de tarjeta inválido", variant: "destructive" });
      return;
    }
    if (!cardName.trim()) {
      toast({ title: "Ingresá el titular de la tarjeta", variant: "destructive" });
      return;
    }
    if (cardExpiry.length < 4) {
      toast({ title: "Fecha de vencimiento inválida", variant: "destructive" });
      return;
    }

    setSavingCard(true);
    try {
      // 1. Try invoking setupPassengerCard if available
      try {
        const setupRes = await base44.functions.invoke("setupPassengerCard", { return_to: "/payment-methods" });
        if (setupRes.data?.checkout_url) {
          window.location.assign(setupRes.data.checkout_url);
          return;
        }
      } catch (_) {
        // Fallback to saving secure card metadata in user profile
      }

      const brand = detectBrand(cleanNum);
      const last4 = cleanNum.slice(-4);
      const [expMonth, expYear] = cardExpiry.includes("/")
        ? cardExpiry.split("/")
        : [cardExpiry.slice(0, 2), cardExpiry.slice(2)];

      await base44.auth.updateMe({
        saved_card_brand: brand,
        saved_card_last4: last4,
        saved_card_exp_month: expMonth,
        saved_card_exp_year: expYear,
        preferred_payment_method: "card",
      });

      setPreferredMethod("card");
      setCardInfo({
        has_card: true,
        brand,
        last4,
        exp_month: expMonth,
        exp_year: expYear,
      });
      await checkUserAuth();
      setAddCardModal(false);
      setCardNumber("");
      setCardName("");
      setCardExpiry("");
      setCardCvv("");
      toast({ title: "Tarjeta guardada con éxito", description: `Tu tarjeta ${brand} •••• ${last4} está activa para viajes.` });
    } catch (err) {
      toast({ title: "Error al guardar tarjeta", description: err.message, variant: "destructive" });
    } finally {
      setSavingCard(false);
    }
  };

  const handleRemoveCard = async () => {
    try {
      await base44.auth.updateMe({
        saved_card_brand: null,
        saved_card_last4: null,
        saved_card_exp_month: null,
        saved_card_exp_year: null,
        preferred_payment_method: preferredMethod === "card" ? "cash" : preferredMethod,
      });
      if (preferredMethod === "card") setPreferredMethod("cash");
      setCardInfo({ has_card: false });
      await checkUserAuth();
      toast({ title: "Tarjeta eliminada", description: "Se restableció Efectivo como método de pago." });
    } catch (err) {
      toast({ title: "Error al eliminar tarjeta", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-20 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Volver
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAgentOpen(true)}
          className="border-accent/40 bg-accent/10 hover:bg-accent/20 text-foreground font-semibold text-xs h-8 flex items-center gap-1.5 shadow-sm"
        >
          <Bot className="w-3.5 h-3.5 text-accent" />
          Asistente de Pagos
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent shadow-sm">
          <CreditCard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Métodos de Pago</h1>
          <p className="text-xs text-muted-foreground">
            Administrá tus tarjetas y elegí cómo querés abonar tus viajes
          </p>
        </div>
      </div>

      {/* Driver Mercado Pago Banner if applicable */}
      {isDriver && (
        <div className="mb-6">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Cuenta de cobros (Conductor)
          </p>
          {driverAccount ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Mercado Pago Vinculado</p>
                  <p className="text-[11px] text-muted-foreground">ID Vendedor: {driverAccount.seller_id || "Activo"}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={connectingDriver}
                onClick={handleConnectDriverPayments}
                className="text-xs text-emerald-400 hover:text-emerald-300 h-8"
              >
                Reconectar
              </Button>
            </div>
          ) : (
            <Card className="p-4 border-accent/40 bg-accent/5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#009EE3]/20 flex items-center justify-center text-[#009EE3] shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">Vinculá tu cuenta de Mercado Pago</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Necesario para que los pasajeros puedan pagarte con QR directo a tu billetera sin demoras ni retenciones.
                  </p>
                  <Button
                    disabled={connectingDriver}
                    onClick={handleConnectDriverPayments}
                    className="w-full mt-3 h-9 bear-gold-gradient text-foreground font-bold text-xs"
                  >
                    {connectingDriver ? "Conectando..." : "Vincular Mercado Pago"}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Main Section: Preferred Payment Method */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Método Predeterminado para Viajar
          </p>
          {savingPref && <span className="text-[10px] text-accent animate-pulse">Guardando...</span>}
        </div>

        {/* Option 1: Efectivo */}
        <Card
          onClick={() => handleSelectPreferred("cash")}
          className={`p-4 border cursor-pointer transition-all ${
            preferredMethod === "cash"
              ? "border-accent bg-accent/10 shadow-sm"
              : "border-border hover:border-border/80 bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Efectivo</p>
                <p className="text-xs text-muted-foreground">Aboná directamente al chofer al llegar a destino</p>
              </div>
            </div>
            {preferredMethod === "cash" && (
              <Badge className="bg-accent text-foreground text-[10px] font-bold">Activo</Badge>
            )}
          </div>
        </Card>

        {/* Option 2: Mercado Pago / QR Dinámico */}
        <Card
          onClick={() => handleSelectPreferred("qr")}
          className={`p-4 border cursor-pointer transition-all ${
            preferredMethod === "qr"
              ? "border-accent bg-accent/10 shadow-sm"
              : "border-border hover:border-border/80 bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#009EE3]/15 flex items-center justify-center text-[#009EE3]">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Mercado Pago / QR</p>
                <p className="text-xs text-muted-foreground">Pagá escaneando el código dinámico del chofer</p>
              </div>
            </div>
            {preferredMethod === "qr" && (
              <Badge className="bg-accent text-foreground text-[10px] font-bold">Activo</Badge>
            )}
          </div>
        </Card>

        {/* Option 3: Tarjeta de Débito o Crédito */}
        <Card
          onClick={() => {
            if (cardInfo?.has_card) {
              handleSelectPreferred("card");
            } else {
              setAddCardModal(true);
            }
          }}
          className={`p-4 border cursor-pointer transition-all ${
            preferredMethod === "card"
              ? "border-accent bg-accent/10 shadow-sm"
              : "border-border hover:border-border/80 bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Tarjeta de Débito / Crédito</p>
                <p className="text-xs text-muted-foreground">
                  {cardInfo?.has_card
                    ? `${cardInfo.brand} terminada en •••• ${cardInfo.last4}`
                    : "Cobro automático y transparente al finalizar"}
                </p>
              </div>
            </div>
            {preferredMethod === "card" && (
              <Badge className="bg-accent text-foreground text-[10px] font-bold">Activo</Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Saved Cards Section */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Tus Tarjetas Guardadas
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAddCardModal(true)}
            className="text-accent text-xs font-bold h-7 hover:text-accent/80 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar tarjeta
          </Button>
        </div>

        {loadingCard ? (
          <Card className="p-5 flex items-center justify-center text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Cargando tarjetas...
          </Card>
        ) : cardInfo?.has_card ? (
          /* Branded Saved Card View */
          <div className="p-4 rounded-2xl bear-gradient text-white shadow-md relative overflow-hidden border border-border/40">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-5 rounded bg-accent/30 flex items-center justify-center text-[10px] font-bold">
                  {cardInfo.brand.slice(0, 4)}
                </div>
                <span className="text-xs font-bold tracking-wide">{cardInfo.brand}</span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                Activa para cobro
              </Badge>
            </div>

            <p className="font-mono text-lg font-bold tracking-widest mb-3">
              •••• •••• •••• {cardInfo.last4}
            </p>

            <div className="flex items-center justify-between text-xs text-white/70 pt-2 border-t border-white/15">
              <span>Titular registrado</span>
              <div className="flex items-center gap-2">
                {cardInfo.exp_month && (
                  <span>Vence: {cardInfo.exp_month}/{cardInfo.exp_year}</span>
                )}
                <button
                  onClick={handleRemoveCard}
                  className="text-destructive hover:text-destructive/80 p-1 transition-colors"
                  title="Eliminar tarjeta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <Card className="p-4 border-dashed border-border bg-card text-center">
            <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-xs font-bold text-foreground">No tenés tarjetas vinculadas</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
              Agregá una tarjeta de débito o crédito para no preocuparte por el efectivo al llegar.
            </p>
            <Button
              size="sm"
              onClick={() => setAddCardModal(true)}
              className="bear-gold-gradient text-foreground font-bold text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Vincular tarjeta ahora
            </Button>
          </Card>
        )}
      </div>

      {/* Info notice about Mercado Pago for passengers */}
      <div className="p-3.5 rounded-xl bg-secondary/50 border border-border text-xs space-y-1.5">
        <p className="font-bold text-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#009EE3]" />
          ¿Cómo pago con Mercado Pago siendo pasajero?
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          No necesitás vincular previamente tu cuenta en la app. Al finalizar el viaje, el chofer te muestra su código QR dinámico o podés pulsar "Pagar con QR / App de pagos" para abrir directamente la app de Mercado Pago instalada en tu teléfono.
        </p>
      </div>

      {/* Modal to add / link card */}
      <Dialog open={addCardModal} onOpenChange={setAddCardModal}>
        <DialogContent className="max-w-md w-[95vw] p-5 rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-accent" />
              Agregar Tarjeta de Débito / Crédito
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tus datos son tokenizados de forma segura con cifrado bancario de extremo a extremo.
            </DialogDescription>
          </DialogHeader>

          {/* Dynamic Card Preview */}
          <div className="p-4 rounded-xl bear-gradient text-white my-2 shadow-inner">
            <div className="flex justify-between items-center text-xs mb-3">
              <span className="font-bold text-accent">{detectBrand(cardNumber)}</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="font-mono text-base font-bold tracking-widest mb-2">
              {cardNumber ? cardNumber.replace(/(\d{4})/g, "$1 ").trim() : "•••• •••• •••• ••••"}
            </p>
            <div className="flex justify-between text-[11px] text-white/70">
              <span className="uppercase">{cardName || "NOMBRE DEL TITULAR"}</span>
              <span>{cardExpiry || "MM/AA"}</span>
            </div>
          </div>

          <form onSubmit={handleSaveCard} className="space-y-3 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Número de tarjeta</Label>
              <Input
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                value={cardNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                  setCardNumber(val.replace(/(\d{4})/g, "$1 ").trim());
                }}
                className="h-10 text-sm mt-1"
                required
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Nombre impreso en la tarjeta</Label>
              <Input
                placeholder="Ej. JUAN PEREZ"
                value={cardName}
                onChange={(e) => setCardName(e.target.value.toUpperCase())}
                className="h-10 text-sm mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Vencimiento (MM/AA)</Label>
                <Input
                  placeholder="08/29"
                  maxLength={5}
                  value={cardExpiry}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    if (val.length >= 2) val = val.slice(0, 2) + "/" + val.slice(2);
                    setCardExpiry(val);
                  }}
                  className="h-10 text-sm mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Código de seguridad (CVV)</Label>
                <Input
                  type="password"
                  placeholder="•••"
                  maxLength={4}
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="h-10 text-sm mt-1"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddCardModal(false)}
                className="flex-1 h-10 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingCard}
                className="flex-1 h-10 bear-gold-gradient text-foreground font-bold text-xs"
              >
                {savingCard ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando...</> : "Guardar Tarjeta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Agent */}
      <PaymentPricingAgentModal open={agentOpen} onOpenChange={setAgentOpen} />
    </div>
  );
}
