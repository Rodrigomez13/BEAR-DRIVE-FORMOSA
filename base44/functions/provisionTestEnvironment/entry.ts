import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CONFIRMATION = 'PROVISION_BEARDRIVE_TEST';
const TEST_VEHICLE_PLATE = 'TEST001';

const DEFAULT_REQUIREMENTS = [
  { subject: 'personal', code: 'dni', label: 'DNI', required: true, requires_expiration: false, grace_allowed: false, sort_order: 10, enabled: true, version: 1 },
  { subject: 'personal', code: 'license', label: 'Licencia de conducir', required: true, requires_expiration: true, grace_allowed: false, sort_order: 20, enabled: true, version: 1 },
  { subject: 'vehicle', code: 'registration', label: 'Cédula del vehículo', required: true, requires_expiration: false, grace_allowed: false, sort_order: 30, enabled: true, version: 1 },
  { subject: 'vehicle', code: 'insurance', label: 'Seguro vigente', required: true, requires_expiration: true, grace_allowed: false, sort_order: 40, enabled: true, version: 1 },
];

function json(data, status = 200) {
  return Response.json(data, { status });
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanMpId(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) throw Object.assign(new Error('Los IDs de Mercado Pago deben ser numéricos.'), { status: 400 });
  return text;
}

async function oneOrNone(entity, query, label) {
  const rows = await entity.filter(query);
  if (rows.length > 1) {
    throw Object.assign(new Error(`${label}: hay ${rows.length} registros duplicados; reconciliá antes de provisionar.`), { status: 409 });
  }
  return rows[0] || null;
}

async function upsert(entity, query, data, label) {
  const current = await oneOrNone(entity, query, label);
  return current ? entity.update(current.id, data) : entity.create(data);
}

async function ensureRequirements(e) {
  for (const definition of DEFAULT_REQUIREMENTS) {
    const current = await oneOrNone(e.DocumentRequirement, { code: definition.code }, `DocumentRequirement ${definition.code}`);
    if (!current) await e.DocumentRequirement.create(definition);
  }
  return e.DocumentRequirement.filter({ enabled: true, required: true });
}

async function provisionPaymentExpectation(e, driverId, expectedSellerId) {
  if (!expectedSellerId) return null;

  const current = await oneOrNone(e.PaymentAccount, { driver_id: driverId }, 'PaymentAccount del Driver Test');
  if (!current) {
    return e.PaymentAccount.create({ driver_id: driverId, seller_id: expectedSellerId });
  }

  if (current.access_token && current.seller_id && String(current.seller_id) !== expectedSellerId) {
    throw Object.assign(
      new Error('El Driver Test ya tiene otra cuenta de Mercado Pago autorizada. No se reemplazó ninguna credencial.'),
      { status: 409 }
    );
  }

  if (current.seller_id && String(current.seller_id) !== expectedSellerId) {
    await e.PaymentAccount.update(current.id, { seller_id: expectedSellerId });
    return e.PaymentAccount.get(current.id);
  }

  return current;
}

export default async function provisionTestEnvironment(req) {
  try {
    const client = createClientFromRequest(req);
    const admin = await client.auth.me();
    if (!admin) return json({ error: 'Iniciá sesión.' }, 401);
    if (admin.role !== 'admin') return json({ error: 'Acceso exclusivo para administradores.' }, 403);

    const body = await req.json();
    if (body?.confirm !== CONFIRMATION) {
      return json({ error: `Confirmación inválida. Usá confirm=${CONFIRMATION}.` }, 400);
    }

    const passengerEmail = cleanEmail(body.passenger_email);
    const driverEmail = cleanEmail(body.driver_email);
    const passengerMpId = cleanMpId(body.passenger_mp_user_id);
    const driverMpId = cleanMpId(body.driver_mp_user_id);

    if (!passengerEmail || !driverEmail) return json({ error: 'passenger_email y driver_email son obligatorios.' }, 400);
    if (passengerEmail === driverEmail) return json({ error: 'Passenger Test y Driver Test deben ser dos identidades distintas.' }, 400);

    const e = client.asServiceRole.entities;
    const [passengerRows, driverRows] = await Promise.all([
      e.User.filter({ email: passengerEmail }),
      e.User.filter({ email: driverEmail }),
    ]);

    if (passengerRows.length > 1 || driverRows.length > 1) {
      return json({ error: 'Hay identidades Base44 duplicadas por email. No se modificó el entorno.' }, 409);
    }

    const passenger = passengerRows[0];
    const driver = driverRows[0];
    const missing = [];
    if (!passenger) missing.push(passengerEmail);
    if (!driver) missing.push(driverEmail);

    if (missing.length) {
      return json({
        error: 'Faltan identidades Base44. Primero deben registrarse o aceptar la invitación.',
        missing_users: missing,
        safe_to_retry: true,
      }, 409);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expires = new Date(now);
    expires.setUTCFullYear(expires.getUTCFullYear() + 1);
    const expiresDate = expires.toISOString().slice(0, 10);

    await e.User.update(passenger.id, {
      is_test_account: true,
      test_persona: 'passenger',
      mercadopago_test_user_id: passengerMpId,
      last_active_mode: 'passenger',
      driver_status: 'NOT_APPLIED',
      driver_capability: 'NO_DRIVER',
    });

    await e.User.update(driver.id, {
      is_test_account: true,
      test_persona: 'driver',
      mercadopago_test_user_id: driverMpId,
      last_active_mode: 'driver',
      driver_status: 'APPROVED',
      driver_capability: 'APPROVED_ELIGIBLE',
    });

    const application = await upsert(
      e.DriverApplication,
      { user_id: driver.id, idempotency_key: `test-environment:${driver.id}` },
      {
        user_id: driver.id,
        applicant_name: driver.full_name || 'BearDrive Driver Test',
        applicant_email: driver.email,
        status: 'APPROVED',
        first_name: 'Driver',
        last_name: 'Test',
        dni_number: `TEST-${driver.id.slice(0, 8)}`,
        birth_date: '1990-01-01',
        phone: '+5493704000000',
        address: 'Formosa Capital - CUENTA DE PRUEBA',
        license_number: `TEST-LIC-${driver.id.slice(0, 8)}`,
        license_class: 'B1',
        submitted_date: nowIso,
        reviewed_by: admin.id,
        review_date: nowIso,
        auto_review_notes: 'TEST FIXTURE: aprobación controlada generada por provisionTestEnvironment.',
        idempotency_key: `test-environment:${driver.id}`,
      },
      'DriverApplication Test'
    );

    const vehicle = await upsert(
      e.Vehicle,
      { driver_id: driver.id, plate: TEST_VEHICLE_PLATE },
      {
        driver_id: driver.id,
        make: 'Toyota',
        model: 'Corolla Test',
        year: 2024,
        plate: TEST_VEHICLE_PLATE,
        color: 'Blanco',
        nickname: 'BearDrive Test Car',
        segment: 'sedan',
        has_ac: true,
        category: 'basic',
        premium_eligible: false,
        status: 'approved',
      },
      'Vehicle Test'
    );

    const requirements = await ensureRequirements(e);
    for (const requirement of requirements) {
      const values = {
        driver_id: driver.id,
        application_id: application.id,
        subject: requirement.subject || 'personal',
        code: requirement.code,
        label: `${requirement.label || requirement.code} [TEST]`,
        file_url: `https://beardrive.com.ar/__test__/documents/${encodeURIComponent(requirement.code)}.pdf`,
        document_number: `TEST-${String(requirement.code).toUpperCase()}-${driver.id.slice(0, 6)}`,
        issued_at: nowIso.slice(0, 10),
        ...(requirement.requires_expiration ? { expires_at: expiresDate } : {}),
        status: 'APPROVED',
        review_comment: 'TEST FIXTURE: documento sintético; no es documentación real.',
        reviewed_by: admin.id,
        review_date: nowIso,
      };
      await upsert(e.DriverDocument, { driver_id: driver.id, code: requirement.code }, values, `DriverDocument ${requirement.code}`);
    }

    const paymentAccount = await provisionPaymentExpectation(e, driver.id, driverMpId);

    const locations = await e.DriverLocation.filter({ driver_id: driver.id });
    for (const location of locations) {
      if (location.online) await e.DriverLocation.update(location.id, { online: false });
    }

    return json({
      ok: true,
      environment: 'test',
      passenger: {
        id: passenger.id,
        email: passenger.email,
        mercadopago_test_user_id: passengerMpId,
      },
      driver: {
        id: driver.id,
        email: driver.email,
        mercadopago_test_user_id: driverMpId,
        application_id: application.id,
        vehicle_id: vehicle.id,
        payment_account_id: paymentAccount?.id || null,
        payment_connected: Boolean(paymentAccount?.access_token),
      },
      safeguards: {
        driver_starts_offline: true,
        oauth_tokens_created: false,
        mercadopago_passwords_stored: false,
        production_users_modified: false,
      },
      next_step: driverMpId
        ? 'Iniciá sesión como Driver Test y usá Conectar Mercado Pago. OAuth solo aceptará el seller TEST esperado.'
        : 'Conectá una cuenta Mercado Pago TEST desde el perfil del Driver Test antes de cobrar viajes.',
    });
  } catch (error) {
    return json({ error: error?.message || 'Error interno.' }, error?.status || 500);
  }
}
