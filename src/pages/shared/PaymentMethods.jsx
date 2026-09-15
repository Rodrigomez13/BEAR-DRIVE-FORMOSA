import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { Banknote, QrCode, CreditCard, CheckCircle2 } from 'lucide-react';

const methods = [
  { value: 'cash', label: 'Efectivo', detail: 'Pagás al conductor al finalizar el viaje.', icon: Banknote },
  { value: 'qr', label: 'Mercado Pago', detail: 'Abrís el enlace de pago o escaneás el QR del viaje.', icon: QrCode },
  { value: 'card', label: 'Tarjeta en Mercado Pago', detail: 'Elegís la tarjeta dentro del checkout al pagar.', icon: CreditCard },
];
export default function PaymentMethods() {
  const { user, checkUserAuth } = useAuth();
  const [selected, setSelected] = useState(user?.preferred_payment_method || 'cash');
  const [saving, setSaving] = useState(false);
  const save = async value => {
    if (saving) return;
    setSaving(true);
    try { await base44.auth.updateMe({ preferred_payment_method: value }); setSelected(value); await checkUserAuth(); toast({title:'Preferencia guardada'}); }
    catch (error) { toast({title:'No se pudo guardar',description:error.message,variant:'destructive'}); }
    finally { setSaving(false); }
  };
  return <div className="max-w-md mx-auto px-5 py-6 space-y-5"><Link to="/passenger/wallet" className="inline-flex min-h-12 items-center text-sm text-muted-foreground">Volver a Billetera</Link><h1 className="text-2xl font-bold">Cómo pagás tus viajes</h1><p className="text-sm text-muted-foreground">Elegí tu preferencia. Podés revisarla antes de solicitar cada viaje.</p><div role="group" aria-label="Preferencia de pago" className="space-y-3">{methods.map(({value,label,detail,icon:Icon})=><button type="button" key={value} disabled={saving} aria-pressed={selected===value} onClick={()=>save(value)} className={`w-full flex items-center gap-3 rounded-2xl border p-5 text-left ${selected===value ? 'border-accent bg-accent/10' : 'bg-card'}`}><Icon className="w-6 h-6 shrink-0" /><span className="flex-1"><span className="block font-semibold">{label}</span><span className="block text-xs text-muted-foreground mt-1">{detail}</span></span>{selected===value && <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />}</button>)}</div><p className="text-sm text-muted-foreground rounded-2xl bg-secondary p-4">BearDrive no registra números de tarjeta ni códigos de seguridad. Mercado Pago solicita esos datos en su checkout; elegir esta preferencia no vincula una tarjeta ni realiza un cobro.</p></div>;
}
