import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CreditCard, Wallet, Receipt, RefreshCw } from 'lucide-react';

const sections = { accounts: 'Cuentas vinculadas', rides: 'Cobros de viajes', charges: 'Cargos diarios', points: 'BearPoints' };
const labels = { connected: 'Vinculada', pending: 'Pendiente', reconnect: 'Requiere vinculación', paid: 'Pagado', waived: 'Condonado', qr_pending: 'Esperando pago', PAYMENT_PENDING: 'Pago pendiente', COMPLETED: 'Completado', RATED: 'Calificado' };
const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value || 0);
const columns = {
  accounts: [['driver_id','Conductor'],['seller_id','Cuenta MP'],['status','Estado'],['expires_at','Vencimiento del acceso']],
  rides: [['id','Viaje'],['passenger_name','Pasajero'],['driver_name','Conductor'],['payment_status','Pago'],['amount','Importe'],['payment_id','ID pago MP']],
  charges: [['driver_name','Conductor'],['business_day','Día'],['status','Estado'],['amount','Importe'],['payment_id','ID pago MP']],
  points: [['user_id','Usuario'],['points','Puntos'],['reason','Motivo'],['ride_id','Viaje']],
};

export default function AdminPayments() {
  const [section, setSection] = useState('accounts');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readiness, setReadiness] = useState(null);
  const [checking, setChecking] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const checkReadiness = async () => {
    setChecking(true); setReadinessError(''); setReadiness(null);
    try { setReadiness((await base44.functions.invoke('getPaymentReadiness', {})).data); }
    catch (err) { setReadinessError(err.response?.data?.error || 'No se pudo comprobar la integración.'); }
    finally { setChecking(false); }
  };
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    base44.functions.invoke('adminPayments', { section, page })
      .then(res => { if (active) setData(res.data); })
      .catch(err => { if (active) setError(err.response?.data?.error || 'No se pudo cargar la información de pagos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section, page, revision]);
  const value = (row, key) => {
    if (key === 'amount') return money(section === 'rides' ? row.final_fare ?? row.quoted_fare : row.total_due ?? row.amount);
    if (key === 'expires_at') return row[key] ? new Date(row[key]).toLocaleString('es-AR') : '—';
    if (key === 'driver_name') return row[key] || row.driver_id || '—';
    return labels[row[key]] ?? row[key] ?? '—';
  };
  return <div className="max-w-6xl mx-auto space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Pagos y wallet</h1><p className="text-sm text-muted-foreground">Cuentas, cobros y movimientos de la plataforma.</p></div>
      <Button variant="outline" disabled={loading} onClick={() => setRevision(r => r + 1)}><RefreshCw className="w-4 h-4 mr-2" />Actualizar</Button>
    </div>
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="p-4 space-y-2"><CreditCard className="w-5 h-5 text-accent"/><h2 className="font-semibold">Cobros con Mercado Pago</h2><p className="text-sm text-muted-foreground">Los viajes se cobran en la cuenta vinculada del conductor. La acreditación se confirma desde Mercado Pago.</p></Card>
      <Card className="p-4 space-y-2"><Receipt className="w-5 h-5 text-accent"/><h2 className="font-semibold">Cargos de la plataforma</h2><p className="text-sm text-muted-foreground">Cobros diarios separados de los ingresos por viajes.</p><Link className="text-sm underline" to="/admin/pricing">Configurar tarifas y cargo diario</Link></Card>
      <Card className="p-4 space-y-2"><Wallet className="w-5 h-5 text-accent"/><h2 className="font-semibold">Wallet y beneficios</h2><p className="text-sm text-muted-foreground">BearPoints registra puntos de beneficios. Saldo en pesos, recargas, transferencias y retiros: pendientes de implementación.</p></Card>
    </div>

    {data && <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-semibold">Configuración de Mercado Pago · {data.configuration.filter(c => c.configured).length}/{data.configuration.length}</summary><p className="text-sm text-muted-foreground my-3">Indica presencia de configuración; la conexión y los pagos requieren una prueba completa.</p><ul className="space-y-1 text-sm">{data.configuration.map(c => <li key={c.name} className="break-all">{c.configured ? '✓ Configurado' : 'Falta configurar'} · {c.name}</li>)}</ul></details>}
    <div className="flex gap-2 overflow-x-auto" aria-label="Secciones de pagos">{Object.entries(sections).map(([key,label]) => <Button key={key} variant={key === section ? 'default' : 'outline'} aria-pressed={key === section} onClick={() => { setSection(key); setPage(0); }}>{label}</Button>)}</div>
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Preparación para pruebas</h2><Button variant="outline" disabled={checking} onClick={checkReadiness}>{checking ? 'Comprobando…' : 'Comprobar integración'}</Button></div>
      <p className="text-sm text-muted-foreground">Consulta la configuración y el receptor en Mercado Pago. No genera cobros.</p>
      {readinessError && <p role="alert" className="text-destructive text-sm">{readinessError}</p>}
      {readiness && <ul className="space-y-2 text-sm">{readiness.checks.map(check => <li key={check.name}><strong>{check.ok ? '✓' : 'Pendiente'} · {check.name}</strong><p className="text-muted-foreground">{check.detail}</p></li>)}</ul>}
    </Card>
    <Card className="p-4">
      <h2 className="font-semibold mb-4">{sections[section]}</h2>
      {loading && <p role="status">Cargando registros…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {data && !loading && <>
        {!data.rows.length ? <p className="text-muted-foreground">No hay registros en esta página.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{columns[section].map(([key,label]) => <th key={key} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className="border-t">{columns[section].map(([key]) => <td key={key} className="p-3">{String(value(row,key))}{key === 'status' && row.needs_review && <span className="block text-amber-600">Operación en curso o pendiente de revisión</span>}</td>)}</tr>)}</tbody></table></div>}
        <div className="flex items-center justify-between mt-4 gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button><span className="text-sm">Página {page + 1}</span><Button variant="outline" disabled={!data.has_more} onClick={() => setPage(p => p + 1)}>Siguiente</Button></div>
      </>}
    </Card>
    <p className="text-sm text-muted-foreground">Para revisar incidencias o pagos duplicados, abrí <Link className="underline" to="/admin/operations">Soporte</Link>. Los reembolsos y contracargos todavía no se gestionan desde este panel.</p>
  </div>;
}
