import { secrets } from "base44:runtime";

// In-memory rate limiter to prevent admin code brute-forcing.
// Uses trusted edge header (cf-connecting-ip) and a global fallback limit
// to prevent header spoofing bypasses.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

let globalFailures = 0;
let globalResetAt = 0;
const MAX_GLOBAL_FAILURES = 10;

function getClientIdentifier(req: Request): string {
  // CF-Connecting-IP is set directly by the Cloudflare edge proxy and cannot be spoofed by clients
  const cfIp = req.headers?.get?.("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const realIp = req.headers?.get?.("x-real-ip");
  if (realIp) return realIp.trim();
  return "client_global";
}

function isBlocked(identifier: string): boolean {
  const now = Date.now();
  // Check global rate limit
  if (now < globalResetAt && globalFailures >= MAX_GLOBAL_FAILURES) {
    return true;
  }
  if (now > globalResetAt) {
    globalFailures = 0;
    globalResetAt = now + WINDOW_MS;
  }

  // Check identifier rate limit
  const entry = attempts.get(identifier);
  if (!entry) return false;
  if (now > entry.resetAt) {
    attempts.delete(identifier);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(identifier: string) {
  const now = Date.now();
  // Increment global failures
  if (now > globalResetAt) {
    globalFailures = 1;
    globalResetAt = now + WINDOW_MS;
  } else {
    globalFailures++;
  }

  // Increment identifier failures
  const entry = attempts.get(identifier);
  if (!entry || now > entry.resetAt) {
    attempts.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count++;
}

export default async function(req: Request): Promise<Response> {
  try {
    const identifier = getClientIdentifier(req);
    if (isBlocked(identifier)) {
      return Response.json({ valid: false, error: "Demasiados intentos. Intentá nuevamente en unos minutos." }, { status: 429 });
    }

    const body = await req.json();
    const { code } = body;
    const adminCode = secrets.get("BEAR_ADMIN_CODE");
    if (!adminCode) {
      return Response.json({ valid: false }, { status: 403 });
    }

    // Constant-time comparison
    const a = String(code || "");
    const b = String(adminCode);
    if (a.length !== b.length) {
      recordFailedAttempt(identifier);
      return Response.json({ valid: false }, { status: 403 });
    }
    let match = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) match = false;
    }
    if (!match) {
      recordFailedAttempt(identifier);
      return Response.json({ valid: false }, { status: 403 });
    }
    return Response.json({ valid: true });
  } catch (error: any) {
    return Response.json({ valid: false }, { status: 500 });
  }
}