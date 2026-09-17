import { secrets } from 'base44:runtime';
import { fail, withLock } from './domain.ts';

export function requiredSecret(name) {
  const value = secrets.get(name);
  if (!value) fail(`Falta configurar ${name}`, 503);
  return value;
}

export async function mp(path, token, body = undefined) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method: body ? 'POST' : 'GET',
    signal: AbortSignal.timeout(15000),
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    fail(
      'Mercado Pago no pudo procesar la operación. Intentá nuevamente o contactá soporte.',
      502
    );
  }

  return res.json();
}

export async function sellerAccount(client, driverId) {
  const e = client.asServiceRole.entities;
  const accounts = await e.PaymentAccount.filter({ driver_id: driverId });
  const account = accounts.find(a => a.access_token);

  if (!account) fail('El conductor debe vincular Mercado Pago', 409);

  if (Date.parse(account.expires_at) > Date.now() + 60000) {
    return account;
  }

  return withLock(e.PaymentAccount, account.id, async () => {
    const current = await e.PaymentAccount.get(account.id);

    if (Date.parse(current.expires_at) > Date.now() + 60000) {
      return current;
    }

    if (!current.refresh_token) {
      fail('La vinculación de Mercado Pago venció. Volvé a vincular tu cuenta.', 409);
    }

    const tokens = await mp('/oauth/token', '', {
      client_id: requiredSecret('MP_CLIENT_ID'),
      client_secret: requiredSecret('MP_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: current.refresh_token,
    });

    if (!tokens.access_token || String(tokens.user_id) !== String(current.seller_id)) {
      fail('Cuenta receptora no válida', 502);
    }

    return e.PaymentAccount.update(current.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || current.refresh_token,
      expires_at: new Date(Date.now() + Number(tokens.expires_in || 0) * 1000).toISOString(),
    });
  });
}

export async function checkout(client, entityName, record, account, kind) {
  if (record.payment_checkout_url) {
    return {
      checkout_url: record.payment_checkout_url,
      payment_status: 'qr_pending',
    };
  }

  const amount =
    kind === 'ride'
      ? (record.final_fare || record.quoted_fare)
      : (record.total_due || record.amount);

  if (!(Number(amount) > 0)) fail('Importe inválido');

  const origin = requiredSecret('APP_PUBLIC_URL').replace(/\/$/, '');
  const webhook = requiredSecret('MP_WEBHOOK_URL');
  const target = kind === 'ride' ? 'passenger' : 'driver/earnings';

  const preference = await mp('/checkout/preferences', account.access_token, {
    items: [
      {
        id: record.id,
        title: kind === 'ride' ? 'Viaje BearDrive' : 'Cargo diario BearDrive',
        quantity: 1,
        unit_price: Number(amount),
        currency_id: 'ARS',
      },
    ],
    external_reference: `${kind}:${record.id}`,
    metadata: {
      kind,
      record_id: record.id,
    },
    notification_url: `${webhook}${webhook.includes('?') ? '&' : '?'}kind=${kind}&record_id=${encodeURIComponent(record.id)}`,
    back_urls: {
      success: `${origin}/${target}?payment=success`,
      pending: `${origin}/${target}?payment=pending`,
      failure: `${origin}/${target}?payment=cancelled`,
    },
    auto_return: 'approved',
    marketplace_fee: 0,
  });

  if (
    !preference.init_point ||
    String(preference.collector_id) !== String(account.seller_id)
  ) {
    fail('No se pudo verificar la cuenta receptora', 502);
  }

  await client.asServiceRole.entities[entityName].update(record.id, {
    payment_checkout_url: preference.init_point,
    mp_preference_id: preference.id,
    ...(kind === 'ride'
      ? {
          seller_id: account.seller_id,
          payment_provider: 'mercadopago',
        }
      : {}),
  });

  return {
    checkout_url: preference.init_point,
    payment_status: 'qr_pending',
  };
}

export async function verifyMP(req) {
  const parts = Object.fromEntries(
    (req.headers.get('x-signature') || '')
      .split(',')
      .map(s => s.trim().split('='))
  );

  const url = new URL(req.url);
  const id = url.searchParams.get('data.id');
  const requestId = req.headers.get('x-request-id');

  const ts = Number(parts.ts);
  const ms = ts > 1e12 ? ts : ts * 1000;

  if (
    !id ||
    !requestId ||
    !parts.v1 ||
    !Number.isFinite(ms) ||
    Math.abs(Date.now() - ms) > 600000
  ) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(requiredSecret('MP_WEBHOOK_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(
      `id:${id.toLowerCase()};request-id:${requestId};ts:${parts.ts};`
    )
  );

  const hex = Array.from(
    new Uint8Array(digest),
    b => b.toString(16).padStart(2, '0')
  ).join('');

  if (hex.length !== parts.v1.length) return false;

  let difference = 0;
  for (let i = 0; i < hex.length; i++) {
    difference |= hex.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  }

  return difference === 0;
}

export function paymentMatches(payment, record, sellerId, kind) {
  const amount =
    kind === 'ride'
      ? (record.final_fare || record.quoted_fare)
      : (record.total_due || record.amount);

  return (
    payment.status === 'approved' &&
    payment.currency_id === 'ARS' &&
    Math.round(Number(payment.transaction_amount) * 100) ===
      Math.round(Number(amount) * 100) &&
    String(payment.collector_id) === String(sellerId) &&
    payment.external_reference === `${kind}:${record.id}`
  );
}
