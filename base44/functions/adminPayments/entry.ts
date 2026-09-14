import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { api, fail } from '../../shared/domain.ts';
import { publicPaymentAccount } from '../../shared/paymentStatus.ts';

export default req => api(req, createClientFromRequest, async (client, user, body) => {
  if (user.role !== 'admin') fail('Acceso exclusivo para administradores', 403);
  const allowed = ['accounts', 'rides', 'charges', 'points'];
  const section = body.section || 'accounts';
  if (!allowed.includes(section)) fail('Sección inválida');
  const page = Number(body.page || 0);
  if (!Number.isInteger(page) || page < 0 || page > 100000) fail('Página inválida');
  const e = client.asServiceRole.entities;
  const names = { accounts: 'PaymentAccount', rides: 'Ride', charges: 'DriverDailyCharge', points: 'BearPointsLedger' };
  const query = section === 'rides' ? { payment_provider: 'mercadopago' } : {};
  const rows = await e[names[section]].filter(query, '-created_date', 51, page * 50);
  const fields = {
    rides: ['id','passenger_name','driver_name','status','payment_status','payment_id','final_fare','quoted_fare','created_date'],
    charges: ['id','driver_id','driver_name','business_day','status','amount','total_due','payment_id','due_at'],
    points: ['id','user_id','points','reason','ride_id','created_date'],
  };
  return {
    section, page, has_more: rows.length > 50,
    rows: rows.slice(0, 50).map(row => section === 'accounts' ? publicPaymentAccount(row) : Object.fromEntries(fields[section].map(key => [key, row[key] ?? null]))),
    configuration: ['MP_CLIENT_ID','MP_CLIENT_SECRET','MP_REDIRECT_URI','APP_PUBLIC_URL','MP_WEBHOOK_URL','MP_WEBHOOK_SECRET','MP_DAILY_CHARGE_ACCESS_TOKEN','MP_DAILY_CHARGE_COLLECTOR_ID'].map(name => ({ name, configured: Boolean(secrets.get(name)) })),
  };
});
