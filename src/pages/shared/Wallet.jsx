import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  Wallet as WalletIcon,
  ChevronLeft,
  DollarSign,
  CreditCard,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Star,
  Receipt,
  Bot,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Banknote
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "@/components/bear/LoadingScreen";
import PullToRefresh from "@/components/bear/PullToRefresh";
import PaymentPricingAgentModal from "@/components/bear/PaymentPricingAgentModal";

export default function Wallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rides, setRides] = useState([]);
  const [charges, setCharges] = useState([]);
  const [paymentAccount, setPaymentAccount] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [agentOpen, setAgentOpen] = useState(false);
  const [payingChargeId, setPayingChargeId] = useState(null);

  const isDriver = user?.driver_capability === "APPROVED_ELIGIBLE" || user?.driver_status === "APPROVED";

  const loadData = async () => {
    try {
      if (isDriver) {
        const [ridesRes, chargesRes, accountRes] = await Promise.allSettled([
          base44.entities.Ride.filter({ driver_id: user.id, status: { $in: ["COMPLETED", "RATED"] } }, "-created_date", 50),
          base44.entities.DriverDailyCharge.filter({ driver_id: user.id }, "-business_day", 30),
          base44.functions.invoke("getDriverPaymentAccount", {})
        ]);

        if (ridesRes.status === "fulfilled") setRides(ridesRes.value || []);
        if (chargesRes.status === "fulfilled") setCharges(chargesRes.value || []);
        if (accountRes.status === "fulfilled" && accountRes.value.data?.account?.status === "connected") {
          setPaymentAccount(accountRes.value.data.account);
        } else {
          setPaymentAccount(null);
        }
      } else {
        const ridesRes = await base44.entities.Ride.filter({ passenger_id: user.id, status: { $in: ["COMPLETED", "RATED"] } }, "-created_date", 50);
        setRides(ridesRes || []);
      }
    } catch (err) {
      toast({
        title: "Error al actualizar billetera",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id, isDriver]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handlePayDebt = async (chargeId) => {
    setPayingChargeId(chargeId);
    try {
      const res = await base44.functions.invoke("createDailyChargePayment", { charge_id: chargeId });
      if (res.data?.checkout_url) {
        window.location.assign(res.data.checkout_url);
      } else {
        throw new Error("No se generó el enlace de pago");
      }
    } catch (err) {
      toast({
        title: "Error al iniciar pago",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setPayingChargeId(null);
    }
  };

  // Driver metrics
  const today = new Date().toISOString().slice(0, 10);
  const todayRides = rides.filter((r) => r.completed_date && r.completed_date.slice(0, 10) === today);
  const todayEarnings = todayRides.reduce((s, r) => s + (r.final_fare || r.quoted_fare || 0), 0);
  const totalEarnings = rides.reduce((s, r) => s + (r.final_fare || r.quoted_fare || 0), 0);

  const pendingCharges = charges.filter((c) => c.status === "pending");
  const totalDebt = pendingCharges.reduce((s, c) => s + (c.total_due || c.amount || 0), 0);

  const formatPrice = (amount) => `$${(amount || 0).toLocaleString("es-AR")}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) return <LoadingScreen className="h-full" label="Cargando billetera..." />;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
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
            Asistente de Tarifas
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent shadow-sm">
            <WalletIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billetera Digital</h1>
            <p className="text-xs text-muted-foreground">
              {isDriver ? "Resumen de ganancias, comisiones y saldos" : "Puntos acumulados y pagos de viajes"}
            </p>
          </div>
        </div>

        {/* Driver Financial Summary */}
        {isDriver ? (
          <div className="space-y-4 mb-6">
            {/* Primary Balance Card */}
            <Card className="p-5 bear-gradient text-white shadow-lg relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-10 pointer-events-none">
                <DollarSign className="w-24 h-24 text-white" />
              </div>
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider block mb-1">
                Ganancias Totales Acumuladas
              </span>
              <p className="text-3xl font-extrabold text-white mb-4">{formatPrice(totalEarnings)}</p>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15 text-xs">
                <div>
                  <span className="text-white/70 block text-[11px]">Hoy</span>
                  <span className="text-base font-bold text-accent">{formatPrice(todayEarnings)}</span>
                  <span className="text-[10px] text-white/60 block mt-0.5">{todayRides.length} viajes</span>
                </div>
                <div>
                  <span className="text-white/70 block text-[11px]">Total Viajes</span>
                  <span className="text-base font-bold text-white">{rides.length}</span>
                  <span className="text-[10px] text-white/60 block mt-0.5">0% comisiones</span>
                </div>
              </div>
            </Card>

            {/* Pending Balance / Daily Charges Card */}
            {totalDebt > 0 ? (
              <Card className="p-4 border-amber-500/40 bg-amber-500/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">Saldo pendiente: {formatPrice(totalDebt)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Tenés {pendingCharges.length} cargo{pendingCharges.length > 1 ? "s" : ""} diario{pendingCharges.length > 1 ? "s" : ""} pendiente{pendingCharges.length > 1 ? "s" : ""} de regularización.
                    </p>
                    <div className="mt-2.5 space-y-2">
                      {pendingCharges.map((charge) => (
                        <div key={charge.id} className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border text-xs">
                          <div>
                            <span className="font-semibold">{charge.business_day}</span>
                            <span className="text-muted-foreground ml-2">({formatPrice(charge.total_due || charge.amount)})</span>
                          </div>
                          <Button
                            size="sm"
                            disabled={payingChargeId === charge.id}
                            onClick={() => handlePayDebt(charge.id)}
                            className="bear-gold-gradient text-foreground h-7 text-[11px] font-bold px-2.5"
                          >
                            {payingChargeId === charge.id ? "Abriendo..." : "Abonar con MP"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">Al día con los cargos de servicio</p>
                  <p className="text-[11px] text-muted-foreground">No tenés deudas pendientes ni bloqueos operativos.</p>
                </div>
              </div>
            )}

            {/* Mercado Pago Account Quick State */}
            <Card className="p-3.5 border-border bg-secondary/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#009EE3]/15 flex items-center justify-center text-[#009EE3]">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {paymentAccount ? "Mercado Pago Vinculado" : "Mercado Pago no conectado"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {paymentAccount ? `Cobros directos habilitados (ID: ${paymentAccount.seller_id || "OK"})` : "Conectá tu cuenta para cobrar con QR"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/payment-methods")}
                className="text-xs font-semibold text-accent hover:text-accent/80 h-8"
              >
                Administrar <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Card>
          </div>
        ) : (
          /* Passenger Summary */
          <div className="space-y-4 mb-6">
            <Card className="p-5 bear-gold-gradient text-foreground shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold opacity-75 uppercase tracking-wider block mb-1">
                    Tus BearPoints Disponibles
                  </span>
                  <p className="text-3xl font-extrabold">{user?.bearpoints_balance || 0}</p>
                  <p className="text-xs opacity-80 mt-1">Acumulás 10 puntos por cada viaje finalizado</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-foreground/10 flex items-center justify-center">
                  <Star className="w-7 h-7" />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-foreground/15 flex items-center justify-between text-xs">
                <span className="opacity-80">Canjeables por descuentos en viajes</span>
                <button
                  onClick={() => navigate("/passenger/benefits")}
                  className="font-bold underline hover:opacity-90"
                >
                  Ver beneficios
                </button>
              </div>
            </Card>

            <Card className="p-4 border-border bg-secondary/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Métodos de pago guardados</p>
                  <p className="text-[11px] text-muted-foreground">Efectivo, Mercado Pago QR y tarjetas de débito/crédito</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/payment-methods")}
                className="bear-gold-gradient text-foreground text-xs font-bold h-8"
              >
                Configurar
              </Button>
            </Card>
          </div>
        )}

        {/* Transactions Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-accent" />
              Historial de Transacciones
            </h2>
            <div className="flex gap-1 bg-secondary p-0.5 rounded-lg text-[10px]">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-2 py-1 rounded-md font-semibold transition-all ${
                  activeFilter === "all" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveFilter("rides")}
                className={`px-2 py-1 rounded-md font-semibold transition-all ${
                  activeFilter === "rides" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Viajes
              </button>
              {isDriver && (
                <button
                  onClick={() => setActiveFilter("charges")}
                  className={`px-2 py-1 rounded-md font-semibold transition-all ${
                    activeFilter === "charges" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Cargos
                </button>
              )}
            </div>
          </div>

          {rides.length === 0 && charges.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-border bg-card">
              <WalletIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-foreground">Sin transacciones registradas</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tus viajes y movimientos de dinero aparecerán aquí automáticamente.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Combine and render filtered activities */}
              {activeFilter !== "charges" &&
                rides.map((ride) => (
                  <Card key={ride.id} className="p-3 border-border hover:border-accent/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isDriver ? "bg-emerald-500/15 text-emerald-400" : "bg-accent/15 text-accent"
                        }`}>
                          {isDriver ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Viaje {ride.category ? `· ${ride.category.toUpperCase()}` : ""}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(ride.completed_date || ride.created_date)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-bold block ${isDriver ? "text-emerald-400" : "text-foreground"}`}>
                          {isDriver ? `+${formatPrice(ride.final_fare || ride.quoted_fare)}` : formatPrice(ride.final_fare || ride.quoted_fare)}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize border-border">
                          {ride.payment_method === "card" ? "Tarjeta" : ride.payment_method === "qr" ? "QR" : "Efectivo"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}

              {isDriver &&
                activeFilter !== "rides" &&
                charges.map((charge) => (
                  <Card key={charge.id} className="p-3 border-border bg-secondary/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          charge.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-500"
                        }`}>
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Cargo diario {charge.business_day}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Estado: {charge.status === "paid" ? "Pagado" : "Pendiente"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-destructive block">
                          -{formatPrice(charge.total_due || charge.amount)}
                        </span>
                        {charge.status === "pending" && (
                          <button
                            onClick={() => handlePayDebt(charge.id)}
                            className="text-[10px] font-bold text-accent hover:underline"
                          >
                            Pagar ahora
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>

        {/* Modal Agent */}
        <PaymentPricingAgentModal open={agentOpen} onOpenChange={setAgentOpen} />
      </div>
    </PullToRefresh>
  );
}
