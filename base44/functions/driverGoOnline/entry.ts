import { eligibleVehicle } from '../../shared/domain.ts';
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
    await eligibleVehicle(base44, user, vehicle_id);

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