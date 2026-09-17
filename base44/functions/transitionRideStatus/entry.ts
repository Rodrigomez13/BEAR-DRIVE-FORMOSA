import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, participant, fail, cas, publicRide } from '../../shared/domain.ts';
const transitions = { DRIVER_APPROACHING: 'DRIVER_ARRIVED', IN_PROGRESS: 'ARRIVED', ARRIVED: 'PAYMENT_PENDING' };
export default req => api(req, createClientFromRequest, async (client, user, body) => {
 const ride = await participant(client, user, body.ride_id);
 if (ride.driver_id !== user.id || transitions[ride.status] !== body.target_status) fail('Transición no permitida', 403);
 await cas(client.asServiceRole.entities.Ride, { id: ride.id, status: ride.status }, { status: body.target_status });
 return { ride: publicRide(await client.asServiceRole.entities.Ride.get(ride.id), user.id) };
});
