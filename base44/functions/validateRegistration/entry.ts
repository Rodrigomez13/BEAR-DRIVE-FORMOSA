import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// In-memory rate limiter to slow down DNI enumeration.
// Best-effort: persists across warm invocations only.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 15;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function getClientIp(req): string {
  const fwd = req.headers?.get?.("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

function isBlocked(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count++;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const ip = getClientIp(req);
    if (isBlocked(ip)) {
      return Response.json({ available: false, message: "Demasiadas consultas. Intentá nuevamente en unos minutos." }, { status: 429 });
    }

    const body = await req.json();
    const { dni } = body;

    if (!dni) return Response.json({ available: false, message: "DNI requerido" }, { status: 400 });

    const cleanDni = String(dni).trim();
    if (!/^\d{7,8}$/.test(cleanDni)) {
      return Response.json({ available: false, message: "El DNI debe tener 7 u 8 dígitos" }, { status: 400 });
    }

    recordAttempt(ip);

    const existing = await base44.asServiceRole.entities.User.filter({ dni: cleanDni }, undefined, 1);
    if (existing.length > 0) {
      return Response.json({ available: false, message: "Ya existe una cuenta con este DNI" });
    }

    return Response.json({ available: true });
  } catch (error) {
    return Response.json({ available: false, message: error.message }, { status: 500 });
  }
}