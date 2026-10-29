import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { createClient } from '@base44/sdk';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const AUTO_YES = args.has('--yes');
const MP_FILE = process.env.MP_TEST_USERS_FILE || '.private/mercadopago-test-users.json';
const CONFIRMATION = 'PROVISION_BEARDRIVE_TEST';

function readLinkedAppId() {
  const file = path.resolve('base44/.app.jsonc');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  return text.match(/"id"\s*:\s*"([^"]+)"/)?.[1] || null;
}

function readMpUsers() {
  const file = path.resolve(MP_FILE);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    driverId: parsed?.driver?.id ? String(parsed.driver.id) : null,
    passengerId: parsed?.passenger?.id ? String(parsed.passenger.id) : null,
    path: file,
  };
}

async function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try { return await rl.question(question); } finally { rl.close(); }
  }

  return await new Promise((resolve, reject) => {
    let value = '';
    const stdin = process.stdin;
    const stdout = process.stdout;
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
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

async function confirm(rl, message) {
  if (AUTO_YES) return true;
  const answer = (await rl.question(`${message} [y/N]: `)).trim().toLowerCase();
  return ['y', 'yes', 's', 'si', 'sí'].includes(answer);
}

function duplicateInvite(error) {
  const text = `${error?.message || ''} ${error?.response?.data?.error || ''}`.toLowerCase();
  return ['already', 'exists', 'existente', 'invited', 'invitado', 'registered', 'registrado'].some(word => text.includes(word));
}

async function invite(client, email) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Invitaría ${email} con role=user`);
    return;
  }
  try {
    await client.auth.inviteUser(email, 'user');
    console.log(`✓ Invitación enviada: ${email}`);
  } catch (error) {
    if (!duplicateInvite(error)) throw error;
    console.log(`• ${email}: ya existe o ya fue invitado; continúo.`);
  }
}

async function main() {
  const appId = process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID || readLinkedAppId();
  if (!appId) throw new Error('No encontré el App ID. Ejecutá `npx base44 link` o definí BASE44_APP_ID.');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('=== BearDrive - Entorno E2E de prueba ===');
    console.log(`App ID: ${appId}`);
    console.log(DRY_RUN ? 'Modo: DRY RUN' : 'Modo: ESCRITURA CONTROLADA');
    console.log('');

    const adminEmail = process.env.BASE44_ADMIN_EMAIL || (await rl.question('Email del administrador Base44: ')).trim();
    if (!adminEmail) throw new Error('Falta BASE44_ADMIN_EMAIL.');

    rl.pause();
    const adminPassword = process.env.BASE44_ADMIN_PASSWORD || await promptHidden('Contraseña del administrador Base44: ');
    rl.resume();
    if (!adminPassword) throw new Error('Falta la contraseña del administrador.');

    const passengerEmail = (process.env.BASE44_TEST_PASSENGER_EMAIL || await rl.question('Email real para Passenger Test: ')).trim().toLowerCase();
    const driverEmail = (process.env.BASE44_TEST_DRIVER_EMAIL || await rl.question('Email real para Driver Test: ')).trim().toLowerCase();
    if (!passengerEmail || !driverEmail) throw new Error('Faltan emails de prueba.');
    if (passengerEmail === driverEmail) throw new Error('Passenger Test y Driver Test deben usar emails distintos.');

    const mp = readMpUsers();
    console.log('');
    console.log(mp
      ? `Mercado Pago TEST detectado en ${mp.path}`
      : `No encontré ${MP_FILE}. Se provisionará Base44 sin fijar IDs de Mercado Pago.`);
    console.log(`Passenger Base44: ${passengerEmail}${mp?.passengerId ? ` ↔ MP ${mp.passengerId}` : ''}`);
    console.log(`Driver Base44:    ${driverEmail}${mp?.driverId ? ` ↔ MP ${mp.driverId}` : ''}`);
    console.log('');

    if (!DRY_RUN && !(await confirm(rl, '¿Invitar/provisionar estas dos identidades de prueba?'))) {
      console.log('Cancelado. No se modificaron datos.');
      return;
    }

    const client = createClient({
      appId,
      serverUrl: process.env.BASE44_SERVER_URL || 'https://base44.app',
    });

    try {
      await client.auth.loginViaEmailPassword(adminEmail, adminPassword);
      const me = await client.auth.me();
      if (!me || me.role !== 'admin') throw new Error('La cuenta autenticada no tiene role=admin.');
      console.log(`✓ Admin autenticado: ${me.email}`);

      await invite(client, passengerEmail);
      await invite(client, driverEmail);

      if (DRY_RUN) {
        console.log('[DRY RUN] Invocaría provisionTestEnvironment después de que existan ambas identidades.');
        return;
      }

      try {
        const response = await client.functions.invoke('provisionTestEnvironment', {
          confirm: CONFIRMATION,
          passenger_email: passengerEmail,
          driver_email: driverEmail,
          passenger_mp_user_id: mp?.passengerId || undefined,
          driver_mp_user_id: mp?.driverId || undefined,
        });
        console.log('');
        console.log('✓ Entorno Base44 provisionado.');
        console.log(JSON.stringify(response.data, null, 2));
      } catch (error) {
        const detail = error?.response?.data || {};
        if (Array.isArray(detail.missing_users) && detail.missing_users.length) {
          console.log('');
          console.log('Las invitaciones fueron enviadas, pero todavía falta que esas cuentas existan/acepten la invitación:');
          for (const email of detail.missing_users) console.log(`  - ${email}`);
          console.log('Después de aceptarlas, ejecutá nuevamente este mismo comando. Es idempotente.');
          return;
        }
        throw error;
      }

      try {
        const readiness = await client.functions.invoke('getPaymentReadiness', {});
        console.log('');
        console.log('=== Payment readiness ===');
        for (const check of readiness.data?.checks || []) {
          console.log(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`);
        }
      } catch (error) {
        console.log(`Aviso: no pude ejecutar getPaymentReadiness: ${error?.response?.data?.error || error.message}`);
      }
    } finally {
      try { client.cleanup?.(); } catch {}
    }
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error('');
  console.error('ERROR:', error?.response?.data?.error || error?.message || error);
  process.exitCode = 1;
});
