import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (user.role !== "admin") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { application_id, action, reason } = body;

    if (!application_id) return Response.json({ error: "application_id es obligatorio" }, { status: 400 });
    if (!["approve", "reject", "more_info", "suspend", "reactivate"].includes(action)) {
      return Response.json({ error: "Acción inválida" }, { status: 400 });
    }

    const application = await base44.asServiceRole.entities.DriverApplication.get(application_id);
    if (!application) return Response.json({ error: "Solicitud no encontrada" }, { status: 404 });

    const now = new Date().toISOString();
    let newStatus, driverStatus, capability, logAction;

    if (action === "approve") {
      newStatus = "APPROVED";
      driverStatus = "APPROVED";
      capability = "APPROVED_ELIGIBLE";
      logAction = "driver_approved";
    } else if (action === "reject") {
      newStatus = "REJECTED";
      driverStatus = "REJECTED";
      capability = "NO_DRIVER";
      logAction = "driver_rejected";
    } else if (action === "suspend") {
      newStatus = "SUSPENDED";
      driverStatus = "SUSPENDED";
      capability = "SUSPENDED";
      logAction = "driver_suspended";
    } else if (action === "reactivate") {
      newStatus = "APPROVED";
      driverStatus = "APPROVED";
      capability = "APPROVED_ELIGIBLE";
      logAction = "driver_reactivated";
    } else {
      newStatus = "MORE_INFO_REQUIRED";
      driverStatus = "MORE_INFO_REQUIRED";
      capability = "ONBOARDING";
      logAction = "driver_more_info_requested";
    }

    // Update application
    await base44.asServiceRole.entities.DriverApplication.update(application_id, {
      status: newStatus,
      reviewed_by: user.id,
      review_date: now,
      rejection_reason: action === "reject" ? reason : null,
      more_info_reason: action === "more_info" ? reason : null,
      suspend_reason: action === "suspend" ? (reason || "Suspensión administrativa") : null
    });

    // Update user driver status + capability
    await base44.asServiceRole.entities.User.update(application.user_id, {
      driver_status: driverStatus,
      driver_capability: capability
    });

    // If approved, approve all pending documents for this application
    if (action === "approve") {
      const docs = await base44.asServiceRole.entities.DriverDocument.filter({ application_id: application_id });
      for (const doc of docs) {
        if (doc.status === "PENDING") {
          await base44.asServiceRole.entities.DriverDocument.update(doc.id, {
            status: "APPROVED",
            reviewed_by: user.id,
            review_date: now
          });
        }
      }
      // Approve pending vehicles
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ driver_id: application.user_id, status: "pending" });
      for (const v of vehicles) {
        await base44.asServiceRole.entities.Vehicle.update(v.id, { status: "approved" });
      }
    }

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      action: logAction,
      entity_type: "DriverApplication",
      entity_id: application_id,
      old_value: application.status,
      new_value: newStatus,
      reason: reason || null
    });

    return Response.json({ ok: true, new_status: newStatus });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}