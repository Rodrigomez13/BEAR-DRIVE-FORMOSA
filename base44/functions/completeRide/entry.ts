import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { todayBusinessDay } from '../../shared/pricing.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id, final_fare, payment_method } = body;

    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    // Use service role for cross-user ride access (driver completes a ride owned by passenger)
    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    if (!["IN_PROGRESS", "ARRIVED", "PAYMENT_PENDING"].includes(ride.status)) {
      return Response.json({ error: "El viaje no está en un estado que permita finalizar" }, { status: 400 });
    }

    // Only the assigned driver or the passenger can complete
    if (ride.driver_id !== user.id && ride.passenger_id !== user.id) {
      return Response.json({ error: "No autorizado para este viaje" }, { status: 403 });
    }

    const fare = typeof final_fare === "number" ? final_fare : ride.quoted_fare;
    const completedDate = new Date().toISOString();

    // 1. Mark ride COMPLETED
    const updated = await base44.asServiceRole.entities.Ride.update(ride_id, {
      status: "COMPLETED",
      final_fare: fare,
      payment_method: payment_method || ride.payment_method,
      completed_date: completedDate
    });

    // 2. Award BearPoints to passenger (10 points per completed ride)
    const pointsAward = 10;
    const passengerLedger = await base44.asServiceRole.entities.BearPointsLedger.create({
      user_id: ride.passenger_id,
      points: pointsAward,
      reason: "ride_completed",
      ride_id: ride_id,
      balance_after: (ride.passenger_id === user.id ? user.bearpoints_balance || 0 : 0) + pointsAward
    });
    // Update passenger balance
    const passenger = await base44.asServiceRole.entities.User.get(ride.passenger_id);
    if (passenger) {
      await base44.asServiceRole.entities.User.update(ride.passenger_id, {
        bearpoints_balance: (passenger.bearpoints_balance || 0) + pointsAward,
        total_rides: (passenger.total_rides || 0) + 1
      });
    }

    // 3. Driver daily charge — only on first completed ride of the business day
    const businessDay = todayBusinessDay(completedDate);
    const existingCharges = await base44.asServiceRole.entities.DriverDailyCharge.filter({
      driver_id: ride.driver_id,
      business_day: businessDay
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
        trigger_ride_id: ride_id
      });
    }

    return Response.json({
      ride: updated,
      bearpoints_awarded: pointsAward,
      daily_charge_created: existingCharges.length === 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}