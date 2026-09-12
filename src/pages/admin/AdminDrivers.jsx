import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import StarRating from "@/components/bear/StarRating";
import { CheckCircle2, XCircle, Loader2, FileText, Car, User, Clock, MoreHorizontal } from "lucide-react";
import { businessDaysUntil } from "@/lib/businessDays";
import LoadingScreen from "@/components/bear/LoadingScreen";

const STATUS_LABELS = {
  DRAFT: "Borrador", SUBMITTED: "Enviada", UNDER_REVIEW: "En revisión",
  APPROVED: "Aprobada", REJECTED: "Rechazada", MORE_INFO_REQUIRED: "Más info",
};

export default function AdminDrivers() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.DriverApplication.filter({}, "-created_date", 100);
        setApplications(data);
      } catch (err) {} finally { setLoading(false); }
    };
    load();
  }, []);

  const loadDetail = async (app) => {
    setSelected(app);
    setReason("");
    try {
      const d = await base44.entities.DriverDocument.filter({ application_id: app.id });
      setDocs(d);
      const v = await base44.entities.Vehicle.filter({ driver_id: app.user_id });
      setVehicles(v);
    } catch (err) {}
  };

  const handleAction = async (action) => {
    if ((action === "reject" || action === "more_info") && !reason) {
      toast({ title: "Ingresá un motivo", variant: "destructive" });
      return;
    }
    setActing(true);
    try {
      await base44.functions.invoke("reviewDriverApplication", {
        application_id: selected.id, action, reason,
      });
      toast({ title: action === "approve" ? "Conductor aprobado" : action === "reject" ? "Solicitud rechazada" : "Se solicitó más información" });
      // Refresh list
      const data = await base44.entities.DriverApplication.filter({}, "-created_date", 100);
      setApplications(data);
      setSelected(null);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  // Quick approve/reject directly from the list without opening the detail view
  const handleQuickAction = async (app, action) => {
    let reasonText = "";
    if (action === "reject") {
      reasonText = window.prompt("Motivo del rechazo (obligatorio):") || "";
      if (!reasonText.trim()) return;
    }
    try {
      await base44.functions.invoke("reviewDriverApplication", {
        application_id: app.id, action, reason: reasonText,
      });
      toast({ title: action === "approve" ? "Conductor aprobado" : "Solicitud rechazada" });
      const data = await base44.entities.DriverApplication.filter({}, "-created_date", 100);
      setApplications(data);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const pendingApps = applications.filter(a => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW");
  const reviewedApps = applications.filter(a => ["APPROVED", "REJECTED", "MORE_INFO_REQUIRED"].includes(a.status));

  if (loading) return <LoadingScreen className="h-64" label="Cargando..." />;

  if (selected) {
    return (
      <div className="max-w-2xl">
        <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Volver</button>
        <h1 className="text-2xl font-bold mb-1">Revisión de solicitud</h1>
        <p className="text-sm text-muted-foreground mb-6">{selected.applicant_name} · {selected.applicant_email}</p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Card className="p-4">
            <p className="font-semibold text-sm mb-3 flex items-center gap-2"><User className="w-4 h-4 text-accent" />Datos personales</p>
            <div className="space-y-1.5 text-sm">
              <p><span className="text-muted-foreground">Nombre:</span> {selected.first_name} {selected.last_name}</p>
              <p><span className="text-muted-foreground">DNI:</span> {selected.dni_number}</p>
              <p><span className="text-muted-foreground">Tel:</span> {selected.phone}</p>
              <p><span className="text-muted-foreground">Licencia:</span> {selected.license_number} (Clase {selected.license_class})</p>
            </div>
          </Card>
          <Card className="p-4">
            <p className="font-semibold text-sm mb-3 flex items-center gap-2"><Car className="w-4 h-4 text-accent" />Vehículo</p>
            {vehicles.length === 0 ? <p className="text-sm text-muted-foreground">Sin vehículo</p> : vehicles.map(v => (
              <div key={v.id} className="text-sm space-y-1">
                <p>{v.make} {v.model} ({v.year})</p>
                <p className="text-muted-foreground">Patente: {v.plate} · Color: {v.color}</p>
                <p className="text-muted-foreground">A/C: {v.has_ac ? "Sí" : "No"}</p>
              </div>
            ))}
          </Card>
        </div>

        <Card className="p-4 mb-4">
          <p className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-accent" />Documentación</p>
          <div className="space-y-2">
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">Sin documentos cargados</p> : docs.map(d => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                <div>
                  <p className="text-sm font-medium">{d.label}</p>
                  {d.expires_at && <p className="text-[14px] text-muted-foreground">Vence: {d.expires_at}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[14px] px-2 py-0.5 rounded-full ${d.status === "APPROVED" ? "bg-green-100 text-green-700" : d.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-accent/10 text-accent"}`}>{d.status}</span>
                  {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-[14px] text-accent hover:underline">Ver archivo</a>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {selected.status === "SUBMITTED" || selected.status === "UNDER_REVIEW" ? (
          <>
          {selected.status === "UNDER_REVIEW" && selected.review_deadline && (
            <Card className="p-4 mb-4 bear-gradient text-white">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                <div>
                  <p className="font-semibold text-sm">Cuenta regresiva de revisión</p>
                  <p className="text-2xl font-bold text-accent">{businessDaysUntil(selected.review_deadline)} días hábiles restantes</p>
                  <p className="text-[14px] text-white/60">Vence: {new Date(selected.review_deadline).toLocaleDateString("es-AR")}</p>
                </div>
              </div>
            </Card>
          )}
          {selected.auto_review_notes && (
            <Card className="p-4 mb-4 bg-accent/5">
              <p className="text-[14px] font-semibold text-muted-foreground mb-1">Verificación automática</p>
              <p className="text-sm">{selected.auto_review_notes}</p>
            </Card>
          )}
          <Card className="p-4">
            <p className="font-semibold text-sm mb-3">Acciones</p>
            <div className="space-y-3">
              <div>
                <Label className="text-[14px]">Motivo (obligatorio para rechazar / solicitar info)</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: Documento ilegible, falta información..." className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleAction("approve")} disabled={acting} className="flex-1 bg-green-600 hover:bg-green-700 text-white border-0">
                  <CheckCircle2 className="w-4 h-4 mr-1" />Aprobar
                </Button>
                <Button onClick={() => handleAction("more_info")} disabled={acting} variant="outline" className="flex-1">
                  Solicitar info
                </Button>
                <Button onClick={() => handleAction("reject")} disabled={acting} variant="outline" className="flex-1 text-destructive border-destructive/30">
                  <XCircle className="w-4 h-4 mr-1" />Rechazar
                </Button>
              </div>
            </div>
          </Card>
          </>
        ) : (
          <Card className="p-4">
            <p className="text-sm">Estado: <span className="font-semibold">{STATUS_LABELS[selected.status]}</span></p>
            {selected.rejection_reason && <p className="text-sm text-muted-foreground mt-1">Motivo: {selected.rejection_reason}</p>}
            {selected.more_info_reason && <p className="text-sm text-muted-foreground mt-1">Info solicitada: {selected.more_info_reason}</p>}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Conductores</h1>

      {pendingApps.length > 0 && (
        <>
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-accent" />Pendientes de revisión ({pendingApps.length})</h2>
          <div className="space-y-3 mb-6">
            {pendingApps.map(app => (
              <Card key={app.id} className="p-4 flex items-center justify-between cursor-pointer hover:border-accent transition-colors" onClick={() => loadDetail(app)}>
                <div>
                  <p className="font-semibold">{app.first_name} {app.last_name}</p>
                  <p className="text-sm text-muted-foreground">{app.applicant_email}</p>
                  <p className="text-[14px] text-muted-foreground mt-1">Enviada: {new Date(app.submitted_date || app.created_date).toLocaleDateString("es-AR")}</p>
                  {app.status === "UNDER_REVIEW" && app.review_deadline && (
                    <p className="text-[14px] text-accent mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{businessDaysUntil(app.review_deadline)} días hábiles restantes</p>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[14px] font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent">{STATUS_LABELS[app.status]}</span>
                  <button onClick={() => handleQuickAction(app, "approve")} className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 shrink-0 no-select" title="Aprobar rápido">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleQuickAction(app, "reject")} className="w-9 h-9 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 shrink-0 no-select" title="Rechazar rápido">
                    <XCircle className="w-4 h-4" />
                  </button>
                  <Button size="sm" variant="outline" onClick={() => loadDetail(app)} className="shrink-0">Revisar</Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="font-semibold text-sm mb-3">Todas las solicitudes</h2>
      {applications.length === 0 ? (
        <Card className="p-8 text-center"><p className="text-sm text-muted-foreground">No hay solicitudes de conductores</p></Card>
      ) : (
        <div className="space-y-2">
          {applications.map(app => (
            <Card key={app.id} className="p-3 flex items-center justify-between cursor-pointer hover:border-accent" onClick={() => loadDetail(app)}>
              <div>
                <p className="text-sm font-medium">{app.first_name} {app.last_name}</p>
                <p className="text-[14px] text-muted-foreground">{app.applicant_email}</p>
              </div>
              <span className={`text-[14px] font-semibold px-2 py-1 rounded-full ${app.status === "APPROVED" ? "bg-green-100 text-green-700" : app.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-secondary text-muted-foreground"}`}>
                {STATUS_LABELS[app.status] || app.status}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}