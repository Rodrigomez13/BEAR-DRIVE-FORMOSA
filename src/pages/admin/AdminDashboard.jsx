import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Users, Car, CheckCircle2, XCircle, DollarSign, FileText, AlertTriangle, Activity, Percent } from "lucide-react";
import { Link } from "react-router-dom";
import LoadingScreen from "@/components/bear/LoadingScreen";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const STATUS_COLORS = {
  Completados: "#22c55e",
  Cancelados: "#ef4444",
  Activos: "#3b82f6",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [applications, rides, drivers, charges] = await Promise.all([
        base44.entities.DriverApplication.list('-created_date', 100),
        base44.entities.Ride.list('-created_date', 100),
        base44.entities.User.list('-created_date', 100),
        base44.entities.DriverDailyCharge.list('-created_date', 50),
      ]);

      const pendingApps = applications.filter(a => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW");
      const completedRides = rides.filter(r => r.status === "COMPLETED" || r.status === "RATED");
      const cancelledRides = rides.filter(r => r.status === "CANCELLED");
      const activeRides = rides.filter(r => ["SEARCHING", "ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "IN_PROGRESS"].includes(r.status));
      const approvedDrivers = drivers.filter(d => d.driver_capability === "APPROVED_ELIGIBLE");
      const pendingCharges = charges.filter(c => c.status === "pending");
      const revenue = pendingCharges.reduce((s, c) => s + (c.amount || 0), 0);
      const today = new Date().toISOString().split("T")[0];
      const todayPendingApps = applications.filter(a => (a.status === "SUBMITTED" || a.status === "UNDER_REVIEW") && (a.created_date || "").startsWith(today)).length;
      const cancellationRate = (completedRides.length + cancelledRides.length) > 0
        ? Math.round((cancelledRides.length / (completedRides.length + cancelledRides.length)) * 100)
        : 0;

      // Rides per day (last 7 days)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dayKey = d.toISOString().split("T")[0];
        const dayLabel = d.toLocaleDateString("es-AR", { weekday: "short" });
        const dayRides = rides.filter(r => (r.created_date || "").startsWith(dayKey)).length;
        last7Days.push({ day: dayLabel, viajes: dayRides });
      }

      const statusData = [
        { name: "Completados", value: completedRides.length },
        { name: "Cancelados", value: cancelledRides.length },
        { name: "Activos", value: activeRides.length },
      ].filter(d => d.value > 0);

      setStats({
        pendingApps: pendingApps.length,
        totalRides: rides.length,
        completedRides: completedRides.length,
        cancelledRides: cancelledRides.length,
        activeRides: activeRides.length,
        totalDrivers: approvedDrivers.length,
        pendingCharges: pendingCharges.length,
        revenue,
        todayPendingApps,
        cancellationRate,
        last7Days,
        statusData,
      });
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    return () => clearInterval(refreshInterval);
  }, []);

  if (loading) return <LoadingScreen className="h-64" label="Cargando..." />;

  const cards = [
    { label: "Solicitudes pendientes", value: stats.pendingApps, icon: FileText, color: "text-accent" },
    { label: "Viajes activos", value: stats.activeRides, icon: Car, color: "text-blue-500" },
    { label: "Viajes completados", value: stats.completedRides, icon: CheckCircle2, color: "text-green-500" },
    { label: "Viajes cancelados", value: stats.cancelledRides, icon: XCircle, color: "text-destructive" },
    { label: "Conductores habilitados", value: stats.totalDrivers, icon: Users, color: "text-accent" },
    { label: "Cargos pendientes", value: stats.pendingCharges, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
          <span>En vivo</span>
        </div>
      </div>

      {/* Monitoreo rápido */}
      <h2 className="text-[14px] font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Monitoreo rápido</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-5 bear-gradient text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full -mr-8 -mt-8 blur-2xl" />
          <Car className="w-7 h-7 text-accent mb-3" />
          <p className="text-4xl font-extrabold">{stats.activeRides}</p>
          <p className="text-sm text-white/60">Viajes activos ahora</p>
        </Card>
        <Card className="p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -mr-8 -mt-8 blur-2xl" />
          <FileText className="w-7 h-7 text-accent mb-3" />
          <p className="text-4xl font-extrabold">{stats.todayPendingApps}</p>
          <p className="text-sm text-muted-foreground">Pendientes hoy</p>
          <Link to="/admin/drivers" className="text-[14px] text-accent mt-2 inline-block hover:underline">Revisar →</Link>
        </Card>
      </div>

      {/* Viajes por día */}
      <h2 className="text-[14px] font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Viajes últimos 7 días</h2>
      <Card className="p-5 mb-6">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.last7Days}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "14px" }} />
            <Bar dataKey="viajes" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Distribución + cancelación */}
      <h2 className="text-[14px] font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Distribución de viajes</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          {stats.statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name}: ${e.value}`} labelLine={false}>
                  {stats.statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "14px" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Sin datos de viajes</div>
          )}
        </Card>
        <Card className="p-5 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Percent className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-destructive">{stats.cancellationRate}%</p>
              <p className="text-sm text-muted-foreground">Tasa de cancelación</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Completados</span><span className="font-semibold text-green-600">{stats.completedRides}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cancelados</span><span className="font-semibold text-destructive">{stats.cancelledRides}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{stats.totalRides}</span></div>
          </div>
        </Card>
      </div>

      {/* Métricas generales */}
      <h2 className="text-[14px] font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Métricas generales</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map((c, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <c.icon className={`w-8 h-8 ${c.color}`} />
            </div>
            <p className="text-3xl font-extrabold">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>

      {/* Revenue */}
      <Card className="p-5 bear-gradient text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <DollarSign className="w-7 h-7 text-accent" />
          </div>
          <div>
            <p className="text-sm text-white/60">Ingresos BearDrive (cargos diarios pendientes)</p>
            <p className="text-3xl font-extrabold">${stats.revenue.toLocaleString("es-AR")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}