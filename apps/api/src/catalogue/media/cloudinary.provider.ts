import { createHash } from "node:crypto";
import { HttpError } from "../../middleware/error-handler.js";

export interface SignedUpload {
  readonly apiKey: string;
  readonly cloudName: string;
  readonly folder: string;
  readonly signature: string;
  readonly timestamp: number;
  readonly signedParameters: {
    readonly allowed_formats: string;
    readonly folder: string;
    readonly timestamp: number;
  };
  readonly constraints: {
    readonly allowedFormats: readonly string[];
    readonly maxBytes: number;
    readonly minWidth: number;
    readonly minHeight: number;
    readonly svgAllowed: false;
  };
  readonly uploadUrl: string;
}
export interface UploadedMediaMetadata {
  readonly format: string;
  readonly mimeType: string;
  readonly publicId: string;
  readonly secureUrl: string;
}
export interface MediaProvider {
  createSignedUpload(scope?: "product" | "homepage"): SignedUpload;
  delete(publicId: string): Promise<void>;
  verifyConfiguration?(): Promise<void>;
  validateMetadata(metadata: UploadedMediaMetadata, scope?: "product" | "homepage"): boolean;
}

export class CloudinaryMediaProvider implements MediaProvider {
  private verifiedAt = 0;

  constructor(
    private readonly config: {
      apiKey: string;
      apiSecret: string;
      cloudName: string;
      folder: string;
    },
  ) {}

  async verifyConfiguration(): Promise<void> {
    if (Date.now() - this.verifiedAt < 5 * 60_000) return;
    let response: Response;
    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${this.config.cloudName}/ping`, {
        headers: {
          authorization: `Basic ${Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString("base64")}`,
        },
      });
    } catch {
      throw new HttpError(
        503,
        "MEDIA_PROVIDER_UNAVAILABLE",
        "Cloudinary could not be reached. Check the API network connection and try again.",
      );
    }
    if (!response.ok)
      throw new HttpError(
        503,
        "MEDIA_CONFIGURATION_INVALID",
        "Cloudinary rejected the configured cloud name or API credentials.",
      );
    this.verifiedAt = Date.now();
  }

  private sign(parameters: Record<string, string | number>): string {
    const payload = Object.entries(parameters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    return createHash("sha1").update(`${payload}${this.config.apiSecret}`).digest("hex");
  }
  createSignedUpload(scope: "product" | "homepage" = "product"): SignedUpload {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder =
      scope === "homepage"
        ? `${this.config.folder.replace(/\/products$/, "")}/homepage`
        : this.config.folder;
    const parameters = {
      allowed_formats: "jpg,jpeg,png,webp,avif",
      folder,
      timestamp,
    };
    return {
      apiKey: this.config.apiKey,
      cloudName: this.config.cloudName,
      folder,
      signature: this.sign(parameters),
      timestamp,
      signedParameters: parameters,
      constraints: {
        allowedFormats: ["jpg", "jpeg", "png", "webp", "avif"],
        maxBytes: 15_000_000,
        minWidth: 300,
        minHeight: 300,
        svgAllowed: false,
      },
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`,
    };
  }
  validateMetadata(
    metadata: UploadedMediaMetadata,
    scope: "product" | "homepage" = "product",
  ): boolean {
    try {
      const url = new URL(metadata.secureUrl);
      const folder =
        scope === "homepage"
          ? `${this.config.folder.replace(/\/products$/, "")}/homepage`
          : this.config.folder;
      return (
        url.protocol === "https:" &&
        url.hostname === "res.cloudinary.com" &&
        url.pathname.startsWith(`/${this.config.cloudName}/image/upload/`) &&
        metadata.publicId.startsWith(`${folder}/`) &&
        ["jpg", "jpeg", "png", "webp", "avif"].includes(metadata.format.toLowerCase()) &&
        metadata.mimeType ===
          (
            {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              webp: "image/webp",
              avif: "image/avif",
            } as Record<string, string>
          )[metadata.format.toLowerCase()]
      );
    } catch {
      return false;
    }
  }
  /**
   * Uploads an image buffer directly to Cloudinary from the server side.
   * Used during bulk ZIP import to persist product photos to cloud storage.
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    folder?: string,
  ): Promise<{
    publicId: string;
    secureUrl: string;
    format: string;
    mimeType: string;
    bytes: number;
    width: number;
    height: number;
  }> {
    const targetFolder = folder ?? this.config.folder;
    const timestamp = Math.floor(Date.now() / 1000);
    // public_id already contains the folder path — do NOT pass folder separately
    // or Cloudinary will double-count it in the signature and reject the request.
    const publicId = `${targetFolder}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]+$/, "")}`;
    const parameters = { public_id: publicId, timestamp };
    const signature = this.sign(parameters);

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)]), filename);
    form.append("api_key", this.config.apiKey);
    form.append("timestamp", String(timestamp));
    form.append("public_id", publicId);
    form.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`,
      { method: "POST", body: form },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(`Cloudinary upload failed (${response.status}): ${text}`);
    }

    const result = (await response.json()) as {
      public_id: string;
      secure_url: string;
      format: string;
      bytes: number;
      width: number;
      height: number;
    };

    const fmt = result.format?.toLowerCase() ?? "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      avif: "image/avif",
    };

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      format: fmt,
      mimeType: mimeMap[fmt] ?? "image/jpeg",
      bytes: result.bytes,
      width: result.width ?? 1000,
      height: result.height ?? 1000,
    };
  }
  async delete(publicId: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const parameters = { public_id: publicId, timestamp };
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/destroy`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          public_id: publicId,
          timestamp: String(timestamp),
          api_key: this.config.apiKey,
          signature: this.sign(parameters),
        }),
      },
    );
    if (!response.ok) throw new Error("Cloudinary asset deletion failed.");
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("result" in result) ||
      !["ok", "not found"].includes(String(result.result))
    )
      throw new Error("Cloudinary did not confirm asset deletion.");
  }
}

export class UnconfiguredMediaProvider implements MediaProvider {
  createSignedUpload(): SignedUpload {
    throw new HttpError(
      503,
      "MEDIA_NOT_CONFIGURED",
      "Image uploads require Cloudinary configuration on the API.",
    );
  }
  async delete(): Promise<void> {
    throw new HttpError(
      503,
      "MEDIA_NOT_CONFIGURED",
      "Image uploads require Cloudinary configuration on the API.",
    );
  }
  validateMetadata(): boolean {
    return false;
  }
}
