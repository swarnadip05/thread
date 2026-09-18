import JSZip from "jszip";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProductAudience, ProductStatus } from "@thread/types";
import { HttpError } from "../middleware/error-handler.js";

export interface ZipManifestVariant {
  sku: string;
  colour: string;
  size: string;
  mrpPaise: number;
  salePricePaise: number;
  availableStock?: number;
  weightGrams?: number;
  hsn?: string;
}

export interface ZipManifestImage {
  filename: string;
  alt?: string;
  primary?: boolean;
}

export interface ZipManifestProduct {
  title: string;
  slug?: string;
  shortDescription?: string;
  descriptionHtml?: string;
  audience: ProductAudience;
  categorySlug?: string;
  categoryName?: string;
  brand?: string;
  fit?: string;
  material?: string;
  care?: string[];
  tags?: string[];
  status?: ProductStatus;
  featured?: boolean;
  images?: ZipManifestImage[];
  variants: ZipManifestVariant[];
}

export interface ParsedZipProduct {
  title: string;
  slug: string;
  shortDescription: string;
  descriptionHtml: string;
  audience: ProductAudience;
  categorySlug: string;
  brand: string;
  fit?: string;
  material?: string | null;
  care: string[];
  tags: string[];
  status: ProductStatus;
  featured: boolean;
  images: Array<{
    publicId: string;
    secureUrl: string;
    width: number;
    height: number;
    format: "jpg" | "jpeg" | "png" | "webp" | "avif";
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
    bytes: number;
    alt: string;
    sortOrder: number;
    primary: boolean;
  }>;
  variants: Array<{
    sku: string;
    colour: string;
    size: string;
    attributes: Record<string, string>;
    mrpPaise: number;
    salePricePaise: number;
    taxRateBps: number | null;
    hsn: string | null;
    weightGrams: number;
    status: "active" | "inactive";
    initialStock: number;
  }>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function parseInventoryZip(zipBuffer: Buffer): Promise<{
  products: ParsedZipProduct[];
  summary: { totalProducts: number; totalVariants: number; categoriesFound: string[] };
}> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    throw new HttpError(
      400,
      "INVALID_ZIP_ARCHIVE",
      "The uploaded file is not a valid ZIP archive.",
    );
  }

  // Look for manifest file: manifest.json or products.json
  const manifestFile =
    zip.file("manifest.json") ??
    zip.file("products.json") ??
    Object.values(zip.files).find((file) => !file.dir && file.name.endsWith(".json"));

  let manifestProducts: ZipManifestProduct[] = [];

  if (manifestFile) {
    const content = await manifestFile.async("string");
    try {
      const parsed = JSON.parse(content);
      manifestProducts = Array.isArray(parsed) ? parsed : (parsed.products ?? []);
    } catch {
      throw new HttpError(
        400,
        "INVALID_MANIFEST_JSON",
        "Failed to parse JSON manifest inside the ZIP archive.",
      );
    }
  } else {
    throw new HttpError(
      400,
      "MISSING_MANIFEST",
      "ZIP archive must contain a manifest.json or products.json file.",
    );
  }

  if (!manifestProducts.length) {
    throw new HttpError(400, "EMPTY_MANIFEST", "Manifest file in ZIP contains no products.");
  }

  // Ensure public assets output directory exists
  const publicUploadsDir = path.resolve(
    process.cwd(),
    "../web/public/assets/approved/client-products/uploads",
  );
  try {
    await fs.mkdir(publicUploadsDir, { recursive: true });
  } catch {
    // Ignore directory creation errors if web directory is absent in standalone test
  }

  const parsedProducts: ParsedZipProduct[] = [];
  const categorySet = new Set<string>();
  let totalVariantsCount = 0;

  for (let index = 0; index < manifestProducts.length; index += 1) {
    const raw = manifestProducts[index]!;
    const title = raw.title?.trim() || `Product ${index + 1}`;
    const slug = raw.slug ? slugify(raw.slug) : slugify(title);
    const audience: ProductAudience = ["men", "women", "unisex", "accessories"].includes(
      raw.audience,
    )
      ? raw.audience
      : "men";

    const categorySlug = raw.categorySlug
      ? slugify(raw.categorySlug)
      : raw.categoryName
        ? slugify(raw.categoryName)
        : "t-shirts";
    categorySet.add(categorySlug);

    const brand = raw.brand?.trim() || "THREAD";
    const shortDescription =
      raw.shortDescription?.trim() || `${title} - Premium quality apparel by ${brand}.`;
    const descriptionHtml = raw.descriptionHtml?.trim() || `<p>${shortDescription}</p>`;
    const status: ProductStatus = ["draft", "active", "inactive", "archived"].includes(
      raw.status ?? "",
    )
      ? (raw.status as ProductStatus)
      : "active";

    // Process product images inside ZIP
    const processedImages: ParsedZipProduct["images"] = [];
    const imagesToProcess = raw.images ?? [];

    for (let imgIndex = 0; imgIndex < imagesToProcess.length; imgIndex += 1) {
      const imgRef = imagesToProcess[imgIndex]!;
      const cleanFilename = imgRef.filename.replace(/^[/\\]+/, "");
      const zipImage = zip.file(cleanFilename) ?? zip.file(`images/${cleanFilename}`);

      if (zipImage) {
        const imageBuffer = await zipImage.async("nodebuffer");
        const ext = path.extname(cleanFilename).toLowerCase().replace(".", "");
        const format = (
          ["jpg", "jpeg", "png", "webp", "avif"].includes(ext) ? ext : "jpg"
        ) as ParsedZipProduct["images"][0]["format"];
        const mimeType = (
          format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg"
        ) as ParsedZipProduct["images"][0]["mimeType"];

        const savedFileName = `${slug}-${imgIndex + 1}.${format}`;
        const relativePublicUrl = `/assets/approved/client-products/uploads/${savedFileName}`;

        try {
          await fs.writeFile(path.join(publicUploadsDir, savedFileName), imageBuffer);
        } catch {
          // Fallback if writing file is not permitted
        }

        processedImages.push({
          publicId: `upload/${slug}-${imgIndex + 1}`,
          secureUrl: relativePublicUrl,
          width: 800,
          height: 1000,
          format,
          mimeType,
          bytes: imageBuffer.length,
          alt: imgRef.alt || `${title} image ${imgIndex + 1}`,
          sortOrder: imgIndex,
          primary: imgRef.primary ?? imgIndex === 0,
        });
      }
    }

    // Default placeholder image if no image was provided in zip
    if (processedImages.length === 0) {
      processedImages.push({
        publicId: `upload/${slug}-default`,
        secureUrl: `/assets/approved/client-products/default-placeholder.jpg`,
        width: 800,
        height: 1000,
        format: "jpg",
        mimeType: "image/jpeg",
        bytes: 15000,
        alt: title,
        sortOrder: 0,
        primary: true,
      });
    }

    // Process variants
    const rawVariants = raw.variants?.length
      ? raw.variants
      : [
          {
            sku: `${slug.toUpperCase()}-S`,
            colour: "Default",
            size: "S",
            mrpPaise: 69900,
            salePricePaise: 54900,
            availableStock: 20,
          },
          {
            sku: `${slug.toUpperCase()}-M`,
            colour: "Default",
            size: "M",
            mrpPaise: 69900,
            salePricePaise: 54900,
            availableStock: 25,
          },
          {
            sku: `${slug.toUpperCase()}-L`,
            colour: "Default",
            size: "L",
            mrpPaise: 69900,
            salePricePaise: 54900,
            availableStock: 20,
          },
        ];

    const variants = rawVariants.map((v) => ({
      sku: v.sku.trim().toUpperCase(),
      colour: v.colour.trim(),
      size: v.size.trim().toUpperCase(),
      attributes: {},
      mrpPaise: Number(v.mrpPaise) || 69900,
      salePricePaise: Number(v.salePricePaise) || 54900,
      taxRateBps: null,
      hsn: v.hsn || "61091000",
      weightGrams: Number(v.weightGrams) || 200,
      status: "active" as const,
      initialStock: Number(v.availableStock ?? 20),
    }));

    totalVariantsCount += variants.length;

    parsedProducts.push({
      title,
      slug,
      shortDescription,
      descriptionHtml,
      audience,
      categorySlug,
      brand,
      fit: raw.fit || (categorySlug.includes("oversized") ? "Oversized" : "Regular"),
      material: raw.material || "100% Super Combed Cotton",
      care: raw.care || ["Wash inside out in cold water.", "Tumble dry low."],
      tags: raw.tags || ["new-arrival", categorySlug],
      status,
      featured: raw.featured ?? false,
      images: processedImages,
      variants,
    });
  }

  return {
    products: parsedProducts,
    summary: {
      totalProducts: parsedProducts.length,
      totalVariants: totalVariantsCount,
      categoriesFound: Array.from(categorySet),
    },
  };
}

const sampleJpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xd2, 0xcf, 0x20, 0xff, 0xd9,
]);

export async function create100InventoryZipBuffer(): Promise<Buffer> {
  const zip = new JSZip();
  const adjectives = [
    "Urban",
    "Vintage",
    "Cyber",
    "Minimal",
    "Essential",
    "Street",
    "Graphic",
    "Retro",
    "Monochrome",
    "Velvet",
  ];
  const themes = [
    "Dragon",
    "Nebula",
    "Pixel",
    "Nomad",
    "Horizon",
    "Phantom",
    "Solar",
    "Echo",
    "Aura",
    "Vortex",
  ];

  const targets = [
    {
      audience: "men" as const,
      categorySlug: "oversized-t-shirts",
      fit: "Oversized",
      price: 69900,
      mrp: 89900,
      qty: 25,
    },
    {
      audience: "men" as const,
      categorySlug: "t-shirts",
      fit: "Regular",
      price: 54900,
      mrp: 74900,
      qty: 20,
    },
    {
      audience: "men" as const,
      categorySlug: "classic-fit-t-shirts",
      fit: "Classic",
      price: 59900,
      mrp: 79900,
      qty: 15,
    },
    {
      audience: "women" as const,
      categorySlug: "oversized-t-shirts",
      fit: "Oversized",
      price: 69900,
      mrp: 89900,
      qty: 15,
    },
    {
      audience: "women" as const,
      categorySlug: "t-shirts",
      fit: "Regular",
      price: 54900,
      mrp: 74900,
      qty: 15,
    },
    {
      audience: "accessories" as const,
      categorySlug: "caps",
      fit: "Regular",
      price: 49900,
      mrp: 69900,
      qty: 10,
    },
  ];

  let count = 1;
  const manifest: ZipManifestProduct[] = [];

  for (const group of targets) {
    for (let i = 0; i < group.qty; i += 1) {
      const adj = adjectives[(count - 1) % adjectives.length]!;
      const theme = themes[Math.floor((count - 1) / adjectives.length) % themes.length]!;
      const title =
        `${group.audience === "men" ? "Men's" : group.audience === "women" ? "Women's" : ""} ${adj} ${theme} ${group.categorySlug.includes("oversized") ? "Oversized Tee" : group.categorySlug.includes("caps") ? "Cap" : "T-Shirt"}`.trim();
      const slug = `${group.audience}-${group.categorySlug}-prod-${count}`;
      const imgFilename = `images/prod_${count}.jpg`;
      zip.file(imgFilename, sampleJpegBuffer);

      const colors = ["Black", "White", "Navy"].slice(0, 2);
      const sizes = ["S", "M", "L", "XL"];
      const variants = colors.flatMap((color) =>
        sizes.map((size) => ({
          sku: `${slug.toUpperCase()}-${color.slice(0, 3).toUpperCase()}-${size}`,
          colour: color,
          size,
          mrpPaise: group.mrp,
          salePricePaise: group.price,
          availableStock: 25,
        })),
      );

      manifest.push({
        title,
        slug,
        audience: group.audience,
        categorySlug: group.categorySlug,
        brand: "THREAD",
        fit: group.fit,
        material: "100% Super Combed Cotton (210 GSM)",
        care: ["Wash inside out in cold water.", "Tumble dry low."],
        status: "active",
        featured: count % 10 === 0,
        images: [{ filename: imgFilename, alt: title, primary: true }],
        variants,
      });
      count += 1;
    }
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
