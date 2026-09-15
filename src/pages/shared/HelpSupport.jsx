import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { HelpCircle, ChevronLeft, AlertCircle, ChevronDown } from "lucide-react";


const FAQS = [
  { q: "¿Cómo solicito un viaje?", a: "Ingresá a la pestaña Viajar, buscá tu destino o seleccioná un favorito y tocá Ver precio del viaje." },
  { q: "¿Cómo pago mi viaje?", a: "Podés pagar en efectivo o con QR al conductor al finalizar el viaje." },
  { q: "¿Qué es el PIN de viaje?", a: "Es un código de 4 dígitos que el conductor te pedirá al llegar. Compartíselo solo cuando lo veas llegar." },
  { q: "¿Cómo me postulo como conductor?", a: "Desde Cuenta, tocá \"Quiero conducir con BearDrive\" y completá la documentación requerida." },
  { q: "¿Qué son los BearPoints?", a: "Son puntos que acumulás al completar viajes. Podés canjearlos por beneficios desde Billetera → Explorar beneficios." },
];

const CATEGORIES = [
  { code: "ride", label: "Viaje" },
  { code: "payment", label: "Pago" },
  { code: "driver", label: "Conductor" },
  { code: "safety", label: "Seguridad" },
  { code: "account", label: "Cuenta" },
];

export default function HelpSupport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const driver = useLocation().pathname.startsWith("/driver");
  const base = driver ? "/driver" : "/passenger";
  const submitting = useRef(false);
  const [submitted, setSubmitted] = useState(null);
  const [category, setCategory] = useState("ride");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);


  const handleSubmit = async () => {
    if (submitting.current || !user?.id) return;
    if (description.trim().length < 10) {
      toast({ title: "Describí tu problema con más detalle", variant: "destructive" });
      return;
    }
    submitting.current = true;
    setSending(true);
    try {
      const created = await base44.entities.SupportCase.create({
        user_id: user.id,
        user_name: user.full_name || user.email,
        category,
        status: "open",
        description: description.trim(),
      });
      toast({ title: "Consulta enviada", description: "Tu consulta quedó registrada" });
      setSubmitted(created.id || "registrada");
      setDescription("");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-md mx-auto px-5 pt-8 pb-10">
        <button onClick={() => navigate(`${base}/account`)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 min-h-12">
          <ChevronLeft className="w-4 h-4" />Volver
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Ayuda y soporte</h1>
            <p className="text-sm text-muted-foreground">Estamos para ayudarte</p>
          </div>
        </div>

        <Card className="p-4 mb-4 border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="font-semibold text-sm text-destructive">Emergencias</p>
              <p className="text-xs text-muted-foreground">En caso de emergencia llamá al 911. Para temas de seguridad dentro de la app, usá el botón de seguridad durante el viaje.</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link to={`${base}/rides`} className="rounded-2xl border bg-card p-4 min-h-24"><span className="block font-semibold text-sm">Un viaje</span><span className="block text-xs text-muted-foreground mt-2">Consultá el recorrido y su estado</span></Link>
          <Link to={driver ? "/driver/earnings" : "/passenger/wallet"} className="rounded-2xl border bg-card p-4 min-h-24"><span className="block font-semibold text-sm">{driver ? "Cobros y ganancias" : "Pagos y puntos"}</span><span className="block text-xs text-muted-foreground mt-2">Revisá la información de tus pagos</span></Link>
        </div>

        <h2 className="font-semibold text-sm mb-3">Preguntas frecuentes</h2>
        <div className="space-y-2 mb-6">
          {FAQS.map((f, i) => (
            <Card key={i} className="overflow-hidden">
              <button
                aria-expanded={openFaq === i}
                aria-controls={`faq-${i}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium">{f.q}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2 ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && (
                <div id={`faq-${i}`} className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed">{f.a}</div>
              )}
            </Card>
          ))}
        </div>

        <h2 className="font-semibold text-sm mb-3">Contactar a soporte</h2>
        {submitted && <div role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-4"><p className="font-semibold text-sm">Consulta registrada</p><p className="text-xs mt-1">{submitted === "registrada" ? "Recibimos tu consulta." : `Referencia: ${submitted}`}</p></div>}
        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Categoría</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.code}
                  aria-pressed={category === c.code}
                  disabled={sending}
                  onClick={() => setCategory(c.code)}
                  className={`px-3 min-h-12 rounded-full text-xs font-medium transition-colors ${category === c.code ? "bear-gradient text-white" : "bg-secondary text-muted-foreground"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-description">Descripción</Label>
            <Textarea
              id="support-description"
              maxLength={3000}
              disabled={sending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contanos qué pasó..."
              rows={4}
            />
          </div>
          <Button onClick={handleSubmit} disabled={sending || description.trim().length < 10} className="w-full min-h-12 bear-gold-gradient text-foreground border-0">
            {sending ? "Enviando..." : "Enviar consulta"}
          </Button>
        </Card>

      </div>
    </div>
  );
}