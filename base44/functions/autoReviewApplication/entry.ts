import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { addBusinessDays } from '../../shared/businessDays.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { application_id } = body;
    if (!application_id) return Response.json({ error: "application_id es obligatorio" }, { status: 400 });

    const application = await base44.asServiceRole.entities.DriverApplication.get(application_id);
    if (!application) return Response.json({ error: "Solicitud no encontrada" }, { status: 404 });

    // Only the owner or an admin can trigger auto-review
    if (application.user_id !== user.id && user.role !== "admin") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const docs = await base44.asServiceRole.entities.DriverDocument.filter({ application_id });

    // Auto-preview check: analyze each document with LLM vision
    const issues = [];
    for (const doc of docs) {
      if (!doc.file_url) {
        issues.push(doc.label + ": documento no cargado");
        continue;
      }
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: 'Sos un verificador automático de documentos para una app de transporte. Analizá este documento de tipo "' + doc.label + '". Verificá: 1) Si es legible, 2) Si parece ser un documento válido (no manipulado), 3) Si los datos son visibles. Respondé en JSON.',
          file_urls: [doc.file_url],
          response_json_schema: {
            type: "object",
            properties: {
              valid: { type: "boolean" },
              issue: { type: "string" }
            },
            required: ["valid"]
          }
        });
        if (!result.valid) {
          issues.push(doc.label + ": " + (result.issue || "documento no válido"));
        }
      } catch (e) {
        // If LLM check fails, don't block — flag for manual review
        issues.push(doc.label + ": no se pudo verificar automáticamente");
      }
    }

    const now = new Date();

    if (issues.length === 0) {
      // All docs pass auto-check → move to UNDER_REVIEW with 3 business day deadline
      const deadline = addBusinessDays(3, now);
      await base44.asServiceRole.entities.DriverApplication.update(application_id, {
        status: "UNDER_REVIEW",
        review_deadline: deadline.toISOString(),
        auto_review_notes: "Verificación automática completada. Documentos legibles y válidos."
      });
      return Response.json({ ok: true, status: "UNDER_REVIEW", deadline: deadline.toISOString() });
    } else {
      // Issues found → request more info
      const notes = issues.join("; ");
      await base44.asServiceRole.entities.DriverApplication.update(application_id, {
        status: "MORE_INFO_REQUIRED",
        auto_review_notes: notes,
        more_info_reason: notes
      });
      await base44.asServiceRole.entities.User.update(application.user_id, {
        driver_status: "MORE_INFO_REQUIRED",
        driver_capability: "ONBOARDING"
      });
      return Response.json({ ok: true, status: "MORE_INFO_REQUIRED", issues });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}