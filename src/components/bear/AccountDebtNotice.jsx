import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function AccountDebtNotice({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    const refresh = () => base44.functions.invoke('getAccountStatus', {}).then(res => { if (live) setStatus(res.data); }).catch(() => {});
    refresh();
    const offRide = base44.entities.Ride.subscribe(refresh);
    const offCharge = base44.entities.DriverDailyCharge.subscribe(refresh);
    window.addEventListener('focus', refresh);
    return () => { live = false; offRide(); offCharge(); window.removeEventListener('focus', refresh); };
  }, [user?.id, pathname]);
  if (!status?.has_debt || user?.role === 'admin') return children;
  return <>
    <div className="fixed top-0 inset-x-0 z-[60] bg-destructive text-white p-3 text-sm safe-top shadow-lg">
      <p>Tenés pagos pendientes. Las nuevas solicitudes, reservas y beneficios están suspendidos.</p>
      <div className="flex gap-4 underline mt-1">
        <Link to={status.unpaid_rides?.length ? '/passenger/wallet' : '/driver/earnings'}>Regularizar pagos</Link>
        <Link to="/help-support">Contactar soporte</Link>
      </div>
    </div>
    {children}
  </>;
}
