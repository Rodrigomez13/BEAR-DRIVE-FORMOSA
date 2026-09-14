import { secrets } from 'base44:runtime';
import { fail, withLock } from './domain.ts';

// Provisioned once, outside requests. A fixed manifest avoids racing to create a
// per-user row on platforms without a documented unique-field/upsert primitive.
// Never rotate this manifest while requests are running or locks are held.
export async function withUserLock(client, userId, fn) {
  let ids;
  try { ids = JSON.parse(secrets.get('USER_OPERATION_LOCK_IDS') || 'null'); }
  catch { fail('La coordinación de operaciones requiere configuración', 503); }
  if (!Array.isArray(ids) || ids.length !== 32 || ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== 32) {
    fail('La coordinación de operaciones requiere configuración', 503);
  }
  if (typeof userId !== 'string' || !userId) fail('Usuario inválido', 400);
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) hash = Math.imul(hash ^ userId.charCodeAt(i), 16777619) >>> 0;
  return withLock(client.asServiceRole.entities.UserOperationLock, ids[hash % ids.length], fn);
}
