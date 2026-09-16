export const ACTIVE = ['SEARCHING', 'ASSIGNED', 'DRIVER_APPROACHING', 'DRIVER_ARRIVED', 'WAITING', 'PIN_VALIDATION', 'IN_PROGRESS', 'ARRIVED'];
export const FINISHED = ['COMPLETED', 'RATED', 'CANCELLED', 'NO_DRIVERS', 'NO_SHOW'];
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export async function api(req, createClient, handler) {
  try {
    const client = createClient(req);
    const user = await client.auth.me();
    if (!user) fail('Iniciá sesión', 401);
    return Response.json(await handler(client, user, await req.json()));
  } catch (e) { return Response.json({ error: e.message }, { status: e.status || 500 }); }
}
export async function all(entity, query = {}) {
  const rows = [];
  for (let skip = 0; ; skip += 500) {
    const page = await entity.filter(query, 'created_date', 500, skip);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
// Conditional writes must report a matched change. Never infer a win from a later read.
export async function cas(entity, query, data) {
  const result = await entity.updateMany(query, { $set: data });
  if (result.updated !== 1) fail('El estado cambió. Actualizá e intentá nuevamente.', 409);
}
// No automatic lock stealing: an interrupted operation requires reconciliation before
// unlocking. This favors blocking a retry over duplicating a financial operation.
export async function withLock(entity, id, fn) {
  const token = crypto.randomUUID();
  await cas(entity, { id, operation_lock: null }, { operation_lock: token, operation_started_at: new Date().toISOString() });
  try { return await fn(); }
  finally { await entity.updateMany({ id, operation_lock: token }, { $set: { operation_lock: null } }); }
}
export function businessDay(date = new Date()) {
  return new Date(new Date(date).getTime() - 3 * 3600000).toISOString().slice(0, 10);
}
export function chargeDue(day) {
  return new Date(new Date(`${day}T00:00:00-03:00`).getTime() + 39 * 3600000).toISOString();
}
export function premiumEligible(vehicle) {
  const year = Number(vehicle.year);
  const registrationYear = new Date(vehicle.created_date).getUTCFullYear();
  return Number.isInteger(year) && Number.isFinite(registrationYear) && year <= registrationYear && registrationYear - year <= 3;
}
export async function debtStatus(client, userId) {
  const e = client.asServiceRole.entities;
  const [charges, rides] = await Promise.all([
    all(e.DriverDailyCharge, { driver_id: userId, status: 'pending' }),
    all(e.Ride, { passenger_id: userId, status: 'PAYMENT_PENDING' }),
  ]);
  const overdue = charges.filter(c => Date.now() >= Date.parse(c.due_at || chargeDue(c.business_day)));
  return { blocked: false, has_debt: charges.length > 0 || rides.length > 0, overdue_count: overdue.length, charges: charges.map(c => chargeBalance(c)), unpaid_rides: rides };
}

export async function eligibleVehicle(client, user, vehicleId) {
  const e = client.asServiceRole.entities;
  // Approval is verified from administrator-reviewed records, not editable profile flags.
  const applications = await all(e.DriverApplication, { user_id: user.id, status: 'APPROVED' });
  if (!applications.some(a => a.reviewed_by)) fail('No estás habilitado para conducir', 403);
  const vehicle = await e.Vehicle.get(vehicleId);
  if (!vehicle || vehicle.driver_id !== user.id || vehicle.status !== 'approved') fail('Vehículo no aprobado', 403);
  const docs = await all(e.DriverDocument, { driver_id: user.id });
  const requirements = await all(e.DocumentRequirement, { enabled: true, required: true });
  if (!requirements.length || requirements.some(r => !docs.some(d => d.code === r.code && d.status === 'APPROVED' && d.file_url && (!r.requires_expiration || d.expires_at)))) fail('Falta documentación obligatoria aprobada', 403);
  if (docs.some(d => d.expires_at && d.expires_at < businessDay())) fail('Hay documentación vencida. Actualizala para conducir.', 403);
  return vehicle;
}
export async function participant(client, user, id) {
  const ride = await client.asServiceRole.entities.Ride.get(id);
  if (!ride || ![ride.passenger_id, ride.driver_id].includes(user.id)) fail('No autorizado para este viaje', 403);
  return ride;
}
export function publicRide(ride, userId) {
  const result = { ...ride };
  delete result.operation_lock;
  if (ride.passenger_id !== userId) delete result.start_pin;
  return result;
}

// Simple interest on the original principal, never compounded. Existing checkouts
// retain their agreed amount so a delayed webhook can still settle the debt.
export function chargeBalance(charge, now = Date.now()) {
  if (charge.status !== 'pending' || charge.payment_checkout_url) return charge;
  const due = Date.parse(charge.due_at || chargeDue(charge.business_day));
  const days = Number.isFinite(due) ? Math.max(0, Math.floor((now - due) / 86400000) - (charge.grace_days || 0)) : 0;
  const rate = Number(charge.late_fee_coefficient || 0);
  const principal = Number(charge.amount || 0);
  const late_fee = Math.round(principal * (Number.isFinite(rate) && rate >= 0 ? rate : 0) * days * 100) / 100;
  return {...charge, overdue_days: days, late_fee, total_due: Math.round((principal + late_fee) * 100) / 100};
}
