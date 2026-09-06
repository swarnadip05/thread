import { apiRequest } from "@/auth/auth-client";

interface UploadSignature {
  readonly apiKey: string;
  readonly signature: string;
  readonly uploadUrl: string;
  readonly signedParameters: Readonly<Record<string, string | number>>;
}

interface CloudinaryUpload {
  readonly public_id: string;
  readonly secure_url: string;
  readonly width: number;
  readonly height: number;
  readonly format: "jpg" | "jpeg" | "png" | "webp" | "avif";
  readonly bytes: number;
  readonly resource_type: string;
}

export function slugify(value: string): string {
  return value
    .toLocaleLowerCase("en-IN")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
}

export function rupeesToPaise(value: FormDataEntryValue | null): number {
  const normalized = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    throw new Error("Enter prices in rupees with no more than two decimal places.");
  const [rupees = "0", decimal = ""] = normalized.split(".");
  return Number(rupees) * 100 + Number(decimal.padEnd(2, "0"));
}

export function descriptionHtml(value: string): string {
  const escaped = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export async function attachImage(
  productId: string,
  file: File,
  alt: string,
  accessToken: string,
  primary = false,
): Promise<void> {
  const signature = await apiRequest<UploadSignature>(
    "/admin/media/upload-signature",
    accessToken,
    { method: "POST" },
  );
  const body = new FormData();
  body.set("file", file);
  body.set("api_key", signature.apiKey);
  body.set("signature", signature.signature);
  for (const [key, value] of Object.entries(signature.signedParameters))
    body.set(key, String(value));
  const response = await fetch(signature.uploadUrl, { method: "POST", body });
  if (!response.ok) throw new Error("The product was created, but its image upload failed.");
  const uploaded = (await response.json()) as CloudinaryUpload;
  if (uploaded.resource_type !== "image")
    throw new Error("The product was created, but the uploaded file was not an image.");
  const mimeType = (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      avif: "image/avif",
    } as const
  )[uploaded.format];
  await apiRequest(`/admin/products/${productId}/media`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      publicId: uploaded.public_id,
      secureUrl: uploaded.secure_url,
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format,
      mimeType,
      bytes: uploaded.bytes,
      alt,
      primary,
    }),
  });
}
