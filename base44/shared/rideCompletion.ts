import { all, businessDay, chargeDue, fail } from './domain.ts';
import { withUserLock } from './userLock.ts';

async function resolveDailyChargeConfig(entities, completedDate) {
  const configs = await all(entities.DailyChargeConfig, { active: true });
  const completedAt = Date.parse(completedDate || new Date().toISOString());

  const valid = configs
    .filter(config => {
      if (!config.effective_from) return true;
      const effectiveFrom = Date.parse(config.effective_from);
      return Number.isFinite(effectiveFrom) && effectiveFrom <= completedAt;
    })
    .sort((a, b) => {
      const aDate = Date.parse(a.effective_from || '1970-01-01T00:00:00.000Z');
      const bDate = Date.parse(b.effective_from || '1970-01-01T00:00:00.000Z');
      return bDate - aDate;
    });

  const config = valid[0];

  if (!config) {
    fail('El cargo diario no tiene una configuración activa', 503);
  }

  const amount = Number(config.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    fail('El importe del cargo diario es inválido', 503);
  }

  return {
    amount,
    currency: String(config.currency || 'ARS'),
  };
}

// Caller holds the ride lock.
// Effects are reconstructed by ride and business day.
export async function finalizeRideCompletion(client, rideId, completedDate) {
  const e = client.asServiceRole.entities;
  const ride = await e.Ride.get(rideId);

  if (
    !ride ||
    !['COMPLETED', 'RATED'].includes(ride.status) ||
    ride.completion_effects_done
  ) {
    return;
  }

  await withUserLock(client, ride.passenger_id, async () => {
    const ledger = await all(e.BearPointsLedger, {
      user_id: ride.passenger_id,
    });

    if (
      !ledger.some(
        row =>
          row.ride_id === rideId &&
          row.reason === 'ride_completed'
      )
    ) {
      await e.BearPointsLedger.create({
        user_id: ride.passenger_id,
        points: 10,
        reason: 'ride_completed',
        ride_id: rideId,
      });
    }

    const updated = await all(e.BearPointsLedger, {
      user_id: ride.passenger_id,
    });

    const completed = await all(e.Ride, {
      passenger_id: ride.passenger_id,
      status: { $in: ['COMPLETED', 'RATED'] },
    });

    await e.User.update(ride.passenger_id, {
      bearpoints_balance: updated.reduce((sum, row) => sum + Number(row.points || 0), 0),
      total_rides: completed.length,
    });
  });

  if (ride.driver_id) {
    await withUserLock(client, ride.driver_id, async () => {
      const day = businessDay(completedDate);

      const charges = await e.DriverDailyCharge.filter({
        driver_id: ride.driver_id,
        business_day: day,
      });

      if (!charges.length) {
        const chargeConfig = await resolveDailyChargeConfig(e, completedDate);

        // amount = 0 can be used to temporarily waive the daily fee.
        if (chargeConfig.amount > 0) {
          await e.DriverDailyCharge.create({
            driver_id: ride.driver_id,
            driver_name: ride.driver_name || '',
            business_day: day,
            amount: chargeConfig.amount,
            total_due: chargeConfig.amount,
            currency: chargeConfig.currency,
            status: 'pending',
            due_at: chargeDue(day),
            trigger_ride_id: rideId,
          });
        }
      }

      const queued = await e.Ride.filter({
        driver_id: ride.driver_id,
        status: 'ASSIGNED',
        queued_after_ride_id: rideId,
      });

      for (const next of queued) {
        await e.Ride.updateMany(
          {
            id: next.id,
            status: 'ASSIGNED',
            queued_after_ride_id: rideId,
          },
          {
            $set: {
              status: 'DRIVER_APPROACHING',
              queued_after_ride_id: null,
            },
          }
        );
      }
    });
  }

  await e.Ride.update(rideId, {
    completion_effects_done: true,
  });
}
