import { openPayment } from "@/lib/payment-navigation";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { DollarSign, AlertCircle, Receipt, ChevronLeft, ChevronRight, Calendar, CreditCard, CheckCircle2 } from "lucide-react";
import { displayAddress } from "@/lib/geo";
import LoadingScreen from "@/components/bear/LoadingScreen";
import PullToRefresh from "@/components/bear/PullToRefresh";

export default function DriverEarnings() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [paymentAccount, setPaymentAccount] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [payingCharge, setPayingCharge] = useState(false);

  const load = async () => {
    try {
      const r = await base44.entities.Ride.filter({ driver_id: user.id, status: { $in: ["COMPLETED", "RATED"] } }, "-created_date", 100);
      setRides(r);
      const c = await base44.entities.DriverDailyCharge.filter({ driver_id: user.id }, "-business_day", 50);
      const status = await base44.functions.invoke("getAccountStatus", {});
      const balances = new Map(status.data.charges.map(charge => [charge.id, charge]));
      setCharges(c.map(charge => balances.get(charge.id) || charge));
      const accountResponse = await base44.functions.invoke("getDriverPaymentAccount", {});
      setPaymentAccount(accountResponse.data.account?.status === "connected" ? accountResponse.data.account : null);
    } catch (err) { toast({ title: "No se pudo cargar la información", description: err.response?.data?.error || err.message, variant: "destructive" }); } finally { setLoading(false); }
  };

  const connectPayments = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      await openPayment(async () => (await base44.functions.invoke("connectDriverPayments", {})).data.url);
    } catch (e) {
      toast({ title: e.response?.data?.error || e.message, variant: "destructive" });
    } finally { setConnecting(false); }
  };

  useEffect(() => { if (user?.id) load(); }, [user?.id]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("payments") === "connected") {
      toast({ title: "Mercado Pago conectado", description: "Tu cuenta quedó vinculada para cobrar tus viajes." });
      url.searchParams.delete("payments");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, []);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && user?.id) load(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('bear-payment-return', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('bear-payment-return', refresh); };
  }, [user?.id]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRides = rides.filter(r => r.completed_date && r.completed_date.slice(0, 10) === today);
  const todayEarnings = todayRides.reduce((s, r) => s + (r.final_fare || r.quoted_fare || 0), 0);
  const weekEarnings = rides.filter(r => r.completed_date && new Date(r.completed_date) > new Date(Date.now() - 7 * 86400000)).reduce((s, r) => s + (r.final_fare || r.quoted_fare || 0), 0);
  const totalEarnings = rides.reduce((s, r) => s + (r.final_fare || r.quoted_fare || 0), 0);

  const pendingCharges = charges.filter(c => c.status === "pending");
  const totalDebt = pendingCharges.reduce((s, c) => s + (c.total_due || c.amount || 0), 0);

  const monthRides = rides.filter(r => r.completed_date && r.completed_date.slice(0, 7) === selectedMonth);
  const monthEarnings = monthRides.reduce((s, r) => s + (r.final_fare || r.quoted_fare || 0), 0);
  const monthAvg = monthRides.length > 0 ? monthEarnings / monthRides.length : 0;
  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const changeMonth = (delta) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const formatPrice = (v) => `$${(v || 0).toLocaleString("es-AR")}`;
  const formatDate = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : "";

  const handlePayDebt = async (chargeId) => {
    if (payingCharge) return;
    setPayingCharge(true);
    try {
      await openPayment(async () => (await base44.functions.invoke("createDailyChargePayment", { charge_id: chargeId })).data.checkout_url);
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally { setPayingCharge(false); }
  };

  if (loading) return <LoadingScreen className="h-full" label="Cargando..." />;

  return (
    <PullToRefresh onRefresh={load}>
    <div className="responsive-content mx-auto px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold mb-4">Ganancias</h1>

      {/* 0% Commission Value Prop Banner */}
      <Card className="p-4 mb-4 bg-accent/10 border-accent/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">0% de comisión por viaje</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              BearDrive no descuenta comisión de tus viajes. Pagás un único cargo diario sólo si completás al menos un viaje en el día.
            </p>
          </div>
        </div>
      </Card>

      {/* Mercado Pago Account Connection Card */}
      {paymentAccount ? (
        <div className="p-3.5 mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-foreground">Mercado Pago conectado</p>
              <p className="text-[11px] text-muted-foreground">ID Vendedor: {paymentAccount.seller_id} · Cuenta vinculada</p>
            </div>
          </div>
          <Button disabled={connecting} onClick={connectPayments} variant="ghost" size="sm" className="text-xs text-emerald-400 hover:text-emerald-300 h-8 px-2">
            Reconectar
          </Button>
        </div>
      ) : (
        <Card className="p-4 mb-4 border-accent/40 bg-accent/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#009EE3]/15 flex items-center justify-center shrink-0 mt-0.5">
              <CreditCard className="w-4 h-4 text-[#009EE3]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs text-foreground">Vincular cuenta de Mercado Pago</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Necesario para recibir pagos digitales de viajes por QR y tarjetas directamente a tu cuenta.
              </p>
              <Button disabled={connecting} onClick={connectPayments} className="w-full mt-2.5 h-9 bear-gold-gradient text-foreground font-bold text-xs">
                Vincular mi Mercado Pago
              </Button>
            </div>
          </div>
        </Card>
      )}
      {totalDebt > 0 && (
        <Card className="p-4 mb-4 bg-destructive/5 border-destructive/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-destructive">Deuda pendiente: {formatPrice(totalDebt)}</p>
              <p className="text-[14px] text-muted-foreground mt-1 mb-3">Regularizá tu deuda para poder conectarte</p>
              <div className="space-y-2">
                {pendingCharges.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-[14px]">
                    <span>{c.business_day} · {formatPrice(c.total_due || c.amount)}</span>
                    <Button size="sm" disabled={payingCharge} onClick={() => handlePayDebt(c.id)} className="min-h-11 text-[14px] bear-gold-gradient text-foreground border-0">Pagar</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Earnings summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-3 text-center">
          <p className="text-[14px] text-muted-foreground">Hoy</p>
          <p className="text-lg font-bold text-accent">{formatPrice(todayEarnings)}</p>
          <p className="text-[14px] text-muted-foreground">{todayRides.length} viajes</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-[14px] text-muted-foreground">7 días</p>
          <p className="text-lg font-bold">{formatPrice(weekEarnings)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-[14px] text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{formatPrice(totalEarnings)}</p>
        </Card>
      </div>

      {/* Monthly summary with date filter */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-[14px] text-muted-foreground flex items-center justify-center gap-1"><Calendar className="w-3 h-3" />Mes</p>
            <p className="font-semibold text-sm capitalize">{monthLabel}</p>
          </div>
          <button onClick={() => changeMonth(1)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-xl bg-accent/10">
            <p className="text-[14px] text-muted-foreground">Ingresos</p>
            <p className="text-base font-bold text-accent">{formatPrice(monthEarnings)}</p>
          </div>
          <div className="text-center p-2 rounded-xl bg-secondary/50">
            <p className="text-[14px] text-muted-foreground">Viajes</p>
            <p className="text-base font-bold">{monthRides.length}</p>
          </div>
          <div className="text-center p-2 rounded-xl bg-secondary/50">
            <p className="text-[14px] text-muted-foreground">Promedio</p>
            <p className="text-base font-bold">{formatPrice(monthAvg)}</p>
          </div>
        </div>
      </Card>

      {/* Rides for selected month */}
      <h2 className="font-semibold text-sm mb-2 capitalize">Viajes de {monthLabel}</h2>
      <div className="space-y-2 mb-6">
        {monthRides.length === 0 ? (
          <Card className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Sin viajes este mes</p>
          </Card>
        ) : (
          monthRides.map(r => (
            <Card key={r.id} className="p-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{displayAddress(r.destination_address)}</p>
                <p className="text-[14px] text-muted-foreground">{formatDate(r.completed_date)} · {r.payment_method === "cash" ? "Efectivo" : r.payment_method === "card" ? "Tarjeta" : "QR"}</p>
              </div>
              <p className="font-bold text-accent ml-2">{formatPrice(r.final_fare || r.quoted_fare)}</p>
            </Card>
          ))
        )}
      </div>

      {/* Daily summary */}
      <Card className="p-4 mb-4">
        <p className="font-semibold text-sm mb-3 flex items-center gap-2"><Receipt className="w-4 h-4 text-accent" />Resumen de hoy</p>
        {todayRides.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Sin viajes hoy todavía</p>
        ) : (
          <div className="space-y-2">
            {todayRides.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{displayAddress(r.destination_address)}</p>
                  <p className="text-[14px] text-muted-foreground">{new Date(r.completed_date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {r.payment_method === "cash" ? "Efectivo" : "QR"}</p>
                </div>
                <p className="font-bold text-accent ml-2">{formatPrice(r.final_fare || r.quoted_fare)}</p>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-1 border-t border-border">
              <p className="font-semibold text-sm">Total del día</p>
              <p className="font-bold text-accent">{formatPrice(todayEarnings)}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Daily charges */}
      <h2 className="font-semibold text-sm mb-2">Cargos diarios BearDrive</h2>
      <Card className="p-4 mb-4">
        {charges.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Sin cargos diarios todavía</p>
        ) : (
          <div className="space-y-2">
            {charges.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{formatDate(c.business_day)}</p>
                  <p className="text-[14px] text-muted-foreground">Cargo diario</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatPrice(c.total_due || c.amount)}</p><p className="text-xs text-muted-foreground">Capital {formatPrice(c.amount)} · Mora {formatPrice(c.late_fee || 0)}</p>
                  <span className={`text-[14px] ${c.status === "paid" ? "text-green-600" : c.status === "waived" ? "text-blue-600" : "text-destructive"}`}>
                    {c.status === "paid" ? "Pagado" : c.status === "waived" ? "Condonado" : "Pendiente"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent ride earnings */}
      <h2 className="font-semibold text-sm mb-2">Ingresos por viaje</h2>
      <div className="space-y-2">
        {rides.slice(0, 10).map(r => (
          <Card key={r.id} className="p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{displayAddress(r.destination_address)}</p>
              <p className="text-[14px] text-muted-foreground">{formatDate(r.completed_date)}</p>
            </div>
            <p className="font-bold text-accent">{formatPrice(r.final_fare || r.quoted_fare)}</p>
          </Card>
        ))}
      </div>
    </div>
    </PullToRefresh>
  );
}