import { promises as fs } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";

interface Dimensions {
  readonly width: number;
  readonly height: number;
}

interface SourceGroup {
  readonly audience: "men" | "women";
  readonly categorySlug: "oversized-t-shirts" | "t-shirts";
  readonly fit: "Oversized" | "Regular";
  readonly folder: string;
  readonly publicSegment: string;
  readonly title: string;
}

interface PreparedImage {
  readonly alt: string;
  readonly bytes: number;
  readonly format: "jpg";
  readonly height: number;
  readonly mimeType: "image/jpeg";
  readonly publicId: string;
  readonly source: "local";
  readonly sourcePath: string;
  readonly src: string;
  readonly width: number;
}

interface PreparedProduct {
  readonly assetKey: string;
  readonly audience: "men" | "women";
  readonly categorySlug: "oversized-t-shirts" | "t-shirts";
  readonly fit: "Oversized" | "Regular";
  readonly images: readonly PreparedImage[];
  readonly skuStem: string;
  readonly slug: string;
  readonly styleNumber: number;
  readonly title: string;
}

const repositoryRoot = process.cwd();
const managedPublicRoot = path.join(
  repositoryRoot,
  "apps/web/public/assets/approved/client-products",
);
const sizeGuideOutput = path.join(
  repositoryRoot,
  "apps/web/public/assets/approved/size-guides/thread-tshirt-size-guide.png",
);
const generatedOutput = path.join(repositoryRoot, "packages/types/src/generated-client-assets.ts");

async function formatOutput(source: string, filePath: string): Promise<string> {
  const config = (await resolveConfig(filePath)) ?? {};
  return format(source, { ...config, filepath: filePath });
}

const groups: readonly SourceGroup[] = [
  {
    audience: "men",
    categorySlug: "oversized-t-shirts",
    fit: "Oversized",
    folder: "pictures/Thread Mens Oversized DTF T-shirt",
    publicSegment: "men/oversized",
    title: "Men's Oversized Printed T-Shirt",
  },
  {
    audience: "men",
    categorySlug: "t-shirts",
    fit: "Regular",
    folder: "pictures/Thread'S Mens Regular DTF T-Shirt",
    publicSegment: "men/regular",
    title: "Men's Regular Printed T-Shirt",
  },
  {
    audience: "women",
    categorySlug: "t-shirts",
    fit: "Regular",
    folder: "pictures/Thread's Women Regular DTF T-shirts",
    publicSegment: "women/regular",
    title: "Women's Regular Printed T-Shirt",
  },
] as const;

// Entire four-view product groups are quarantined when any view contains
// recognisable third-party character or trademark material.
const blockedGroupStarts = new Map<string, string>([
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0158.jpg",
    "PlayStation-style controller symbols",
  ],
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0182.jpg",
    "Minion character artwork",
  ],
]);

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function readJpegDimensions(buffer: Buffer): Dimensions {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("Invalid JPEG signature");
  }
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === undefined || marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      throw new Error("Invalid JPEG segment");
    }
    if (startOfFrameMarkers.has(marker)) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width < 1 || height < 1) throw new Error("Invalid JPEG dimensions");
      return { width, height };
    }
    offset += segmentLength;
  }
  throw new Error("JPEG dimensions not found");
}

function imageSequence(fileName: string): number {
  const match = /-WA(\d+)\.jpg$/i.exec(fileName);
  if (!match?.[1]) throw new Error(`Unexpected client image filename: ${fileName}`);
  return Number(match[1]);
}

async function prepareGroup(group: SourceGroup): Promise<{
  readonly blocked: readonly string[];
  readonly products: readonly PreparedProduct[];
}> {
  const absoluteFolder = path.join(repositoryRoot, group.folder);
  const sourceFiles = (await fs.readdir(absoluteFolder))
    .filter((fileName) => /\.jpg$/i.test(fileName))
    .sort((left, right) => imageSequence(left) - imageSequence(right));
  if (sourceFiles.length !== 100) {
    throw new Error(
      `${group.folder} must contain exactly 100 JPEG files; found ${sourceFiles.length}.`,
    );
  }

  const products: PreparedProduct[] = [];
  const blocked: string[] = [];
  for (let offset = 0; offset < sourceFiles.length; offset += 4) {
    const groupFiles = sourceFiles.slice(offset, offset + 4);
    if (groupFiles.length !== 4) throw new Error(`Incomplete product group in ${group.folder}.`);
    const styleNumber = offset / 4 + 1;
    const style = String(styleNumber).padStart(2, "0");
    const groupStart = `${group.folder}/${groupFiles[0]}`;
    const blockedReason = blockedGroupStarts.get(groupStart);
    if (blockedReason) {
      blocked.push(`${groupStart}: ${blockedReason}`);
      continue;
    }

    const publicDirectory = path.join(managedPublicRoot, group.publicSegment, `style-${style}`);
    await fs.mkdir(publicDirectory, { recursive: true });
    const images: PreparedImage[] = [];
    for (const [imageIndex, fileName] of groupFiles.entries()) {
      const view = imageIndex + 1;
      const sourcePath = `${group.folder}/${fileName}`;
      const absoluteSource = path.join(repositoryRoot, sourcePath);
      const publicFileName = `image-${String(view).padStart(2, "0")}.jpg`;
      const absoluteOutput = path.join(publicDirectory, publicFileName);
      const buffer = await fs.readFile(absoluteSource);
      const dimensions = readJpegDimensions(buffer);
      await fs.copyFile(absoluteSource, absoluteOutput);
      images.push({
        alt: `THREAD ${group.title.toLowerCase()} style ${style}, view ${view} of 4`,
        bytes: buffer.byteLength,
        format: "jpg",
        height: dimensions.height,
        mimeType: "image/jpeg",
        publicId: `local/client-products/${group.publicSegment}/style-${style}/image-${String(view).padStart(2, "0")}`,
        source: "local",
        sourcePath,
        src: `/assets/approved/client-products/${group.publicSegment}/style-${style}/${publicFileName}`,
        width: dimensions.width,
      });
    }
    const code = `${group.audience === "men" ? "M" : "W"}-${group.fit === "Oversized" ? "OS" : "RG"}-${style}`;
    products.push({
      assetKey: code.toLowerCase(),
      audience: group.audience,
      categorySlug: group.categorySlug,
      fit: group.fit,
      images,
      skuStem: `DEMO-${code}`,
      slug: `demo-thread-${group.audience}-${group.fit.toLowerCase()}-style-${style}`,
      styleNumber,
      title: `${group.title} — Style ${style}`,
    });
  }
  return { blocked, products };
}

async function prepareSizeGuide(): Promise<{
  readonly alt: string;
  readonly bytes: number;
  readonly format: "png";
  readonly height: number;
  readonly mimeType: "image/png";
  readonly publicId: string;
  readonly source: "local";
  readonly sourcePath: string;
  readonly src: string;
  readonly width: number;
}> {
  const sourcePath = "pictures/1784040342109.png";
  const buffer = await fs.readFile(path.join(repositoryRoot, sourcePath));
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Invalid client size-guide PNG.");
  }
  await fs.mkdir(path.dirname(sizeGuideOutput), { recursive: true });
  await fs.copyFile(path.join(repositoryRoot, sourcePath), sizeGuideOutput);
  return {
    alt: "THREAD T-shirt size chart showing chest, length, sleeve, sleeve opening and shoulder measurements for S to 2XL",
    bytes: buffer.byteLength,
    format: "png",
    height: buffer.readUInt32BE(20),
    mimeType: "image/png",
    publicId: "local/size-guides/thread-tshirt-size-guide",
    source: "local",
    sourcePath,
    src: "/assets/approved/size-guides/thread-tshirt-size-guide.png",
    width: buffer.readUInt32BE(16),
  };
}

function renderGenerated(
  products: readonly PreparedProduct[],
  sizeGuide: Awaited<ReturnType<typeof prepareSizeGuide>>,
): string {
  const byKey = new Map(products.map((product) => [product.assetKey, product]));
  const select = (key: string, imageIndex = 0): PreparedImage => {
    const image = byKey.get(key)?.images[imageIndex];
    if (!image) throw new Error(`Missing prepared storefront image ${key}:${imageIndex}.`);
    return image;
  };
  const storefrontImage = ({
    sourcePath: _sourcePath,
    ...image
  }: PreparedImage | Awaited<ReturnType<typeof prepareSizeGuide>>) => image;
  const storefrontMedia = {
    heroDesktop: storefrontImage(select("m-os-01", 0)),
    heroMobile: storefrontImage(select("m-os-01", 2)),
    menAudience: storefrontImage(select("m-os-02", 0)),
    womenAudience: storefrontImage(select("w-rg-01", 0)),
    tshirtsCategory: storefrontImage(select("m-rg-02", 0)),
    oversizedCategory: storefrontImage(select("m-os-03", 0)),
    regularCategory: storefrontImage(select("w-rg-03", 0)),
    editorial: storefrontImage(select("w-rg-04", 0)),
    menMenu: storefrontImage(select("m-rg-01", 0)),
    womenMenu: storefrontImage(select("w-rg-02", 0)),
    sizeGuide: storefrontImage(sizeGuide),
  };

  return (
    `// Generated by scripts/prepare-client-assets.ts. Do not edit manually.\n\n` +
    `export interface ClientImageAsset {\n` +
    `  readonly alt: string;\n  readonly bytes: number;\n` +
    `  readonly format: "jpg" | "png";\n  readonly height: number;\n` +
    `  readonly mimeType: "image/jpeg" | "image/png";\n` +
    `  readonly publicId: string;\n  readonly source: "local";\n` +
    `  readonly sourcePath: string;\n  readonly src: string;\n  readonly width: number;\n}\n\n` +
    `export type StorefrontImageAsset = Omit<ClientImageAsset, "sourcePath">;\n\n` +
    `export interface ClientProductAsset {\n` +
    `  readonly assetKey: string;\n  readonly audience: "men" | "women";\n` +
    `  readonly categorySlug: "oversized-t-shirts" | "t-shirts";\n` +
    `  readonly fit: "Oversized" | "Regular";\n` +
    `  readonly images: readonly ClientImageAsset[];\n  readonly skuStem: string;\n` +
    `  readonly slug: string;\n  readonly styleNumber: number;\n  readonly title: string;\n}\n\n` +
    `export const clientProductAssets = ${JSON.stringify(products, null, 2)} as const satisfies readonly ClientProductAsset[];\n\n` +
    `export const storefrontMedia = ${JSON.stringify(storefrontMedia, null, 2)} as const satisfies Readonly<Record<string, StorefrontImageAsset>>;\n`
  );
}

async function main(): Promise<void> {
  await fs.rm(managedPublicRoot, { recursive: true, force: true });
  await fs.mkdir(managedPublicRoot, { recursive: true });
  const prepared = await Promise.all(groups.map(prepareGroup));
  const products = prepared.flatMap((result) => result.products);
  const blocked = prepared.flatMap((result) => result.blocked);
  const sizeGuide = await prepareSizeGuide();
  await fs.mkdir(path.dirname(generatedOutput), { recursive: true });
  await fs.writeFile(
    generatedOutput,
    await formatOutput(renderGenerated(products, sizeGuide), generatedOutput),
    "utf8",
  );

  const publicImages = products.reduce((count, product) => count + product.images.length, 0);
  process.stdout.write(
    `Prepared ${products.length} product galleries (${publicImages} photos) and 1 size guide. Quarantined ${blocked.length} product groups (${blocked.length * 4} photos).\n`,
  );
  for (const finding of blocked) process.stdout.write(`- ${toPosix(finding)}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
