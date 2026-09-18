import JSZip from "jszip";
import { promises as fs } from "node:fs";
import path from "node:path";

interface ProductSeedSpec {
  title: string;
  slug: string;
  audience: "men" | "women" | "accessories";
  categorySlug: string;
  brand: string;
  fit: "Regular" | "Oversized" | "Classic";
  mrpPaise: number;
  salePricePaise: number;
  colors: string[];
}

const adjectives = ["Urban", "Vintage", "Cyber", "Minimal", "Essential", "Street", "Graphic", "Retro", "Monochrome", "Velvet"];
const themes = ["Dragon", "Nebula", "Pixel", "Nomad", "Horizon", "Phantom", "Solar", "Echo", "Aura", "Vortex"];

function generate100ProductSpecs(): ProductSeedSpec[] {
  const specs: ProductSeedSpec[] = [];
  let count = 1;

  // Categories & Audiences distribution:
  // Men: Topwear -> Oversized T-Shirts (25), T-Shirts (20), Classic Fit T-Shirts (15)
  // Women: Oversized T-Shirts (15), T-Shirts (15)
  // Accessories: Caps & Bags (10)

  const targets = [
    { audience: "men" as const, categorySlug: "oversized-t-shirts", fit: "Oversized" as const, price: 69900, mrp: 89900, qty: 25 },
    { audience: "men" as const, categorySlug: "t-shirts", fit: "Regular" as const, price: 54900, mrp: 74900, qty: 20 },
    { audience: "men" as const, categorySlug: "classic-fit-t-shirts", fit: "Classic" as const, price: 59900, mrp: 79900, qty: 15 },
    { audience: "women" as const, categorySlug: "oversized-t-shirts", fit: "Oversized" as const, price: 69900, mrp: 89900, qty: 15 },
    { audience: "women" as const, categorySlug: "t-shirts", fit: "Regular" as const, price: 54900, mrp: 74900, qty: 15 },
    { audience: "accessories" as const, categorySlug: "caps", fit: "Regular" as const, price: 49900, mrp: 69900, qty: 10 },
  ];

  for (const group of targets) {
    for (let i = 0; i < group.qty; i += 1) {
      const adj = adjectives[(count - 1) % adjectives.length]!;
      const theme = themes[Math.floor((count - 1) / adjectives.length) % themes.length]!;
      const title = `${group.audience === "men" ? "Men's" : group.audience === "women" ? "Women's" : ""} ${adj} ${theme} ${group.categorySlug.includes("oversized") ? "Oversized Tee" : group.categorySlug.includes("caps") ? "Cap" : "T-Shirt"}`.trim();
      const slug = `${group.audience}-${group.categorySlug}-prod-${count}`;
      
      specs.push({
        title,
        slug,
        audience: group.audience,
        categorySlug: group.categorySlug,
        brand: "THREAD",
        fit: group.fit,
        mrpPaise: group.mrp,
        salePricePaise: group.price,
        colors: ["Black", "White", "Navy", "Olive", "Sand"].slice(0, 3),
      });
      count += 1;
    }
  }

  return specs;
}

// Minimal valid 1x1 JPEG byte sequence to serve as realistic image file inside zip
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

export async function generateInventoryZipFile(): Promise<string> {
  const zip = new JSZip();
  const specs = generate100ProductSpecs();

  const manifest = specs.map((spec, idx) => {
    const imgFilename = `images/prod_${idx + 1}.jpg`;
    zip.file(imgFilename, sampleJpegBuffer);

    const sizes = ["S", "M", "L", "XL"];
    const variants = spec.colors.flatMap((color) =>
      sizes.map((size) => ({
        sku: `${spec.slug.toUpperCase()}-${color.slice(0, 3).toUpperCase()}-${size}`,
        colour: color,
        size,
        mrpPaise: spec.mrpPaise,
        salePricePaise: spec.salePricePaise,
        availableStock: 25,
      })),
    );

    return {
      title: spec.title,
      slug: spec.slug,
      audience: spec.audience,
      categorySlug: spec.categorySlug,
      brand: spec.brand,
      fit: spec.fit,
      material: "100% Super Combed Cotton (210 GSM)",
      care: ["Wash inside out in cold water.", "Tumble dry low.", "Do not iron print."],
      status: "active",
      featured: idx % 10 === 0,
      images: [
        {
          filename: imgFilename,
          alt: `${spec.title} front view`,
          primary: true,
        },
      ],
      variants,
    };
  });

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const distDir = path.resolve(process.cwd(), "dist");
  await fs.mkdir(distDir, { recursive: true });

  const zipOutputPath = path.join(distDir, "inventory-100-products.zip");
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  await fs.writeFile(zipOutputPath, zipBuffer);
  console.log(`[SUCCESS] Generated 100-product inventory ZIP at: ${zipOutputPath} (${zipBuffer.length} bytes)`);
  return zipOutputPath;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  generateInventoryZipFile().catch(console.error);
}
