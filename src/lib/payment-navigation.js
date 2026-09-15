import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export function validatePaymentUrl(value) {
  const url = new URL(value);
  const hosts = ['www.mercadopago.com.ar', 'mercadopago.com.ar', 'auth.mercadopago.com.ar', 'www.mercadopago.com', 'auth.mercadopago.com', 'sandbox.mercadopago.com.ar'];
  if (url.protocol !== 'https:' || url.username || url.password || !hosts.includes(url.hostname)) throw new Error('El enlace recibido no es un checkout válido de Mercado Pago.');
  return url.href;
}

// Must be called from the click handler, before awaiting the backend.
export async function openPayment(createUrl) {
  const native = Capacitor.isNativePlatform();
  const embedded = !native && window.self !== window.top;
  const popup = embedded ? window.open('about:blank', '_blank') : null;
  if (embedded && !popup) throw new Error('Permití ventanas emergentes para abrir Mercado Pago fuera de la vista previa.');
  if (popup) popup.opener = null;
  try {
    const url = validatePaymentUrl(await createUrl());
    if (native) {
      const listener = await Browser.addListener('browserFinished', () => {
        window.dispatchEvent(new Event('bear-payment-return'));
        listener.remove();
      });
      try { await Browser.open({ url }); }
      catch (error) { await listener.remove(); throw error; }
    } else if (popup) {
      if (popup.closed) throw new Error('Se cerró la ventana de pago. Volvé a intentarlo.');
      popup.location.replace(url);
    } else window.location.assign(url);
  } catch (error) { popup?.close(); throw error; }
}
