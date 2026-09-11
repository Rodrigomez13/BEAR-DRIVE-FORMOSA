# BearDrive remote sync analysis — 2026-09-11

Latest `main` changes after the previous realtime-navigation sync:

- Driver acceptance now falls back to the last known driver position if a fresh GPS fix fails.
- Passenger quote recalculates when service category changes.
- Driver navigation gained a CSS-based pseudo-3D fallback mode in the web map.
- GPS precision thresholds and more frequent active-ride location updates were introduced.
- Passenger DriverLocation updates moved from repeated location polling to Base44 realtime subscription, while ride-state polling still remains.
- Branding assets and Android launcher mark were refreshed.

Pending before merging navigation feature to main:

1. Reconcile the web pseudo-3D navigation with the native Google Navigation SDK path; native Android must remain authoritative for Driver turn-by-turn.
2. Remove remaining Ride polling and use realtime state events with recovery fetches.
3. Avoid persisting high-frequency DriverLocation updates when RideTracking realtime already carries active-trip movement.
4. Replace external Base44-hosted PWA icon dependencies with versioned local assets for offline/reproducible builds.
5. Keep Passenger camera framing stable: driver + pickup/target visible, manual exploration suspends follow, explicit recenter restores it.
6. Use heading-aware vehicle marker rather than a generic pin.
7. Verify RideTracking backend permissions so only ride participants/admin can read and only the assigned driver/backend can publish.
8. Validate native Navigation SDK build and two-device E2E before merging to main.
