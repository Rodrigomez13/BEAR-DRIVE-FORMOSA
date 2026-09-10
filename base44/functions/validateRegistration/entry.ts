import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { dni } = body;

    if (!dni) return Response.json({ available: false, message: "DNI requerido" }, { status: 400 });

    const cleanDni = String(dni).trim();
    if (!/^\d{7,8}$/.test(cleanDni)) {
      return Response.json({ available: false, message: "El DNI debe tener 7 u 8 dígitos" }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.User.filter({ dni: cleanDni }, undefined, 1);
    if (existing.length > 0) {
      return Response.json({ available: false, message: "Ya existe una cuenta con este DNI" });
    }

    return Response.json({ available: true });
  } catch (error) {
    return Response.json({ available: false, message: error.message }, { status: 500 });
  }
}