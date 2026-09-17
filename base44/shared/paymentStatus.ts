// Explicit allowlist: OAuth credentials must never reach the browser, including admins.
export function publicPaymentAccount(account) {
  if (!account) return null;
  const linked = Boolean(account.access_token && account.seller_id);
  const renewable = Boolean(account.refresh_token);
  const expired = !(Date.parse(account.expires_at) > Date.now());
  return {
    id: account.id,
    driver_id: account.driver_id,
    seller_id: account.seller_id || null,
    expires_at: account.expires_at || null,
    status: linked ? (expired && !renewable ? 'reconnect' : 'connected') : 'pending',
    needs_review: Boolean(account.operation_lock),
  };
}
