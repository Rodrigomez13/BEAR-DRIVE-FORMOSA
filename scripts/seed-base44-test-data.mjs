import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import process from 'node:process';
import { createClient } from '@base44/sdk';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const AUTO_YES = args.has('--yes');

const PRICING = {
  name: 'Formosa Test',
  base_fare: 300,
  per_km: 120,
  per_min: 40,
  min_fare: 500,
  flash_supplement: 200,
  premium_multiplier: 1.5,
  currency: 'ARS',
  active: true,
  retry_increase_percent: 5,
  retry_radius_step_km: 5,
};

const DAILY_CHARGE = {
  name: 'Cargo diario BearDrive',
  amount: 5000,
  currency: 'ARS',
  late_fee_coefficient: 0.1,
  grace_days: 3,
  active: true,
};

const DOCUMENT_REQUIREMENTS = [
  {
    subject: 'personal',
    code: 'dni',
    label: 'DNI',
    required: true,
    requires_expiration: false,
    grace_allowed: false,
    sort_order: 10,
    enabled: true,
    version: 1,
  },
  {
    subject: 'personal',
    code: 'license',
    label: 'Licencia de conducir',
    required: true,
    requires_expiration: true,
    grace_allowed: false,
    sort_order: 20,
    enabled: true,
    version: 1,
  },
  {
    subject: 'vehicle',
    code: 'registration',
    label: 'Cédula del vehículo',
    required: true,
    requires_expiration: false,
    grace_allowed: false,
    sort_order: 30,
    enabled: true,
    version: 1,
  },
  {
    subject: 'vehicle',
    code: 'insurance',
    label: 'Seguro vigente',
    required: true,
    requires_expiration: true,
    grace_allowed: false,
    sort_order: 40,
    enabled: true,
    version: 1,
  },
];

function readLinkedAppId() {
  const file = path.resolve('base44/.app.jsonc');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/"id"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

async function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(question);
    } finally {
      rl.close();
    }
  }

  return await new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = '';

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          cleanup();
          stdout.write('\n');
          reject(new Error('Cancelado por el usuario.'));
          return;
        }
        if (ch === '\r' || ch === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };

    stdin.on('data', onData);
  });
}

async function confirm(rl, message) {
  if (AUTO_YES) return true;
  const answer = (await rl.question(`${message} [y/N]: `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes' || answer === 's' || answer === 'si' || answer === 'sí';
}

async function upsertSingleActive(entity, label, data) {
  const active = await entity.filter({ active: true });

  if (active.length > 1) {
    throw new Error(
      `${label}: hay ${active.length} registros activos. Dejá uno solo activo antes de ejecutar el seed.`
    );
  }

  if (active.length === 1) {
    if (DRY_RUN) {
      console.log(`[DRY RUN] ${label}: actualizaría ${active[0].id}`);
      return active[0];
    }
    const updated = await entity.update(active[0].id, data);
    console.log(`✓ ${label}: actualizado ${updated.id}`);
    return updated;
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] ${label}: crearía un nuevo registro activo`);
    return null;
  }

  const created = await entity.create(data);
  console.log(`✓ ${label}: creado ${created.id}`);
  return created;
}

async function upsertDocumentRequirement(entity, data) {
  const rows = await entity.filter({ code: data.code });

  if (rows.length > 1) {
    throw new Error(
      `DocumentRequirement '${data.code}': hay ${rows.length} registros duplicados. Corregilos antes de ejecutar el seed.`
    );
  }

  if (rows.length === 1) {
    if (DRY_RUN) {
      console.log(`[DRY RUN] DocumentRequirement ${data.code}: actualizaría ${rows[0].id}`);
      return;
    }
    const updated = await entity.update(rows[0].id, data);
    console.log(`✓ DocumentRequirement ${data.code}: actualizado ${updated.id}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] DocumentRequirement ${data.code}: crearía registro`);
    return;
  }

  const created = await entity.create(data);
  console.log(`✓ DocumentRequirement ${data.code}: creado ${created.id}`);
}

async function main() {
  const appId = process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID || readLinkedAppId();

  if (!appId) {
    throw new Error(
      'No encontré el App ID. Ejecutá `npx base44 link` o definí BASE44_APP_ID.'
    );
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('=== BearDrive - Seed de datos de prueba Base44 ===');
    console.log(`App ID: ${appId}`);
    console.log(DRY_RUN ? 'Modo: DRY RUN (no escribe datos)' : 'Modo: ESCRITURA');
    console.log('');

    const email = process.env.BASE44_ADMIN_EMAIL || (await rl.question('Email del administrador Base44: ')).trim();
    if (!email) throw new Error('Falta el email del administrador.');

    rl.pause();
    const password = process.env.BASE44_ADMIN_PASSWORD || await promptHidden('Contraseña del administrador Base44: ');
    rl.resume();

    if (!password) throw new Error('Falta la contraseña del administrador.');

    const client = createClient({
      appId,
      serverUrl: process.env.BASE44_SERVER_URL || 'https://base44.app',
    });

    try {
      await client.auth.loginViaEmailPassword(email, password);
      const me = await client.auth.me();

      if (!me) throw new Error('Base44 no devolvió un usuario autenticado.');
      if (me.role !== 'admin') {
        throw new Error(`El usuario autenticado no es admin (role=${me.role ?? 'sin role'}).`);
      }

      console.log(`Autenticado como: ${me.email || email} (admin)`);
      console.log('');
      console.log('Se aplicarán estos datos:');
      console.log(`- PricingConfig activo: ${PRICING.name}`);
      console.log(`- DailyChargeConfig activo: $${DAILY_CHARGE.amount} ${DAILY_CHARGE.currency}`);
      console.log(`- DocumentRequirement: ${DOCUMENT_REQUIREMENTS.map(x => x.code).join(', ')}`);
      console.log('');

      if (!DRY_RUN) {
        const ok = await confirm(rl, '¿Continuar con la escritura en Base44?');
        if (!ok) {
          console.log('Cancelado. No se modificaron datos.');
          return;
        }
      }

      await upsertSingleActive(client.entities.PricingConfig, 'PricingConfig', PRICING);
      await upsertSingleActive(client.entities.DailyChargeConfig, 'DailyChargeConfig', DAILY_CHARGE);

      for (const requirement of DOCUMENT_REQUIREMENTS) {
        await upsertDocumentRequirement(client.entities.DocumentRequirement, requirement);
      }

      console.log('');
      console.log(DRY_RUN ? '✓ Dry run completado.' : '✓ Seed completado correctamente.');
    } finally {
      try {
        client.cleanup?.();
      } catch {}
    }
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error('');
  console.error('ERROR:', error?.message || error);
  process.exitCode = 1;
});
