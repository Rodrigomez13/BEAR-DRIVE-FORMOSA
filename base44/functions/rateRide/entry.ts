import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id, score, comment, tags } = body;

    if (!ride_id || typeof score !== "number") {
      return Response.json({ error: "ride_id y score son obligatorios" }, { status: 400 });
    }
    if (score < 1 || score > 5) {
      return Response.json({ error: "El puntaje debe estar entre 1 y 5" }, { status: 400 });
    }

    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    // Determine who is being rated: if current user is passenger, they rate the driver; vice versa
    let rateeId, rateeRole, raterRole;
    if (ride.passenger_id === user.id) {
      rateeId = ride.driver_id;
      rateeRole = "driver";
      raterRole = "passenger";
    } else if (ride.driver_id === user.id) {
      rateeId = ride.passenger_id;
      rateeRole = "passenger";
      raterRole = "driver";
    } else {
      return Response.json({ error: "No autorizado para este viaje" }, { status: 403 });
    }

    // Idempotency: one rating per rater per ride
    const existing = await base44.asServiceRole.entities.Rating.filter({ ride_id, rater_id: user.id });
    if (existing.length > 0) {
      return Response.json({ error: "Ya calificaste este viaje" }, { status: 400 });
    }

    await base44.asServiceRole.entities.Rating.create({
      ride_id,
      rater_id: user.id,
      ratee_id: rateeId,
      ratee_role: rateeRole,
      score,
      tags: tags || null,
      comment: comment || null
    });

    // Update ride with rating
    const updateField = raterRole === "passenger" ? "driver_rating" : "passenger_rating";
    await base44.asServiceRole.entities.Ride.update(ride_id, { [updateField]: score, rating_comment: comment || null });

    // Recompute ratee average rating
    const allRatings = await base44.asServiceRole.entities.Rating.filter({ ratee_id: rateeId });
    const avg = allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length;
    await base44.asServiceRole.entities.User.update(rateeId, { rating_avg: Math.round(avg * 100) / 100 });

    // If both rated, mark ride RATED
    const allRideRatings = await base44.asServiceRole.entities.Rating.filter({ ride_id });
    if (allRideRatings.length >= 2) {
      await base44.asServiceRole.entities.Ride.update(ride_id, { status: "RATED" });
    }

    return Response.json({ ok: true, ratee_avg: Math.round(avg * 100) / 100 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}