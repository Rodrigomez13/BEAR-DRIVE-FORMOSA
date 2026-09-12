import { todayBusinessDay } from './pricing.ts';

// Shared ride completion logic — used by completeRide (cash / card success)
// and stripeWebhook (QR payment confirmed). Ensures BearPoints, passenger
// stats, and driver daily charges are applied consistently regardless of
// which payment path triggered the completion.
export async function finalizeRideCompletion(base44, rideId, completedDate) {
  const ride = await base44.asServiceRole.entities.Ride.get(rideId);
  if (!ride) return;

  // 1. Award BearPoints (10 per completed ride)
  const pointsAward = 10;
  const passenger = await base44.asServiceRole.entities.User.get(ride.passenger_id);
  const currentBalance = passenger?.bearpoints_balance || 0;

  await base44.asServiceRole.entities.BearPointsLedger.create({
    user_id: ride.passenger_id,
    points: pointsAward,
    reason: "ride_completed",
    ride_id: rideId,
    balance_after: currentBalance + pointsAward,
  });

  if (passenger) {
    await base44.asServiceRole.entities.User.update(ride.passenger_id, {
      bearpoints_balance: currentBalance + pointsAward,
      total_rides: (passenger.total_rides || 0) + 1,
    });
  }

  // 2. Driver daily charge — only on first completed ride of the business day
  const businessDay = todayBusinessDay(completedDate);
  const existingCharges = await base44.asServiceRole.entities.DriverDailyCharge.filter({
    driver_id: ride.driver_id,
    business_day: businessDay,
  });
  if (existingCharges.length === 0 && ride.driver_id) {
    const chargeConfigs = await base44.asServiceRole.entities.DailyChargeConfig.filter({ active: true });
    const chargeConfig = chargeConfigs[0] || { amount: 1500, currency: "ARS" };
    await base44.asServiceRole.entities.DriverDailyCharge.create({
      driver_id: ride.driver_id,
      driver_name: ride.driver_name || "",
      business_day: businessDay,
      amount: chargeConfig.amount,
      currency: chargeConfig.currency || "ARS",
      status: "pending",
      total_due: chargeConfig.amount,
      trigger_ride_id: rideId,
    });
  }
}