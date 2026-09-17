// Run once with: Get-Content scripts/provision-user-locks.js -Raw | npx base44 exec --privileged
// Store the returned manifest as USER_OPERATION_LOCK_IDS, unchanged thereafter.
// Existing rows are reused; ambiguous slots and held locks fail closed.
const locks = await base44.entities.UserOperationLock.list('slot', 100);
if (locks.length > 32 || new Set(locks.map(row => row.slot)).size !== locks.length || locks.some(row => row.operation_lock || !Number.isInteger(row.slot) || row.slot < 0 || row.slot >= 32)) {
  throw new Error('Lock records require manual reconciliation; nothing was changed');
}
for (let slot = 0; slot < 32; slot++) {
  if (!locks.some(row => row.slot === slot)) locks.push(await base44.entities.UserOperationLock.create({ slot, operation_lock: null }));
}
console.log('USER_OPERATION_LOCK_IDS=' + JSON.stringify(locks.sort((a,b) => a.slot - b.slot).map(row => row.id)));
