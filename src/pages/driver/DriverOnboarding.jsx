import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Upload, Car, FileText, CheckCircle2, Loader2, ArrowLeft, ArrowRight, User, Shield, X } from "lucide-react";

const STEPS = [
  { key: "intro", label: "Introducción" },
  { key: "personal", label: "Datos personales" },
  { key: "personal_docs", label: "Documentación personal" },
  { key: "vehicle", label: "Vehículo" },
  { key: "vehicle_docs", label: "Documentación del vehículo" },
  { key: "review", label: "Revisión" },
];

export default function DriverOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [application, setApplication] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [personal, setPersonal] = useState({
    first_name: "", last_name: "", dni_number: "", birth_date: "", phone: user?.phone || "", address: "",
    license_number: "", license_class: "",
  });
  const [vehicle, setVehicle] = useState({
    make: "", model: "", year: "", plate: "", color: "", nickname: "", segment: "sedan", has_ac: true,
  });
  const [documents, setDocuments] = useState({}); // { code: { file_url, document_number, issued_at, expires_at } }

  useEffect(() => {
    const load = async () => {
      try {
        const reqs = await base44.entities.DocumentRequirement.filter({ enabled: true }, "sort_order", 50);
        setRequirements(reqs);
        const apps = await base44.entities.DriverApplication.filter({ user_id: user.id }, "-created_date", 1);
        if (apps.length > 0) {
          setApplication(apps[0]);
          if (apps[0].status === "SUBMITTED" || apps[0].status === "UNDER_REVIEW") {
            // Show status screen
          }
          if (apps[0].first_name) setPersonal(p => ({ ...p, first_name: apps[0].first_name, last_name: apps[0].last_name, dni_number: apps[0].dni_number || "", phone: apps[0].phone || p.phone, license_number: apps[0].license_number || "", license_class: apps[0].license_class || "" }));
        }
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleFileUpload = async (code, file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setDocuments(d => ({ ...d, [code]: { ...d[code], file_url } }));
      toast({ title: "Documento cargado" });
    } catch (err) {
      toast({ title: "Error al cargar", description: err.message, variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Create or update application
      let appId = application?.id;
      const appData = {
        user_id: user.id,
        applicant_name: user.full_name || user.email,
        applicant_email: user.email,
        status: "SUBMITTED",
        submitted_date: new Date().toISOString(),
        ...personal,
      };
      if (appId) {
        await base44.entities.DriverApplication.update(appId, appData);
      } else {
        const created = await base44.entities.DriverApplication.create(appData);
        appId = created.id;
        setApplication(created);
      }

      // Create vehicle
      const vehicleRec = await base44.entities.Vehicle.create({
        driver_id: user.id,
        make: vehicle.make, model: vehicle.model, year: parseInt(vehicle.year) || null,
        plate: vehicle.plate, color: vehicle.color, nickname: vehicle.nickname,
        segment: vehicle.segment, has_ac: vehicle.has_ac, status: "pending", category: "basic",
      });

      // Create documents
      for (const req of requirements) {
        const doc = documents[req.code];
        if (doc && doc.file_url) {
          await base44.entities.DriverDocument.create({
            driver_id: user.id,
            application_id: appId,
            subject: req.subject,
            code: req.code,
            label: req.label,
            file_url: doc.file_url,
            document_number: doc.document_number || null,
            issued_at: doc.issued_at || null,
            expires_at: doc.expires_at || null,
            status: "PENDING",
          });
        }
      }

      // Update user driver status
      await base44.auth.updateMe({ driver_status: "PENDING_REVIEW", driver_capability: "PENDING_REVIEW" });

      toast({ title: "Solicitud enviada", description: "Operations revisará tu postulación" });
      navigate("/driver");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[100dvh]"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  // Status screen if already submitted
  if (application && (application.status === "SUBMITTED" || application.status === "UNDER_REVIEW")) {
    return (
      <div className="max-w-md mx-auto px-5 pt-16 pb-10 text-center">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Solicitud en revisión</h1>
        <p className="text-sm text-muted-foreground mb-6">Tu postulación como conductor está siendo revisada por el equipo de Operations. Te avisaremos cuando haya novedades.</p>
        <Card className="p-5 text-left mb-4">
          <p className="font-semibold mb-3">Estado: <span className="text-accent">EN REVISIÓN</span></p>
          <div className="space-y-2">
            {requirements.map(r => (
              <div key={r.code} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>{r.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Button variant="outline" onClick={() => navigate("/passenger")} className="w-full">Volver al modo pasajero</Button>
      </div>
    );
  }

  if (application && application.status === "REJECTED") {
    return (
      <div className="max-w-md mx-auto px-5 pt-16 pb-10 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <X className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Solicitud rechazada</h1>
        <p className="text-sm text-muted-foreground mb-2">Tu postulación no fue aprobada.</p>
        {application.rejection_reason && <p className="text-sm bg-destructive/5 p-3 rounded-lg mb-4">Motivo: {application.rejection_reason}</p>}
        <Button onClick={() => { setApplication(null); setStep(0); }} className="w-full bear-gold-gradient text-foreground border-0">Postular nuevamente</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-10">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`flex-1 h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-secondary"}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-4 text-center">Paso {step + 1} de {STEPS.length}: {STEPS[step].label}</p>

      {step === 0 && (
        <div className="text-center py-6">
          <div className="w-20 h-20 rounded-3xl bear-gold-gradient flex items-center justify-center mx-auto mb-5">
            <Car className="w-10 h-10 text-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Conducí con BearDrive</h1>
          <p className="text-sm text-muted-foreground mb-6">Generá ingresos conduciendo en Formosa. BearDrive cobra un cargo diario fijo solo cuando trabajás, sin comisión por viaje.</p>
          <Card className="p-4 text-left mb-6 space-y-2 text-sm">
            <div className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /><span>Una sola cuenta para pasajero y conductor</span></div>
            <div className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /><span>Cargo diario configurable, no comisión por viaje</span></div>
            <div className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /><span>El dinero del viaje va directo a vos</span></div>
            <div className="flex items-start gap-2"><Shield className="w-4 h-4 text-accent mt-0.5 shrink-0" /><span>Revisión documental y aprobación administrativa</span></div>
          </Card>
          <Button onClick={() => setStep(1)} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">Comenzar postulación</Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Datos personales</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={personal.first_name} onChange={e => setPersonal({...personal, first_name: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Apellido</Label><Input value={personal.last_name} onChange={e => setPersonal({...personal, last_name: e.target.value})} /></div>
          </div>
          <div className="space-y-1.5"><Label>DNI</Label><Input value={personal.dni_number} onChange={e => setPersonal({...personal, dni_number: e.target.value})} placeholder="00.000.000" /></div>
          <div className="space-y-1.5"><Label>Fecha de nacimiento</Label><Input type="date" value={personal.birth_date} onChange={e => setPersonal({...personal, birth_date: e.target.value})} /></div>
          <div className="space-y-1.5"><Label>Teléfono</Label><Input value={personal.phone} onChange={e => setPersonal({...personal, phone: e.target.value})} placeholder="+54 370 ..." /></div>
          <div className="space-y-1.5"><Label>Dirección</Label><Input value={personal.address} onChange={e => setPersonal({...personal, address: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Licencia N°</Label><Input value={personal.license_number} onChange={e => setPersonal({...personal, license_number: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Clase</Label><Input value={personal.license_class} onChange={e => setPersonal({...personal, license_class: e.target.value})} placeholder="B" /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1"><ArrowLeft className="w-4 h-4 mr-1" />Atrás</Button>
            <Button onClick={() => setStep(2)} disabled={!personal.first_name || !personal.last_name || !personal.dni_number} className="flex-1 bear-gold-gradient text-foreground border-0">Continuar<ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <DocUploadStep
          title="Documentación personal"
          requirements={requirements.filter(r => r.subject === "personal")}
          documents={documents}
          onUpload={handleFileUpload}
          onUpdate={(code, field, val) => setDocuments(d => ({ ...d, [code]: { ...d[code], [field]: val } }))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Tu vehículo</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Marca</Label><Input value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} placeholder="Toyota" /></div>
            <div className="space-y-1.5"><Label>Modelo</Label><Input value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} placeholder="Corolla" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Año</Label><Input type="number" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} placeholder="2020" /></div>
            <div className="space-y-1.5"><Label>Color</Label><Input value={vehicle.color} onChange={e => setVehicle({...vehicle, color: e.target.value})} placeholder="Blanco" /></div>
          </div>
          <div className="space-y-1.5"><Label>Patente</Label><Input value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value.toUpperCase()})} placeholder="ABC 123" /></div>
          <div className="space-y-1.5"><Label>Apodo (opcional)</Label><Input value={vehicle.nickname} onChange={e => setVehicle({...vehicle, nickname: e.target.value})} placeholder="El blanco" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={vehicle.has_ac} onChange={e => setVehicle({...vehicle, has_ac: e.target.checked})} />Tiene aire acondicionado</label>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ArrowLeft className="w-4 h-4 mr-1" />Atrás</Button>
            <Button onClick={() => setStep(4)} disabled={!vehicle.make || !vehicle.model || !vehicle.plate} className="flex-1 bear-gold-gradient text-foreground border-0">Continuar<ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <DocUploadStep
          title="Documentación del vehículo"
          requirements={requirements.filter(r => r.subject === "vehicle")}
          documents={documents}
          onUpload={handleFileUpload}
          onUpdate={(code, field, val) => setDocuments(d => ({ ...d, [code]: { ...d[code], [field]: val } }))}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Revisá tu postulación</h2>
          <Card className="p-4 space-y-3 text-sm">
            <div><p className="font-semibold mb-1">Datos personales</p><p className="text-muted-foreground">{personal.first_name} {personal.last_name} · DNI {personal.dni_number}</p></div>
            <div className="h-px bg-border" />
            <div><p className="font-semibold mb-1">Documentos</p><p className="text-muted-foreground">{Object.keys(documents).filter(k => documents[k]?.file_url).length} de {requirements.length} cargados</p></div>
            <div className="h-px bg-border" />
            <div><p className="font-semibold mb-1">Vehículo</p><p className="text-muted-foreground">{vehicle.make} {vehicle.model} ({vehicle.year}) · {vehicle.plate}</p></div>
          </Card>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(4)} className="flex-1"><ArrowLeft className="w-4 h-4 mr-1" />Atrás</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bear-gold-gradient text-foreground border-0">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : "Enviar solicitud"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocUploadStep({ title, requirements, documents, onUpload, onUpdate, onBack, onNext }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {requirements.map(req => {
        const doc = documents[req.code] || {};
        return (
          <Card key={req.code} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{req.label}</p>
                {req.required && <span className="text-xs text-destructive">Obligatorio</span>}
              </div>
              {doc.file_url && <CheckCircle2 className="w-5 h-5 text-green-500" />}
            </div>
            {doc.file_url ? (
              <p className="text-xs text-green-600">Documento cargado ✓</p>
            ) : (
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Subir archivo (imagen/PDF)</span>
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files[0] && onUpload(req.code, e.target.files[0])} />
              </label>
            )}
            {req.requires_expiration && (
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimiento</Label>
                <Input type="date" value={doc.expires_at || ""} onChange={e => onUpdate(req.code, "expires_at", e.target.value)} className="h-9" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Número (opcional)</Label>
              <Input value={doc.document_number || ""} onChange={e => onUpdate(req.code, "document_number", e.target.value)} className="h-9" placeholder="N° de documento" />
            </div>
          </Card>
        );
      })}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1"><ArrowLeft className="w-4 h-4 mr-1" />Atrás</Button>
        <Button onClick={onNext} className="flex-1 bear-gold-gradient text-foreground border-0">Continuar<ArrowRight className="w-4 h-4 ml-1" /></Button>
      </div>
    </div>
  );
}