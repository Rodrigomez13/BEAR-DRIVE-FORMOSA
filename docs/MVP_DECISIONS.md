# BearDrive — MVP Functional Decisions

Date: 2026-09-11
Branch: `feat/mobile-functional-mvp`

## Objective

Build a testable Android MVP that can complete a real Passenger → Driver → Ride → Payment flow while keeping the current UI usable and progressively hardening the architecture.

## Confirmed decisions

1. **Immediate goal:** functional real flow and demonstrable APK in parallel, prioritizing real behavior over visual polish.
2. **Backend target:** to be selected by technical audit. Current working decision: keep Base44 temporarily where it already works, introduce an application boundary, and progressively move critical domain/state/realtime concerns toward a backend that can be authoritative and event-driven. Supabase/PostgreSQL is the preferred target unless the audit reveals a blocker.
3. **Migration:** gradual; no full rewrite freeze.
4. **Development data:** disposable/resettable.
5. **Identity model:** one BearDrive account; Driver is an enabled capability/role on the same identity.
6. **E2E validation:** two physical Android devices.
7. **Driver location:** foreground for the first validation, but architecture must be prepared for background tracking.
8. **GPS strategy:** balanced — frequent ephemeral updates for UX, less frequent persistence for matching/audit.
9. **Driver navigation:** turn-by-turn inside BearDrive is the desired product direction. For MVP, implementation may use Google navigation capabilities/external fallback if native in-app navigation would block the vertical slice.
10. **Maps:** Google is the primary provider (Maps, Places, Routes, Geocoding).
11. **Fare:** closed fare with explicitly defined extras; traffic alone must not silently change the quoted fare.
12. **MVP services:** Basic + Flash + Premium.
13. **Matching:** progressive rounds; offer first to highest-scored/closest eligible drivers and widen when needed.
14. **MVP payment:** real PSP / QR integration is required for the first functional slice.
15. **Driver daily charge:** created once after the first COMPLETED ride of the business day; no completed ride means no daily charge.
16. **Notifications:** Realtime first; push follows immediately after the vertical slice.
17. **Admin MVP:** driver approval, vehicle/document approval, pricing/daily-charge configuration, ride/incident/operations visibility.
18. **Git:** GitHub is the source of truth; `android/` is versioned; work happens on a dedicated mobile MVP branch rather than directly on `main`.

## Architecture rules

- No business-critical state transition is decided only in the frontend.
- No private API secret is bundled into Vite/React or the APK.
- Client-visible Google Maps keys must be provider-restricted and application/origin-restricted.
- Avoid fixed-interval API polling for ride/offers state; use realtime/event-driven invalidation and explicit refetch only when state changed.
- Driver GPS persistence and Passenger map animation are separate concerns.
- Payment approval must be confirmed by the PSP/backend webhook, never trusted from a client button.
- The Android native project is source code once Manifest, permissions, notification, deep-link, signing, or native plugin configuration is customized.

## First milestone — MVP Vertical Slice v0.1

Two physical Android devices must be able to complete repeatedly, without manual DB edits:

1. Passenger login.
2. Passenger GPS permission and current location.
3. Destination search and route calculation.
4. Server-authoritative quote.
5. Ride request.
6. Progressive matching.
7. Driver receives offer in realtime while app is open.
8. Driver accepts.
9. Passenger sees assigned driver/state changes.
10. Driver navigates to pickup.
11. Driver arrival.
12. PIN validation.
13. Ride in progress with location updates.
14. Arrival/completion.
15. PSP/QR payment flow and backend confirmation.
16. Ride becomes COMPLETED only after valid domain/payment rules.
17. First completed ride of day generates the Driver daily charge exactly once.
18. Admin can inspect the resulting ride and operational state.

## Immediate technical work

### Progress — 2026-09-12

- Android debug build compiled; user confirmed installation and operation on a physical device. Full two-device ride/payment validation remains pending.
- Native Base44 client uses the configured hosted URL instead of the WebView localhost origin.
- Passenger foreground location now updates independently of the agreed pickup; both map markers use cancellable interpolation.
- Android GPS requests an explicit update interval; the plugin's timeout is no longer implicitly the desired GPS interval.
- Cross-device location still uses Base44 persistence/subscriptions. Supabase Broadcast, private channel authorization and identity integration are pending.
- Supabase public DEV variables are documented in `.env.example` but are not consumed yet. Never bundle server secrets.
- Type checking has outstanding errors; successful bundling does not establish type safety or payment correctness.

### Remaining / original checklist

- Synchronize the local Capacitor/Android state into this branch.
- Add and use Capacitor Geolocation for Android permission/runtime GPS.
- Declare Android coarse/fine location permissions.
- Centralize location access behind a native/web abstraction.
- Remove direct `navigator.geolocation` use from Login and ride flows on native Android.
- Inventory and remove 3–4 second API polling loops, replacing them with realtime subscriptions/events where supported.
- Decouple Google Maps bootstrap from an avoidable Base44 API call while preserving secret-safety.
- Audit current Base44 dependencies and decide which critical functions migrate first.
- Add a payment-provider abstraction before wiring a PSP.
