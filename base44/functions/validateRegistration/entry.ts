import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// In-memory rate limiter per authenticated user to prevent DNI enumeration.
// Uses user.id as key so rotating HTTP headers (like X-Forwarded-For) cannot bypass it.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isBlocked(userId: string): boolean {
  const entry = attempts.get(userId);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(userId);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(userId: string) {
  const now = Date.now();
  const entry = attempts.get(userId);
  if (!entry || now > entry.resetAt) {
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count++;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isBlocked(user.id)) {
      return Response.json({ available: false, message: "Demasiadas consultas. Intentá nuevamente en unos minutos." }, { status: 429 });
    }

    const body = await req.json();
    const { dni } = body;

    if (!dni) return Response.json({ available: false, message: "DNI requerido" }, { status: 400 });

    const cleanDni = String(dni).trim();
    if (!/^\d{7,8}$/.test(cleanDni)) {
      return Response.json({ available: false, message: "El DNI debe tener 7 u 8 dígitos" }, { status: 400 });
    }

    recordAttempt(user.id);

    const existing = await base44.asServiceRole.entities.User.filter({ dni: cleanDni }, undefined, 1);
    if (existing.length > 0 && existing[0].id !== user.id) {
      return Response.json({ available: false, message: "Ya existe una cuenta con este DNI" });
    }

    return Response.json({ available: true });
  } catch (error: any) {
    return Response.json({ available: false, message: error.message }, { status: 500 });
  }
}