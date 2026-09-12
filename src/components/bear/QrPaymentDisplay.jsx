import React from "react";
import { X, QrCode } from "lucide-react";

// QR payment display — shown to the driver when the passenger chose QR/transfer.
// The QR encodes the Stripe Checkout URL. The passenger scans it with their
// camera (or taps "Pagar" in their app) to complete the payment via Stripe.
// The webhook confirms completion and the ride transitions to COMPLETED.
export default function QrPaymentDisplay({ checkoutUrl, amount, onClose }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkoutUrl)}`;

  return (
    <div className="text-center">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-accent" />
          <h3 className="font-bold">Cobro con QR</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Mostrale este QR al pasajero para que lo escanee y pague
      </p>
      <div className="inline-block p-4 bg-white rounded-2xl shadow-lg">
        <img src={qrUrl} alt="QR de pago" width={250} height={250} className="rounded-lg" />
      </div>
      <p className="text-3xl font-extrabold text-accent mt-4">
        ${(amount || 0).toLocaleString("es-AR")}
      </p>
      <p className="text-xs text-muted-foreground mt-2 animate-pulse">
        Esperando pago del pasajero...
      </p>
    </div>
  );
}