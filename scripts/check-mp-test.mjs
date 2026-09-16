import fs from 'node:fs';

// Never log credentials or the raw provider response.
const path = '.private/mercadopago-test.env';
async function main() {
  if (!fs.existsSync(path)) throw new Error(`Falta ${path}`);
  const env = Object.fromEntries(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(line => line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/)).filter(Boolean)
    .map(match => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
  const token = env.MP_DAILY_CHARGE_ACCESS_TOKEN;
  if (!token) throw new Error('Falta MP_DAILY_CHARGE_ACCESS_TOKEN');
  const response = await fetch('https://api.mercadopago.com/users/me', {
    headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Credencial no verificable (HTTP ${response.status})`);
  const seller = await response.json();
  if (!seller.tags?.includes('test_user')) throw new Error('El token pertenece a una cuenta REAL. No se preparó ninguna configuración de prueba.');
  if (seller.site_id !== 'MLA') throw new Error('El vendedor de prueba debe ser de Argentina.');
  if (process.argv.includes('--prepare')) {
    fs.writeFileSync('.private/mercadopago-test-verified.env',
      `MP_DAILY_CHARGE_ACCESS_TOKEN=${token}\nMP_DAILY_CHARGE_COLLECTOR_ID=${seller.id}\nMP_PAYMENT_MODE=test\n`, {mode: 0o600});
    console.log('Configuración validada en .private/mercadopago-test-verified.env. No se modificó el backend.');
  }
  console.log('OK: vendedor de prueba argentino. Usar un comprador de prueba distinto y un checkout nuevo.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
