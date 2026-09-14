import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { api, fail } from '../../shared/domain.ts';
import { mp } from '../../shared/payments.ts';

export default req => api(req, createClientFromRequest, async (client, user) => {
  if (user.role !== 'admin') fail('Acceso exclusivo para administradores', 403);
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  let manifest;
  try { manifest = JSON.parse(secrets.get('USER_OPERATION_LOCK_IDS') || 'null'); } catch { manifest = null; }
  const e = client.asServiceRole.entities;
  if (Array.isArray(manifest) && manifest.length === 32 && new Set(manifest).size === 32) {
    const locks = await e.UserOperationLock.list('slot', 100);
    add('Coordinación de viajes', manifest.every(id => locks.some(row => row.id === id)), `${manifest.filter(id => locks.some(row => row.id === id)).length}/32 registros disponibles`);
    add('Operaciones en curso', !locks.some(row => manifest.includes(row.id) && row.operation_lock), 'Un bloqueo persistente requiere revisión; no se libera automáticamente.');
  } else add('Coordinación de viajes', false, 'Falta inicializar USER_OPERATION_LOCK_IDS.');
  const configs = await e.DailyChargeConfig.filter({ active: true });
  add('Cargo diario', configs.some(c => Number.isFinite(Number(c.amount)) && Number(c.amount) >= 0 && (!c.effective_from || Date.parse(c.effective_from) <= Date.now())), 'Debe existir una configuración activa vigente.');
  for (const name of ['MP_CLIENT_ID','MP_CLIENT_SECRET','MP_WEBHOOK_SECRET','APP_PUBLIC_URL','MP_REDIRECT_URI','MP_WEBHOOK_URL']) add(name, Boolean(secrets.get(name)), 'Presencia de configuración; no implica autorización del vendedor ni recepción de eventos.');
  try {
    const token = secrets.get('MP_DAILY_CHARGE_ACCESS_TOKEN');
    if (!token) throw new Error('Falta credencial');
    const receiver = await mp('/users/me', token);
    add('Receptor del cargo diario', String(receiver.id) === secrets.get('MP_DAILY_CHARGE_COLLECTOR_ID'), 'La credencial debe corresponder al ID del receptor.');
    add('Receptor de prueba para cargo diario', Array.isArray(receiver.tags) && receiver.tags.includes('test_user'), 'Si no es de prueba, el cargo diario usa una cuenta real. No usarlo para ensayos de pago.');
  } catch {
    add('Receptor del cargo diario', false, 'No se pudo verificar la credencial de Mercado Pago.');
  }
  return { checks, checked_at: new Date().toISOString() };
});
