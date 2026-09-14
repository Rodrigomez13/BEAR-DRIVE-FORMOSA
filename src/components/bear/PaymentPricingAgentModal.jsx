import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Bot,
  Calculator,
  CreditCard,
  HelpCircle,
  QrCode,
  DollarSign,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PaymentPricingAgentModal({ open, onOpenChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pricing"); // "pricing" | "account" | "faq"
  const [pricing, setPricing] = useState({
    name: "Tarifa Urbana Formosa",
    base_fare: 300,
    per_km: 120,
    per_min: 40,
    min_fare: 500,
    flash_supplement: 200,
    premium_multiplier: 1.5,
  });
  const [simKm, setSimKm] = useState(4.5);
  const [simMin, setSimMin] = useState(12);
  const [simCategory, setSimCategory] = useState("standard");
  const [driverAccount, setDriverAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  const isDriver = user?.driver_capability === "APPROVED_ELIGIBLE" || user?.driver_status === "APPROVED";

  useEffect(() => {
    if (!open) return;
    const loadPricing = async () => {
      try {
        const configs = await base44.entities.PricingConfig.filter({ active: true }, "-effective_from", 1);
        if (configs && configs.length > 0) {
          setPricing(configs[0]);
        }
      } catch (err) {
        // Fallback to default Formosa tariffs
      }
    };

    const loadDriverAccount = async () => {
      if (!isDriver) return;
      setLoadingAccount(true);
      try {
        const res = await base44.functions.invoke("getDriverPaymentAccount", {});
        if (res.data?.account) {
          setDriverAccount(res.data.account);
        }
      } catch (err) {
        // Ignore
      } finally {
        setLoadingAccount(false);
      }
    };

    loadPricing();
    loadDriverAccount();
  }, [open, isDriver]);

  // Pricing calculation
  const calculateSimulatedPrice = () => {
    const km = Math.max(0, parseFloat(simKm) || 0);
    const min = Math.max(0, parseFloat(simMin) || 0);
    const rawFare = pricing.base_fare + km * pricing.per_km + min * pricing.per_min;
    let finalFare = Math.max(pricing.min_fare, rawFare);

    if (simCategory === "flash") {
      finalFare += pricing.flash_supplement;
    } else if (simCategory === "premium") {
      finalFare = finalFare * pricing.premium_multiplier;
    }
    return Math.round(finalFare / 10) * 10;
  };

  const estimatedTotal = calculateSimulatedPrice();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-card border-border">
        {/* Header with Bear Theme */}
        <div className="p-5 bear-gradient text-white relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent border border-accent/40">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Asistente de Pagos y Tarifas
                <Badge className="bg-accent text-foreground text-[10px] font-bold px-1.5 py-0.5">BearBot</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-white/70">
                Tu guía experto en cobros, Mercado Pago y tarifas en Formosa
              </DialogDescription>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 mt-4 bg-black/25 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("pricing")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "pricing"
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Tarifas
            </button>
            <button
              onClick={() => setActiveTab("account")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "account"
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Cuenta y Cobros
            </button>
            <button
              onClick={() => setActiveTab("faq")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "faq"
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Preguntas
            </button>
          </div>
        </div>

        {/* Tab 1: Tarifas y Simulador */}
        {activeTab === "pricing" && (
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-secondary/60 p-3.5 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Esquema Tarifario Oficial</span>
                <Badge variant="outline" className="text-[10px] text-accent border-accent/40">Formosa Urbano</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-background/80 p-2 rounded-lg border border-border/50">
                  <span className="text-muted-foreground block text-[10px]">Bajada de bandera</span>
                  <span className="font-bold text-foreground text-sm">${pricing.base_fare.toLocaleString("es-AR")}</span>
                </div>
                <div className="bg-background/80 p-2 rounded-lg border border-border/50">
                  <span className="text-muted-foreground block text-[10px]">Tarifa mínima</span>
                  <span className="font-bold text-foreground text-sm">${pricing.min_fare.toLocaleString("es-AR")}</span>
                </div>
                <div className="bg-background/80 p-2 rounded-lg border border-border/50">
                  <span className="text-muted-foreground block text-[10px]">Precio por km</span>
                  <span className="font-bold text-foreground text-sm">${pricing.per_km.toLocaleString("es-AR")} / km</span>
                </div>
                <div className="bg-background/80 p-2 rounded-lg border border-border/50">
                  <span className="text-muted-foreground block text-[10px]">Precio por minuto</span>
                  <span className="font-bold text-foreground text-sm">${pricing.per_min.toLocaleString("es-AR")} / min</span>
                </div>
              </div>
            </div>

            {/* Simulador Interactivo */}
            <Card className="p-4 border-accent/30 bg-accent/5">
              <p className="font-bold text-xs text-foreground flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                Simulador de Viaje en Formosa
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Distancia estimada (km)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={simKm}
                      onChange={(e) => setSimKm(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Duración estimada (min)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={simMin}
                      onChange={(e) => setSimMin(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground block mb-1">Categoría de servicio</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "standard", label: "Estándar" },
                      { id: "flash", label: "Flash (+$" + pricing.flash_supplement + ")" },
                      { id: "premium", label: "Premium (x1.5)" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSimCategory(cat.id)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center border transition-all ${
                          simCategory === cat.id
                            ? "border-accent bg-accent text-foreground font-bold shadow-sm"
                            : "border-border bg-secondary/50 text-muted-foreground"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-accent/20 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Precio estimado sugerido:</span>
                    <span className="text-xl font-extrabold text-accent">${estimatedTotal.toLocaleString("es-AR")}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/passenger");
                    }}
                    className="bear-gold-gradient text-foreground text-xs font-bold h-8"
                  >
                    Cotizar viaje real
                  </Button>
                </div>
              </div>
            </Card>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              * El precio definitivo se calcula en tiempo real con la ruta óptima de Google Maps. No cobramos tarifas dinámicas abusivas; sólo incrementos progresivos si ampliás la búsqueda a conductores más lejanos.
            </p>
          </div>
        )}

        {/* Tab 2: Gestión de PaymentAccount */}
        {activeTab === "account" && (
          <div className="p-5 space-y-4">
            {isDriver ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-border bg-secondary/40">
                  <p className="text-xs font-bold text-foreground mb-1">Tu cuenta de cobros (Conductor)</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Para recibir pagos de pasajeros vía QR dinámico o transferencias directas sin comisiones de intermediarios, debés tener vinculada tu cuenta de Mercado Pago.
                  </p>
                </div>

                {driverAccount?.status === "connected" ? (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Mercado Pago Vinculado</p>
                        <p className="text-[11px] text-muted-foreground">ID Vendedor: {driverAccount.seller_id || "Activo"}</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Listo para cobrar</Badge>
                  </div>
                ) : (
                  <Card className="p-3.5 border-accent/40 bg-accent/5">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#009EE3]/20 flex items-center justify-center shrink-0">
                        <QrCode className="w-4 h-4 text-[#009EE3]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-foreground">Vinculación requerida</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Vincula tu cuenta personal de Mercado Pago para habilitar el cobro automático por QR.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => {
                            onOpenChange(false);
                            navigate("/payment-methods");
                          }}
                          className="w-full mt-2.5 h-8 bear-gold-gradient text-foreground text-xs font-bold"
                        >
                          Ir a Vincular Mercado Pago
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-border bg-secondary/40">
                  <p className="text-xs font-bold text-foreground mb-1">Métodos de Pago para Pasajeros</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Como pasajero, podés viajar abonando en <strong>Efectivo</strong>, mediante <strong>QR de Mercado Pago</strong> o con <strong>Tarjeta de débito/crédito</strong> vinculada.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/60 border border-border space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <QrCode className="w-4 h-4 text-[#009EE3]" />
                    ¿Necesito vincular Mercado Pago para pagar?
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    <strong>No necesitas vincular tu cuenta de antemano.</strong> Al finalizar el viaje, el chofer te muestra su QR dinámico o tocás "Pagar con Mercado Pago" en la app para abrir directamente tu billetera digital.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/payment-methods");
                  }}
                  className="w-full h-9 bear-gold-gradient text-foreground text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="w-4 h-4" />
                  Administrar mis métodos de pago
                </Button>
              </div>
            )}

            <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate("/wallet");
                }}
                className="text-accent hover:underline flex items-center gap-1 text-[11px] font-semibold"
              >
                Ver mi Billetera Digital <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Preguntas Frecuentes */}
        {activeTab === "faq" && (
          <div className="p-5 space-y-3">
            {[
              {
                q: "¿Por qué dio error al ingresar a un enlace en el navegador?",
                a: "Los endpoints seguros del servidor (como connectDriverPayments) requieren una sesión activa iniciada desde la aplicación BearDrive. Si abrís la URL directamente en el navegador sin iniciar sesión, el sistema bloquea el acceso por seguridad devolviendo 'Authentication required'.",
              },
              {
                q: "¿Qué es el cargo diario de chofer en Formosa?",
                a: "En BearDrive los choferes tienen 0% de comisión por viaje. En lugar de descontar porcentaje de cada viaje, sólo abonan un cargo diario fijo los días que decidan trabajar y completen viajes.",
              },
              {
                q: "¿Cómo se calculan los precios con lluvia o alta demanda?",
                a: "No aplicamos multiplicadores dinámicos repentinos. Si no hay conductores inmediatos, el sistema te ofrece ampliar el radio de búsqueda con una bonificación transparente del 5% para incentivar a choferes más lejanos.",
              },
              {
                q: "¿Puedo pagar con tarjeta de débito?",
                a: "Sí. Podés agregar tu tarjeta de débito o crédito desde la sección 'Métodos de Pago' para cobros automáticos transparentes al llegar a destino.",
              },
            ].map((faq, i) => (
              <div key={i} className="p-3 rounded-xl bg-secondary/50 border border-border/70 text-xs">
                <p className="font-bold text-foreground mb-1 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  {faq.q}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed pl-5">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
