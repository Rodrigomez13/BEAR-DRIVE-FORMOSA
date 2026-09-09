import { secrets } from "base44:runtime";

export default async function(req) {
  try {
    const key = secrets.get("GOOGLE_MAPS_API_KEY");
    if (!key) return Response.json({ error: "Google Maps API key not configured" }, { status: 500 });
    return Response.json({ apiKey: key });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}