import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Users, Car, CheckCircle2, XCircle, Clock, DollarSign, TrendingUp, FileText, AlertTriangle, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import LoadingScreen from "@/components/bear/LoadingScreen";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [applications, rides, drivers, charges] = await Promise.all([
          base44.entities.DriverApplication.list(100),
          base44.entities.Ride.list(100),
          base44.entities.User.list(100),
          base44.entities.DriverDailyCharge.list(50),
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

        setStats({
          pendingApps: pendingApps.length,
          totalRides: rides.length,
          completedRides: completedRides.length,
          cancelledRides: cancelledRides.length,
          activeRides: activeRides.length,
          totalDrivers: approvedDrivers.length,
          totalApplications: applications.length,
          pendingCharges: pendingCharges.length,
          revenue,
          todayPendingApps,
        });
      } catch (err) {} finally { setLoading(false); }
    };
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
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
          <span>En vivo</span>
        </div>
      </div>

      <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Monitoreo rápido</h2>
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
          <Link to="/admin/drivers" className="text-xs text-accent mt-2 inline-block hover:underline">Revisar →</Link>
        </Card>
      </div>

      <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Métricas generales</h2>
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