import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, all, ACTIVE, fail } from '../../shared/domain.ts';
import { withUserLock } from '../../shared/userLock.ts';

export default req => api(req, createClientFromRequest, async (client, user) => {
  return withUserLock(client, user.id, async () => {
  const entities = client.asServiceRole.entities;
  const rides = await all(entities.Ride, { driver_id: user.id, status: { $in: ACTIVE } });
  if (rides.length) fail('Finalizá el viaje antes de desconectarte', 409);
  const locations = await all(entities.DriverLocation, { driver_id: user.id });
  for (const location of locations) await entities.DriverLocation.update(location.id, { online: false });
  return { online: false };
  });
});
