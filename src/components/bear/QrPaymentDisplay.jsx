import React, { useState } from "react";
import { X, QrCode, Copy, Check, ShieldCheck } from "lucide-react";
import Haptics from "@/lib/haptics";
import { toast } from "@/components/ui/use-toast";

// QR payment display — shown to the driver and passenger when QR was chosen.
// The QR encodes the specific trip payment intent URL (PSP).
// Webhook confirms completion and the ride transitions to COMPLETED.
export default function QrPaymentDisplay({ checkoutUrl, amount, rideId, onClose }) {
  const [copied, setCopied] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkoutUrl)}`;

  const handleCopy = async () => {
    Haptics.light();
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      toast({ title: "Link de pago copiado", description: "Podés enviarlo por WhatsApp al pasajero" });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "No se pudo copiar el link", variant: "destructive" });
    }
  };

  return (
    <div className="text-center p-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-accent" />
          <h3 className="font-bold text-base">Cobro QR Dinámico</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold mb-3">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Pago verificado por viaje</span>
      </div>

      <p className="text-xs text-muted-foreground mb-3 max-w-xs mx-auto">
        Mostrale este código al pasajero para que lo escanee con su app de pagos o cámara.
      </p>

      <div className="inline-block p-3.5 bg-white rounded-2xl shadow-xl border border-border">
        <img
          src={qrUrl}
          alt="QR de pago"
          width={240}
          height={240}
          className="rounded-lg mx-auto"
        />
      </div>

      <p className="text-3xl font-black text-accent mt-3 tracking-tight">
        ${(amount || 0).toLocaleString("es-AR")}
      </p>

      <div className="flex items-center justify-center gap-2 mt-3">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary border border-border text-xs font-medium text-foreground transition active:scale-95"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Link copiado" : "Copiar link de pago"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        Esperando confirmación de acreditación...
      </p>
    </div>
  );
}