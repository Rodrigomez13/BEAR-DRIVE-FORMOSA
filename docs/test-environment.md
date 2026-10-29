# BearDrive controlled test environment

This document defines the E2E test identities and payment boundaries for BearDrive.

## Identity model

BearDrive and Mercado Pago keep separate identities.

| Persona | Base44 | Mercado Pago | Purpose |
| --- | --- | --- | --- |
| BearDrive central | Existing `admin` account | BearDrive integration + seller TEST credentials | Administration and collection of BearDrive daily charges |
| Passenger Test | Normal Base44 `user`, `is_test_account=true` | Buyer TEST | Requests a ride and pays at Checkout Pro |
| Driver Test | Normal Base44 `user`, `is_test_account=true` | Seller TEST | Accepts rides and receives ride payments |

Never use a Mercado Pago TEST username/password as the Base44 login. Never store Mercado Pago passwords, access tokens, client secrets or webhook secrets in `User`.

## What is automated

`provisionTestEnvironment` is an admin-only backend function. It is guarded by an explicit confirmation token and uses Base44 service-role access only on the server.

For the selected Passenger Test and Driver Test it:

- marks both identities as controlled test accounts;
- keeps the passenger as passenger-only;
- creates or reconciles an administrator-reviewed DriverApplication;
- creates or reconciles an approved synthetic test vehicle (`TEST001`);
- ensures the standard document requirements exist;
- creates approved synthetic test documents for every enabled required document;
- records the expected Mercado Pago TEST user IDs without storing credentials;
- creates/reuses the driver's private `PaymentAccount` expectation;
- refuses to replace an already-authorized Mercado Pago seller with a different seller;
- forces any existing Driver Test location offline after provisioning;
- does not clear rides, balances, charges or financial history.

The function refuses to convert an admin or an already-active production identity into a test account.

## Private Mercado Pago test users

From PowerShell at the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-mp-test-users.ps1
```

The script creates:

- `Driver` Mercado Pago TEST user (seller to authorize through BearDrive OAuth);
- `Passenger` Mercado Pago TEST user (buyer used at checkout).

It writes credentials to `.private/mercadopago-test-users.json`. `.private/` is gitignored. Do not move this file into a tracked directory.

## Base44 test identities

Base44's built-in `User` entity cannot be created through `entities.User.create()`. Identities must be registered or invited through Base44 Auth.

Use two email addresses that you can actually access. They are deliberately different from the generated Mercado Pago TEST usernames.

Run:

```powershell
node scripts/setup-base44-test-environment.mjs
```

The command:

1. logs in using an existing Base44 admin;
2. asks for Passenger Test and Driver Test emails;
3. sends Base44 invitations as `role=user`;
4. reads only the Mercado Pago numeric IDs from `.private/mercadopago-test-users.json`;
5. invokes `provisionTestEnvironment` when both Base44 identities exist;
6. executes `getPaymentReadiness` and prints the integration checks.

If the invitations have not yet been accepted, the command stops safely. Accept both invitations and run the same command again. Provisioning is idempotent.

Environment variables can be used instead of interactive prompts:

```text
BASE44_APP_ID=
BASE44_ADMIN_EMAIL=
BASE44_ADMIN_PASSWORD=
BASE44_TEST_PASSENGER_EMAIL=
BASE44_TEST_DRIVER_EMAIL=
MP_TEST_USERS_FILE=.private/mercadopago-test-users.json
```

Keep those values in ignored local environment files; never commit credentials.

## BearDrive central Mercado Pago account

The central BearDrive account is not a Base44 passenger/driver. In production it is the Mercado Pago account/integration owned by BearDrive. It is used by the backend for BearDrive's own charges, while ride payments are created against the connected driver's seller account.

The current backend expects these Base44 runtime secrets:

```text
MP_CLIENT_ID=
MP_CLIENT_SECRET=
MP_REDIRECT_URI=
MP_WEBHOOK_URL=
MP_WEBHOOK_SECRET=
APP_PUBLIC_URL=
MP_DAILY_CHARGE_ACCESS_TOKEN=
MP_DAILY_CHARGE_COLLECTOR_ID=
```

For a test run, `MP_DAILY_CHARGE_ACCESS_TOKEN` and `MP_DAILY_CHARGE_COLLECTOR_ID` must identify a Mercado Pago seller TEST account. `getPaymentReadiness` calls `/users/me` and explicitly checks that the receiver is a test user before the integration is considered safe for test charges.

For Checkout Pro, Mercado Pago provides a seller test account/credentials for the application. Use TEST credentials while validating; do not insert production credentials into the test setup.

`MP_REDIRECT_URI` is the OAuth callback for driver account authorization. `MP_WEBHOOK_URL` is the backend `mercadopagoWebhook` endpoint. They are different responsibilities and must not be interchanged.

## Driver Mercado Pago connection

The provisioner can record the expected Driver TEST Mercado Pago `User ID`, but it deliberately does not create an OAuth token.

After provisioning:

1. sign in to BearDrive as Driver Test;
2. open Driver profile/payment settings;
3. choose **Conectar Mercado Pago**;
4. authenticate with the generated Mercado Pago Driver TEST account;
5. approve OAuth consent;
6. BearDrive stores the returned access/refresh tokens only in the private `PaymentAccount` entity;
7. the callback rejects the authorization if Mercado Pago returns a different seller ID from the TEST seller expected by the seed.

## Passenger Mercado Pago payment

The Passenger Test Base44 account never stores Mercado Pago credentials.

At the end of a test ride:

1. BearDrive creates Checkout Pro against the connected Driver TEST seller;
2. the Passenger Test opens the checkout;
3. sign in to Mercado Pago using the generated Buyer TEST account;
4. complete the simulated payment;
5. Mercado Pago calls `mercadopagoWebhook`;
6. BearDrive verifies the webhook signature, fetches the payment server-side and verifies amount, currency, collector and `external_reference` before marking the ride paid/completed.

## Required E2E order

```text
1. Mercado Pago Driver TEST + Passenger TEST created
2. Base44 Passenger Test + Driver Test invited/registered
3. provisionTestEnvironment succeeds
4. getPaymentReadiness has no blocking payment configuration failures
5. Driver Test authorizes Mercado Pago seller through OAuth
6. Driver Test goes online with TEST001
7. Passenger Test requests a ride
8. Driver Test accepts and completes it
9. Passenger Test pays using Mercado Pago Buyer TEST
10. Signed webhook confirms payment
11. Ride becomes paid/completed
12. Daily Driver charge is generated and paid to BearDrive TEST receiver separately
```

Do not merge or switch central payment secrets to production until this complete flow has been observed end-to-end with TEST accounts.
