import type { AdminProductDto } from "@thread/types";
import { apiRequest } from "@/auth/auth-client";

interface UploadSignature {
  readonly apiKey: string;
  readonly signature: string;
  readonly uploadUrl: string;
  readonly signedParameters: Readonly<Record<string, string | number>>;
  readonly constraints: {
    readonly allowedFormats: readonly string[];
    readonly maxBytes: number;
    readonly minWidth: number;
    readonly minHeight: number;
  };
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

interface CloudinaryError {
  readonly error?: { readonly message?: string };
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

export function requestImageUpload(accessToken: string): Promise<UploadSignature> {
  return apiRequest<UploadSignature>("/admin/media/upload-signature", accessToken, {
    method: "POST",
  });
}

function uploadError(body: CloudinaryError | null, status: number): Error {
  const detail = body?.error?.message?.trim();
  return new Error(
    detail
      ? `Cloudinary rejected the image upload: ${detail}`
      : `Cloudinary rejected the image upload (HTTP ${status}). Check the configured credentials and image requirements.`,
  );
}

export async function attachImage(
  productId: string,
  file: File,
  alt: string,
  accessToken: string,
  primary = false,
  suppliedSignature?: UploadSignature,
): Promise<AdminProductDto> {
  const signature = suppliedSignature ?? (await requestImageUpload(accessToken));
  const body = new FormData();
  body.set("file", file);
  body.set("api_key", signature.apiKey);
  body.set("signature", signature.signature);
  for (const [key, value] of Object.entries(signature.signedParameters))
    body.set(key, String(value));
  let response: Response;
  try {
    response = await fetch(signature.uploadUrl, { method: "POST", body });
  } catch {
    throw new Error(
      "Image upload could not reach Cloudinary. Check your connection and Cloudinary configuration, then try again.",
    );
  }
  if (!response.ok) {
    let failure: CloudinaryError | null = null;
    try {
      failure = (await response.json()) as CloudinaryError;
    } catch {
      // Cloudinary can return an empty or non-JSON response for an upstream failure.
    }
    throw uploadError(failure, response.status);
  }
  const uploaded = (await response.json()) as Partial<CloudinaryUpload>;
  const validFormat =
    typeof uploaded.format === "string" &&
    signature.constraints.allowedFormats.includes(uploaded.format);
  let secureUrl: URL | null = null;
  try {
    secureUrl = new URL(uploaded.secure_url ?? "");
  } catch {
    // The validation below reports one consistent admin-facing error.
  }
  if (
    uploaded.resource_type !== "image" ||
    !uploaded.public_id ||
    !secureUrl ||
    secureUrl.protocol !== "https:" ||
    secureUrl.hostname !== "res.cloudinary.com" ||
    !Number.isInteger(uploaded.width) ||
    !Number.isInteger(uploaded.height) ||
    !Number.isInteger(uploaded.bytes) ||
    uploaded.width! < signature.constraints.minWidth ||
    uploaded.height! < signature.constraints.minHeight ||
    uploaded.bytes! < 1 ||
    uploaded.bytes! > signature.constraints.maxBytes ||
    !validFormat
  )
    throw new Error(
      "Cloudinary returned incomplete or invalid image metadata. The image was not attached.",
    );
  const mimeType = (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      avif: "image/avif",
    } as const
  )[uploaded.format];
  return apiRequest<AdminProductDto>(`/admin/products/${productId}/media`, accessToken, {
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
