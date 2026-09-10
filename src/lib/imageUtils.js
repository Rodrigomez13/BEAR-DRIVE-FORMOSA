// Image validation and WebP conversion utilities for BearDrive

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, "application/pdf"];

export function validateFile(file) {
  if (!file) return { valid: false, error: "No se seleccionó ningún archivo" };
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, error: "Formato no soportado. Usá imagen (JPG, PNG, WebP) o PDF." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "El archivo es demasiado grande (máx 10MB)." };
  }
  return { valid: true };
}

// Converts images to WebP for smaller payload and faster loads.
// PDFs and already-WebP files pass through unchanged.
export async function optimizeForWeb(file) {
  if (file.type === "application/pdf" || file.type === "image/webp") {
    return file;
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return file;
  }
  try {
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    URL.revokeObjectURL(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
    if (!blob) return file;
    const name = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch (e) {
    return file;
  }
}