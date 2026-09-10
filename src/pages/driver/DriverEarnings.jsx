import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { DollarSign, TrendingUp, Car, AlertCircle, Receipt, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { displayAddress } from "@/lib/geo";

export default function DriverEarnings() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const load = async () => {
      try {
        const r = await base44.entities.Ride.filter({ driver_id: user.id, status: { $in: ["COMPLETED", "RATED"] } }, "-created_date", 100);
        setRides(r);
        const c = await base44.entities.DriverDailyCharge.filter({ driver_id: user.id }, "-business_day", 50);
        setCharges(c);
      } catch (err) {} finally { setLoading(false); }
    };
    load();
  }, [user]);

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
    try {
      await base44.entities.DriverDailyCharge.update(chargeId, { status: "paid", paid_date: new Date().toISOString() });
      setCharges(c => c.map(ch => ch.id === chargeId ? { ...ch, status: "paid" } : ch));
      toast({ title: "Deuda regularizada" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-8 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Ganancias</h1>

      {/* Debt alert */}
      {totalDebt > 0 && (
        <Card className="p-4 mb-4 bg-destructive/5 border-destructive/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-destructive">Deuda pendiente: {formatPrice(totalDebt)}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Regularizá tu deuda para poder conectarte</p>
              <div className="space-y-2">
                {pendingCharges.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span>{c.business_day} · {formatPrice(c.total_due || c.amount)}</span>
                    <Button size="sm" onClick={() => handlePayDebt(c.id)} className="h-7 text-xs bear-gold-gradient text-foreground border-0">Pagar</Button>
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
          <p className="text-xs text-muted-foreground">Hoy</p>
          <p className="text-lg font-bold text-accent">{formatPrice(todayEarnings)}</p>
          <p className="text-xs text-muted-foreground">{todayRides.length} viajes</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">7 días</p>
          <p className="text-lg font-bold">{formatPrice(weekEarnings)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total</p>
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
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Calendar className="w-3 h-3" />Mes</p>
            <p className="font-semibold text-sm capitalize">{monthLabel}</p>
          </div>
          <button onClick={() => changeMonth(1)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-xl bg-accent/10">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="text-base font-bold text-accent">{formatPrice(monthEarnings)}</p>
          </div>
          <div className="text-center p-2 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground">Viajes</p>
            <p className="text-base font-bold">{monthRides.length}</p>
          </div>
          <div className="text-center p-2 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground">Promedio</p>
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
                <p className="text-xs text-muted-foreground">{formatDate(r.completed_date)} · {r.payment_method === "cash" ? "Efectivo" : r.payment_method === "card" ? "Tarjeta" : "QR"}</p>
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
                  <p className="text-xs text-muted-foreground">{new Date(r.completed_date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {r.payment_method === "cash" ? "Efectivo" : "QR"}</p>
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
                  <p className="text-xs text-muted-foreground">Cargo diario</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatPrice(c.total_due || c.amount)}</p>
                  <span className={`text-xs ${c.status === "paid" ? "text-green-600" : c.status === "waived" ? "text-blue-600" : "text-destructive"}`}>
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
              <p className="text-xs text-muted-foreground">{formatDate(r.completed_date)}</p>
            </div>
            <p className="font-bold text-accent">{formatPrice(r.final_fare || r.quoted_fare)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}