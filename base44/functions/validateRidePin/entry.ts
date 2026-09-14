import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, participant, fail, withLock, cas, publicRide } from '../../shared/domain.ts';
export default req => api(req, createClientFromRequest, async (client, user, body) => {
 const e = client.asServiceRole.entities;
 return withLock(e.Ride, body.ride_id, async () => {
  const ride = await participant(client, user, body.ride_id);
  if (ride.driver_id !== user.id || !['DRIVER_ARRIVED','WAITING'].includes(ride.status)) fail('No se puede iniciar este viaje',403);
  if (Date.parse(ride.pin_locked_until || '') > Date.now()) fail('Demasiados intentos. Esperá cinco minutos.',429);
  if (!/^\d{4}$/.test(String(body.pin)) || String(body.pin) !== ride.start_pin) {
   const attempts = (ride.pin_attempts || 0) + 1;
   await e.Ride.update(ride.id, { pin_attempts: attempts, pin_locked_until: attempts % 5 === 0 ? new Date(Date.now()+300000).toISOString() : null });
   fail('PIN incorrecto');
  }
  await cas(e.Ride, { id:ride.id,status:ride.status }, { status:'IN_PROGRESS',pin_attempts:0 });
  return { ride: publicRide(await e.Ride.get(ride.id),user.id) };
 });
});
