import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";

type AssetRole =
  "logo" | "hero" | "campaign" | "category" | "product" | "accessories" | "size-guide" | "unknown";

type Audience = "men" | "women" | "unisex" | null;

type Dimensions = Readonly<{
  width: number;
  height: number;
}>;

type AuditRecord = Readonly<{
  relativePath: string;
  fileType: string;
  dimensions: Dimensions | null;
  assetRole: AssetRole;
  audience: Audience;
  sha256: string;
  included: boolean;
  needsReview: boolean;
  publicPath: string | null;
  findings: readonly string[];
}>;

const repositoryRoot = process.cwd();
const manifestOutputPath = path.join(
  repositoryRoot,
  "apps/web/src/content/generated-asset-manifest.ts",
);
const auditOutputPath = path.join(repositoryRoot, "docs/asset-audit.md");

async function formatOutput(source: string, filePath: string): Promise<string> {
  const config = (await resolveConfig(filePath)) ?? {};
  return format(source, { ...config, filepath: filePath });
}

const candidateRoots = [
  "apps/web/public",
  "public",
  "src/assets",
  "assets",
  "images",
  "uploads",
  "pictures",
] as const;

const supportedExtensions = new Map<string, string>([
  [".avif", "AVIF image"],
  [".csv", "CSV"],
  [".gif", "GIF image"],
  [".ico", "ICO image"],
  [".jpeg", "JPEG image"],
  [".jpg", "JPEG image"],
  [".mov", "QuickTime video"],
  [".mp3", "MP3 audio"],
  [".mp4", "MP4 video"],
  [".otf", "OpenType font"],
  [".pdf", "PDF"],
  [".png", "PNG image"],
  [".svg", "SVG image"],
  [".ttf", "TrueType font"],
  [".wav", "WAV audio"],
  [".webm", "WebM video"],
  [".webp", "WebP image"],
  [".woff", "WOFF font"],
  [".woff2", "WOFF2 font"],
]);

const imageExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

// These files visibly use third-party character/trademark material. Keep this
// denylist explicit so an asset cannot become public merely by being moved.
const blockedContent = new Map<string, string>([
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0158.jpg",
    "PlayStation-style controller symbols; licence/trademark permission not supplied.",
  ],
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0159.jpg",
    "PlayStation-style controller symbols; licence/trademark permission not supplied.",
  ],
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0160.jpg",
    "PlayStation-style controller symbols; licence/trademark permission not supplied.",
  ],
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0161.jpg",
    "PlayStation-style controller symbols; licence/trademark permission not supplied.",
  ],
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0182.jpg",
    "Minion character artwork; licence permission not supplied.",
  ],
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0183.jpg",
    "Minion character artwork; licence permission not supplied.",
  ],
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0184.jpg",
    "Minion character artwork; licence permission not supplied.",
  ],
  [
    "pictures/Thread Mens Oversized DTF T-shirt/IMG-20260713-WA0185.jpg",
    "Minion character artwork; licence permission not supplied.",
  ],
]);
const blockedHashes = new Map<string, string>([
  [
    "c013767c9479012b78b7ddafbba16e637af4b2d4aa0a1d9bf8ced6b74f167c56",
    "PlayStation-style controller symbols; licence/trademark permission not supplied.",
  ],
  [
    "f734cdec2c9fc00d1bed0d004709fff5908fc2b4f3e94085a976438f58b17c01",
    "PlayStation-style controller symbols; licence/trademark permission not supplied.",
  ],
  [
    "e85ea4d9dc02fa804801a4cba1acac8411a3f6add894aec51c7eecaf053e771a",
    "PlayStation-style controller symbols; licence/trademark permission not supplied.",
  ],
  [
    "65fa06c4ca821a66d1e020d79e3ab80d8212b893188d8528dd2b545468f45179",
    "PlayStation-style controller symbols; licence/trademark permission not supplied.",
  ],
  [
    "8e338373de9e4732453b382c8ef8ef04e0360ce06eabac8373cd3bd343ad4047",
    "Minion character artwork; licence permission not supplied.",
  ],
  [
    "c3ec9260be5e09d908a22951a4d859c24d39921b85d28c47dceab49d3dc017c7",
    "Minion character artwork; licence permission not supplied.",
  ],
  [
    "d7dce83c42e43882120b67b9d7d950e771210d4de1952354c7212ed04483cf2a",
    "Minion character artwork; licence permission not supplied.",
  ],
  [
    "ba698fd9d4393595a05da778a031a90e65e030044de5809abe0a7bd3458f059c",
    "Minion character artwork; licence permission not supplied.",
  ],
]);

const referenceOnlyPattern =
  /(?:^|\/)(?:screenshots?|references?)(?:\/|$)|(?:screenshot|screen-shot)/i;
const sensitivePathPattern =
  /(?:^|\/)(?:private|secrets?|credentials?|contracts?|invoices?)(?:\/|$)/i;

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
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
    if (marker === undefined || marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    if (offset + 2 > buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      throw new Error("Invalid JPEG segment");
    }

    if (startOfFrameMarkers.has(marker)) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width < 1 || height < 1) {
        throw new Error("Invalid JPEG dimensions");
      }
      return { width, height };
    }

    offset += segmentLength;
  }

  throw new Error("JPEG dimensions not found");
}

function readPngDimensions(buffer: Buffer): Dimensions {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Invalid PNG signature");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1) {
    throw new Error("Invalid PNG dimensions");
  }
  return { width, height };
}

function readGifDimensions(buffer: Buffer): Dimensions {
  const signature = buffer.subarray(0, 6).toString("ascii");
  if (buffer.length < 10 || (signature !== "GIF87a" && signature !== "GIF89a")) {
    throw new Error("Invalid GIF signature");
  }
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function validateKnownFormat(extension: string, buffer: Buffer): Dimensions | null {
  if (extension === ".jpg" || extension === ".jpeg") {
    return readJpegDimensions(buffer);
  }
  if (extension === ".png") {
    return readPngDimensions(buffer);
  }
  if (extension === ".gif") {
    return readGifDimensions(buffer);
  }
  if (extension === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Invalid PDF signature");
  }
  if (extension === ".svg" && !buffer.toString("utf8", 0, 4096).includes("<svg")) {
    throw new Error("Invalid SVG document");
  }
  if (extension === ".webp" && buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error("Invalid WebP signature");
  }
  return null;
}

function classify(relativePath: string): {
  assetRole: AssetRole;
  audience: Audience;
} {
  const value = relativePath.toLowerCase();
  const audience: Audience = value.includes("women")
    ? "women"
    : value.includes("men")
      ? "men"
      : value.includes("unisex")
        ? "unisex"
        : null;

  if (value.includes("logo")) return { assetRole: "logo", audience };
  if (value.includes("hero")) return { assetRole: "hero", audience };
  if (value.includes("campaign") || value.includes("banner")) {
    return { assetRole: "campaign", audience };
  }
  if (value.includes("categor")) return { assetRole: "category", audience };
  if (value.includes("accessor")) return { assetRole: "accessories", audience };
  if (
    value.includes("1784040342109") ||
    value.includes("size-guide") ||
    value.includes("size_chart")
  ) {
    return { assetRole: "size-guide", audience };
  }
  if (value.includes("t-shirt") || value.includes("product")) {
    return { assetRole: "product", audience };
  }
  return { assetRole: "unknown", audience };
}

function getPublicPath(relativePath: string): string | null {
  for (const prefix of ["apps/web/public/", "public/"]) {
    if (relativePath.startsWith(prefix)) {
      return `/${relativePath.slice(prefix.length)}`;
    }
  }
  return null;
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function makeId(relativePath: string): string {
  return createHash("sha256").update(relativePath).digest("hex").slice(0, 16);
}

async function inspectFile(absolutePath: string): Promise<AuditRecord | null> {
  const relativePath = toPosix(path.relative(repositoryRoot, absolutePath));
  const extension = path.extname(relativePath).toLowerCase();
  const fileType = supportedExtensions.get(extension);
  if (fileType === undefined) {
    return null;
  }

  const findings: string[] = [];
  const buffer = await fs.readFile(absolutePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const { assetRole, audience } = classify(relativePath);
  let dimensions: Dimensions | null = null;
  let included = true;

  try {
    dimensions = validateKnownFormat(extension, buffer);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown validation failure";
    findings.push(`Excluded as corrupted: ${message}.`);
    included = false;
  }

  if (referenceOnlyPattern.test(relativePath)) {
    findings.push("Excluded: screenshot/reference-only source.");
    included = false;
  }
  if (sensitivePathPattern.test(relativePath)) {
    findings.push("Excluded: potentially private or sensitive document path.");
    included = false;
  }

  const blockedReason = blockedContent.get(relativePath) ?? blockedHashes.get(sha256);
  if (blockedReason !== undefined) {
    findings.push(`Excluded: ${blockedReason}`);
    included = false;
  }

  const publicPath = getPublicPath(relativePath);
  const isClientSource = relativePath.startsWith("pictures/");
  const needsReview =
    isClientSource || publicPath === null || assetRole === "unknown" || blockedReason !== undefined;

  if (isClientSource && included) {
    findings.push("Client-supplied source; usage rights and product mapping require confirmation.");
  }
  if (assetRole === "size-guide") {
    findings.push("Measurement unit and applicable product fits are not stated.");
  }
  if (imageExtensions.has(extension) && dimensions === null && included) {
    findings.push("Dimensions were not decoded by the dependency-free scanner; review before use.");
  }

  return {
    relativePath,
    fileType,
    dimensions,
    assetRole,
    audience,
    sha256,
    included,
    needsReview,
    publicPath,
    findings,
  };
}

async function buildAudit(): Promise<AuditRecord[]> {
  const files: string[] = [];
  for (const root of candidateRoots) {
    const absoluteRoot = path.join(repositoryRoot, root);
    if (await exists(absoluteRoot)) {
      files.push(...(await walk(absoluteRoot)));
    }
  }

  const uniqueFiles = [...new Set(files)].sort((left, right) => left.localeCompare(right));
  const inspected = await Promise.all(uniqueFiles.map(inspectFile));
  const records = inspected.filter((record): record is AuditRecord => record !== null);
  const byHash = new Map<string, AuditRecord[]>();

  for (const record of records) {
    const matches = byHash.get(record.sha256) ?? [];
    matches.push(record);
    byHash.set(record.sha256, matches);
  }

  return records.map((record) => {
    const matches = byHash.get(record.sha256) ?? [];
    if (matches.length < 2) {
      return record;
    }
    const duplicatePaths = matches
      .filter((match) => match.relativePath !== record.relativePath)
      .map((match) => match.relativePath);
    return {
      ...record,
      needsReview: record.relativePath.startsWith("apps/web/public/assets/approved/")
        ? record.needsReview
        : true,
      findings: [...record.findings, `Byte-identical duplicate of: ${duplicatePaths.join(", ")}.`],
    };
  });
}

function renderManifest(records: readonly AuditRecord[]): string {
  const included = records.filter((record) => record.included);
  const entries = included.map((record) => ({
    id: makeId(record.relativePath),
    sourcePath: record.relativePath,
    publicPath: record.publicPath,
    fileType: record.fileType,
    width: record.dimensions?.width ?? null,
    height: record.dimensions?.height ?? null,
    assetRole: record.assetRole,
    audience: record.audience,
    needsReview: record.needsReview,
  }));

  return (
    `// Generated by scripts/build-asset-manifest.ts. Do not edit manually.\n\n` +
    `export type AssetRole =\n` +
    `  | "logo"\n  | "hero"\n  | "campaign"\n  | "category"\n  | "product"\n` +
    `  | "accessories"\n  | "size-guide"\n  | "unknown";\n\n` +
    `export type AssetAudience = "men" | "women" | "unisex" | null;\n\n` +
    `export interface GeneratedAsset {\n` +
    `  readonly id: string;\n  readonly sourcePath: string;\n` +
    `  readonly publicPath: string | null;\n  readonly fileType: string;\n` +
    `  readonly width: number | null;\n  readonly height: number | null;\n` +
    `  readonly assetRole: AssetRole;\n  readonly audience: AssetAudience;\n` +
    `  readonly needsReview: boolean;\n}\n\n` +
    `export const generatedAssetManifest = ${JSON.stringify(entries, null, 2)} as const satisfies readonly GeneratedAsset[];\n`
  );
}

function renderAudit(records: readonly AuditRecord[]): string {
  const includedCount = records.filter((record) => record.included).length;
  const excludedCount = records.length - includedCount;
  const reviewCount = records.filter((record) => record.included && record.needsReview).length;
  const duplicateGroups = new Set(
    records
      .filter((record) => record.findings.some((finding) => finding.startsWith("Byte-identical")))
      .map((record) => record.sha256),
  ).size;
  const countByExtension = (extensions: readonly string[]): number =>
    records.filter((record) =>
      extensions.some((extension) => record.relativePath.toLowerCase().endsWith(extension)),
    ).length;
  const nonImageCount = records.filter(
    (record) => !imageExtensions.has(path.extname(record.relativePath).toLowerCase()),
  ).length;
  const productImageCount = records.filter(
    (record) => record.assetRole === "product" && record.fileType.endsWith("image"),
  ).length;
  const sizeGuideCount = records.filter((record) => record.assetRole === "size-guide").length;
  const publicApprovedCount = records.filter(
    (record) =>
      record.included &&
      !record.needsReview &&
      record.relativePath.startsWith("apps/web/public/assets/approved/"),
  ).length;

  const lines = records.map((record) => {
    const dimensions = record.dimensions
      ? `${record.dimensions.width}×${record.dimensions.height}`
      : "—";
    const approximateUse = record.audience
      ? `${record.assetRole} (${record.audience})`
      : record.assetRole;
    const findings = record.findings.length > 0 ? record.findings.join(" ") : "None detected.";
    return `| \`${escapeMarkdown(record.relativePath)}\` | ${record.fileType} | ${dimensions} | ${approximateUse} | ${record.included ? "Included" : "Excluded"} | ${record.needsReview ? "Yes" : "No"} | ${escapeMarkdown(findings)} |`;
  });

  return (
    `# THREAD asset audit\n\n` +
    `Generated by \`pnpm assets:audit\`. Original client files are not renamed or moved.\n\n` +
    `## Scope and policy\n\n` +
    `The scanner checks existing \`public/\`, \`src/assets/\`, \`assets/\`, \`images/\`, \`uploads/\`, \`apps/web/public/\`, and client-supplied \`pictures/\` folders when present. It inventories supported images, fonts, PDFs, CSV files, audio, and video. Hidden metadata files are ignored. Reference screenshots, sensitive/private paths, corrupted files, unsupported formats, and explicitly blocked third-party content are excluded from the generated manifest.\n\n` +
    `A manifest entry with \`publicPath: null\` is a source candidate, not a browser-ready URL. A \`needsReview: true\` entry must not be published until usage rights, product association, alt text, and relevant business metadata are confirmed.\n\n` +
    `## Summary\n\n` +
    `- Discovered supported assets: ${records.length}\n` +
    `- Included manifest candidates: ${includedCount}\n` +
    `- Excluded assets: ${excludedCount}\n` +
    `- Included assets still requiring review: ${reviewCount}\n` +
    `- Browser-ready approved public assets: ${publicApprovedCount}\n` +
    `- Byte-identical duplicate groups: ${duplicateGroups}\n` +
    `- JPEG files discovered: ${countByExtension([".jpg", ".jpeg"])}\n` +
    `- PNG files discovered: ${countByExtension([".png"])}\n` +
    `- Product images discovered: ${productImageCount}\n` +
    `- Size-guide images discovered: ${sizeGuideCount}\n` +
    `- Fonts, PDFs, CSVs, audio, and video discovered: ${nonImageCount}\n\n` +
    `## Content findings\n\n` +
    `- One complete four-view product group visibly contains a Minion character and is excluded because no character licence was supplied.\n` +
    `- One complete four-view product group visibly uses PlayStation-style controller symbols and is excluded because no trademark/licence permission was supplied.\n` +
    `- No competitor storefront logo or competitor screenshot was found in the repository.\n` +
    `- The client supplied the THREAD photography and explicitly authorised its storefront use. Normalised files under \`apps/web/public/assets/approved/\` are publishable; the original handoff remains a source archive.\n` +
    `- Product prices, stock, colours, sizes, weights, material, tax and HSN data are not established by image approval and still require client confirmation.\n` +
    `- The size chart is included as a review candidate, but its unit and applicable fits are unknown.\n\n` +
    `## Full inventory\n\n` +
    `| Relative path | File type | Dimensions | Approximate use | Manifest | Needs review | Duplicate or suspicious findings |\n` +
    `| --- | --- | ---: | --- | --- | --- | --- |\n` +
    `${lines.join("\n")}\n`
  );
}

async function main(): Promise<void> {
  const records = await buildAudit();
  const included = records.filter((record) => record.included);

  for (const record of included) {
    const absoluteSource = path.join(repositoryRoot, record.relativePath);
    if (!(await exists(absoluteSource))) {
      throw new Error(`Generated source path does not exist: ${record.relativePath}`);
    }
    if (
      record.publicPath !== null &&
      !record.relativePath.startsWith("apps/web/public/") &&
      !record.relativePath.startsWith("public/")
    ) {
      throw new Error(`Invalid public path mapping: ${record.relativePath}`);
    }
  }

  await fs.mkdir(path.dirname(manifestOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(auditOutputPath), { recursive: true });
  await Promise.all([
    fs.writeFile(
      manifestOutputPath,
      await formatOutput(renderManifest(records), manifestOutputPath),
      "utf8",
    ),
    fs.writeFile(
      auditOutputPath,
      await formatOutput(renderAudit(records), auditOutputPath),
      "utf8",
    ),
  ]);

  const excluded = records.length - included.length;
  process.stdout.write(
    `Asset manifest generated: ${included.length} included, ${excluded} excluded, ${records.length} audited.\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
