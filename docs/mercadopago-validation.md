# Mercado Pago: correction and validation

The linking failure `Bulk user update not allowed` originates in
`connectDriverPayments` using `withLock(User, ...)`. Base44 rejects User bulk
updates. OAuth setup now serializes on the driver's reviewed application and,
for existing accounts, on PaymentAccount. PKCE and expiring, one-use state remain
required. Callback expiry is checked again inside the account lock.

PaymentAccount remains unreadable from browser clients. The new
`getDriverPaymentAccount` returns an explicit metadata allowlist. AdminPayments
uses a server-authorized, paginated endpoint and never returns OAuth credentials.

Admin sections: linked accounts, Mercado Pago ride payments, daily charges,
BearPoints ledger, configuration presence. Presence of secrets is not verification
of credentials or of provider delivery. Monetary wallet balances, top-ups,
transfers, withdrawals, refunds and chargeback operations are not implemented.

## Validation

- 27 Node tests pass, including OAuth regression, authorization, credential
  redaction, invalid callback expiry, payment matching and webhook signature tests.
- `npx base44 build` passes.
- Targeted frontend ESLint passes. Repository-wide lint has 15 existing unused
  imports outside the modified components. Repository-wide typecheck has existing
  JSX component typing and ImportMeta errors and is not a passing gate.
- Local fixture browser: accounts, paid ride, pending daily charge and empty
  points section verified. These are simulated records, not provider transactions.
- Hosted secret names were confirmed. Local backend configuration was aligned
  with `.env.local`; secret files remain ignored.

## Remaining end-to-end work

Publish through GitHub sync and the Base44 dashboard as described in README.
Verify a test seller's OAuth consent, callback and displayed account status, then
complete a test payment and verify the signed webhook and stored payment ID.
Provider authorization must use exactly the configured redirect URI.
Reference: https://www.mercadopago.com.ar/developers/en/docs/security/oauth/creation

Separate pre-existing blocker: `createRide`, `acceptRide` and
`shared/rideCompletion.ts` still acquire User locks with updateMany. Those require
a supported durable concurrency primitive before the complete ride/payment flow
can be certified. Do not replace them with unconditional User.update: that would
remove the concurrency protection. Existing in-memory domain tests model User
bulk writes, so their pass does not establish hosted support for those operations.
