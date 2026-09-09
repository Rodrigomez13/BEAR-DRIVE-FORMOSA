import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const body = await req.json();
    const { code } = body;
    const adminCode = secrets.get("BEAR_ADMIN_CODE");
    if (!adminCode) {
      return Response.json({ valid: false }, { status: 403 });
    }
    // Constant-time-ish comparison
    const a = String(code || "");
    const b = String(adminCode);
    if (a.length !== b.length) return Response.json({ valid: false }, { status: 403 });
    let match = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) match = false;
    }
    if (!match) return Response.json({ valid: false }, { status: 403 });
    return Response.json({ valid: true });
  } catch (error) {
    return Response.json({ valid: false }, { status: 500 });
  }
}