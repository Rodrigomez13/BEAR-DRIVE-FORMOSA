import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Server-authoritative driver go-online — validates eligibility before allowing
// a driver to receive ride requests. The frontend cannot bypass these checks:
// 1. driver_capability must be APPROVED_ELIGIBLE
// 2. vehicle must belong to the driver and be approved
// 3. no blocking overdue debt (daily charges past grace period)
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { lat, lng, vehicle_id } = body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return Response.json({ error: "lat y lng son obligatorios" }, { status: 400 });
    }
    if (!vehicle_id) {
      return Response.json({ error: "vehicle_id es obligatorio" }, { status: 400 });
    }

    // 1. Verify driver is eligible
    if (user.driver_capability !== "APPROVED_ELIGIBLE") {
      return Response.json({
        error: "No estás habilitado para conducir",
        reason: "not_eligible",
        capability: user.driver_capability
      }, { status: 403 });
    }

    // 2. Verify vehicle belongs to driver and is approved
    const vehicle = await base44.asServiceRole.entities.Vehicle.get(vehicle_id);
    if (!vehicle || vehicle.driver_id !== user.id) {
      return Response.json({ error: "Vehículo no válido", reason: "invalid_vehicle" }, { status: 400 });
    }
    if (vehicle.status !== "approved") {
      return Response.json({ error: "El vehículo no está aprobado", reason: "vehicle_not_approved" }, { status: 400 });
    }

    // 3. Check for blocking debt — overdue daily charges past grace period
    const pendingCharges = await base44.asServiceRole.entities.DriverDailyCharge.filter({
      driver_id: user.id,
      status: "pending"
    });
    const now = new Date();
    const graceDays = 3;
    let hasBlockingDebt = false;
    for (const charge of pendingCharges) {
      const businessDate = new Date(charge.business_day + "T00:00:00Z");
      const daysPast = Math.floor((now - businessDate) / (1000 * 60 * 60 * 24));
      if (daysPast > graceDays) {
        hasBlockingDebt = true;
        break;
      }
    }
    if (hasBlockingDebt) {
      return Response.json({
        error: "Tenés deuda vencida. Regularizá tu cuenta para conducir.",
        reason: "blocking_debt"
      }, { status: 403 });
    }

    // 4. Create or update DriverLocation
    const locations = await base44.asServiceRole.entities.DriverLocation.filter({ driver_id: user.id });
    let driverLocation;
    if (locations.length > 0) {
      driverLocation = await base44.asServiceRole.entities.DriverLocation.update(locations[0].id, {
        lat, lng, online: true, vehicle_id
      });
    } else {
      driverLocation = await base44.asServiceRole.entities.DriverLocation.create({
        driver_id: user.id, lat, lng, online: true, vehicle_id
      });
    }

    return Response.json({ driver_location: driverLocation });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}