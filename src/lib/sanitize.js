// Input sanitization utilities — parse and clean user input before writing to tables.

export function sanitizeString(val, maxLength = 500) {
  if (val == null) return null;
  let s = String(val).trim();
  s = s.replace(/[\x00-\x1F\x7F]/g, ""); // remove control characters
  s = s.replace(/\s{2,}/g, " "); // collapse whitespace
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s || null;
}

export function sanitizePhone(val) {
  if (val == null) return null;
  let s = String(val).trim().replace(/[^\d+]/g, "");
  if (s.length > 20) s = s.slice(0, 20);
  return s || null;
}

export function sanitizeDNI(val) {
  if (val == null) return null;
  let s = String(val).trim().replace(/[^\d.]/g, "");
  if (s.length > 12) s = s.slice(0, 12);
  return s || null;
}

export function sanitizePlate(val) {
  if (val == null) return null;
  let s = String(val).trim().toUpperCase().replace(/\s{2,}/g, " ");
  s = s.replace(/[^A-Z0-9\s-]/g, "");
  if (s.length > 15) s = s.slice(0, 15);
  return s || null;
}

export function sanitizeEmail(val) {
  if (val == null) return null;
  let s = String(val).trim().toLowerCase();
  if (s.length > 254) s = s.slice(0, 254);
  return s || null;
}

export function sanitizeInt(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  return n;
}

export function sanitizeFloat(val) {
  const n = Number(val);
  if (isNaN(n)) return null;
  return n;
}