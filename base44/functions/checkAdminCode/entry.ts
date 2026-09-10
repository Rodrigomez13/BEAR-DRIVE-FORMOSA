import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from "base44:runtime";

// In-memory rate limiter to prevent admin code brute-forcing.
// Best-effort: persists across warm invocations only.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
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

function recordFailedAttempt(ip: string) {
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
    const ip = getClientIp(req);
    if (isBlocked(ip)) {
      return Response.json({ valid: false, error: "Demasiados intentos. Intentá nuevamente en unos minutos." }, { status: 429 });
    }

    const body = await req.json();
    const { code } = body;
    const adminCode = secrets.get("BEAR_ADMIN_CODE");
    if (!adminCode) {
      return Response.json({ valid: false }, { status: 403 });
    }
    // Constant-time-ish comparison
    const a = String(code || "");
    const b = String(adminCode);
    if (a.length !== b.length) {
      recordFailedAttempt(ip);
      return Response.json({ valid: false }, { status: 403 });
    }
    let match = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) match = false;
    }
    if (!match) {
      recordFailedAttempt(ip);
      return Response.json({ valid: false }, { status: 403 });
    }
    return Response.json({ valid: true });
  } catch (error) {
    return Response.json({ valid: false }, { status: 500 });
  }
}