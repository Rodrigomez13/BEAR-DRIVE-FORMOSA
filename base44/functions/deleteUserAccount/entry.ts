import { ACTIVE, all, debtStatus } from '../../shared/domain.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Permanently deletes the calling user's account and all associated data.
// Called by the authenticated user from the profile screens.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.id;

    const status = await debtStatus(base44, userId);
    const active = await all(base44.asServiceRole.entities.Ride, { $or: [{ passenger_id: userId }, { driver_id: userId }], status: { $in: ACTIVE } });
    if (status.charges.length || status.unpaid_rides.length || active.length) return Response.json({ error: 'Regularizá pagos y finalizá tus viajes antes de eliminar la cuenta.' }, { status: 409 });

    // Delete all user-owned data (service role bypasses RLS)
    const cleanup = [


      () => base44.asServiceRole.entities.FavoritePlace.deleteMany({ created_by_id: userId }),
      () => base44.asServiceRole.entities.DriverDocument.deleteMany({ driver_id: userId }),
      () => base44.asServiceRole.entities.Vehicle.deleteMany({ driver_id: userId }),
      () => base44.asServiceRole.entities.DriverApplication.deleteMany({ user_id: userId }),
      () => base44.asServiceRole.entities.DriverLocation.deleteMany({ driver_id: userId }),
      () => base44.asServiceRole.entities.SupportCase.deleteMany({ user_id: userId }),
      () => base44.asServiceRole.entities.BearPointsLedger.deleteMany({ user_id: userId }),
      () => base44.asServiceRole.entities.Rating.deleteMany({ rater_id: userId }),
      () => base44.asServiceRole.entities.Rating.deleteMany({ ratee_id: userId }),
      () => base44.asServiceRole.entities.PaymentAccount.deleteMany({ driver_id: userId }),
      () => base44.asServiceRole.entities.RideQuote.deleteMany({ passenger_id: userId }),
    ];

    for (const fn of cleanup) {
      try { await fn(); } catch (e) { console.error("Cleanup step failed:", e?.message); }
    }

    // Attempt to delete the user account itself
    let userDeleted = false;
    try {
      await base44.asServiceRole.entities.User.delete(userId);
      userDeleted = true;
    } catch (e) {
      console.error("User record deletion failed:", e?.message);
    }

    return Response.json({ success: true, user_deleted: userDeleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}