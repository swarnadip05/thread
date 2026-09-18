"use client";

import { Badge, Button } from "@thread/ui";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FolderUp,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/auth-provider";

// Uploads go directly to Render to bypass serverless body limits
const DIRECT_API_URL = "https://thread-sfe5.onrender.com/api/v1";

interface UploadResult {
  productsCreated: number;
  variantsCreated: number;
  imagesUploaded: number;
  errors: string[];
}

const POPULAR_COLOURS = [
  // Whites & Creams
  "Pure White",
  "Off-White / Cream",
  "Ivory",
  // Blacks & Greys
  "Jet Black",
  "Vintage Black",
  "Charcoal Grey",
  "Light Grey / Ash",
  "Slate Grey",
  // Reds & Pinks
  "Red",
  "Bright Red",
  "Cherry Red",
  "Crimson",
  "Coral",
  "Blush Pink",
  "Hot Pink",
  "Baby Pink",
  "Rose Gold",
  // Oranges & Yellows
  "Orange",
  "Rust Orange",
  "Burnt Orange",
  "Peach",
  "Yellow",
  "Mustard Yellow",
  "Lemon Yellow",
  "Golden Yellow",
  // Greens
  "Green",
  "Bottle Green",
  "Sage Green",
  "Olive Green",
  "Mint Green",
  "Forest Green",
  "Lime Green",
  "Army Green",
  // Blues
  "Blue",
  "Navy Blue",
  "Royal Blue",
  "Cobalt Blue",
  "Sky Blue",
  "Baby Blue",
  "Teal Blue",
  "Teal",
  "Cyan",
  "Denim Blue",
  "Midnight Blue",
  // Purples & Violets
  "Purple",
  "Lavender Purple",
  "Violet",
  "Indigo",
  "Plum",
  "Lilac",
  "Mauve",
  // Browns & Neutrals
  "Mocha Brown",
  "Brown",
  "Chocolate Brown",
  "Caramel",
  "Tan",
  "Beige / Sand",
  "Khaki",
  // Special
  "Maroon",
  "Burgundy",
  "Multicolour",
  "Tie-Dye",
  "Printed",
];

const ALL_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

export function ProductUploadWizard() {
  const { accessToken } = useAuth();

  // Wizard step: 1 = select, 2 = settings, 3 = review, 4 = uploading/done
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Selected files
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing product count to number products sequentially (#4, #5, etc.)
  const [existingProductCount, setExistingProductCount] = useState<number>(0);

  useEffect(() => {
    async function fetchTotal() {
      try {
        const res = await fetch(`${DIRECT_API_URL}/catalog/products?limit=1`);
        const json = await res.json();
        if (json?.success && typeof json?.data?.total === "number") {
          setExistingProductCount(json.data.total);
        }
      } catch {
        // Fallback: 0
      }
    }
    fetchTotal();
  }, []);

  function getProductNumber(index: number): number {
    return existingProductCount + index + 1;
  }

  // Settings
  const [audience, setAudience] = useState<"men" | "women" | "unisex">("men");
  const [category, setCategory] = useState<"oversized-t-shirts" | "classic-fit-t-shirts">("oversized-t-shirts");
  const [productType, setProductType] = useState<"oversized" | "regular">("oversized");
  const [imagesPerProduct, setImagesPerProduct] = useState<number>(5);
  const [defaultColour, setDefaultColour] = useState<string>("Pure White");

  // Global Size Selection
  const [globalSizes, setGlobalSizes] = useState<string[]>(["S", "M", "L", "XL", "2XL"]);

  // Pricing (in Rupees)
  const [priceSM, setPriceSM] = useState<number>(549);
  const [priceLXL, setPriceLXL] = useState<number>(599);
  const [priceXXL, setPriceXXL] = useState<number>(649);
  const [mrp, setMrp] = useState<number>(899);
  const [stockPerSize, setStockPerSize] = useState<number>(25);

  // Custom overrides per product (index => value)
  const [customColours, setCustomColours] = useState<Record<number, string>>({});
  const [customTitles, setCustomTitles] = useState<Record<number, string>>({});
  const [customSizes, setCustomSizes] = useState<Record<number, string[]>>({});

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>("Uploading photos...");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Client-side image optimizer: Resizes raw high-megabyte photos to crisp 2K JPEG
  // This prevents network timeouts, avoids server memory spikes, and saves cloud space
  async function optimizeImageForUpload(file: File): Promise<File> {
    if (file.size <= 1.2 * 1024 * 1024) {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_DIM = 2048;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) return resolve(file);
            const safeName = file.name.replace(/\.[^/.]+$/, ".jpg");
            resolve(new File([blob], safeName, { type: "image/jpeg", lastModified: Date.now() }));
          },
          "image/jpeg",
          0.88,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  // Sort files naturally by name
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [files]);

  // Group files into products
  const productGroups = useMemo(() => {
    const groups: File[][] = [];
    const perProd = Math.max(1, imagesPerProduct);
    for (let i = 0; i < sortedFiles.length; i += perProd) {
      groups.push(sortedFiles.slice(i, i + perProd));
    }
    return groups;
  }, [sortedFiles, imagesPerProduct]);

  function handleFileSelection(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!e.dataTransfer.files) return;
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...droppedFiles]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleGlobalSize(size: string) {
    setGlobalSizes((prev) => {
      if (prev.includes(size)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== size);
      }
      return [...prev, size];
    });
  }

  function getProductTitle(index: number): string {
    if (customTitles[index]) return customTitles[index]!;
    const clr = customColours[index] || defaultColour;
    const aud = audience === "men" ? "Men's" : audience === "women" ? "Women's" : "";
    const fit = productType === "oversized" ? "Oversized" : "Regular";
    return `${aud} ${clr} ${fit} Graphic T-Shirt #${getProductNumber(index)}`.trim();
  }

  function getProductSizes(index: number): string[] {
    return customSizes[index] || globalSizes;
  }

  function toggleProductSize(index: number, size: string) {
    const current = getProductSizes(index);
    let next: string[];
    if (current.includes(size)) {
      if (current.length === 1) return;
      next = current.filter((s) => s !== size);
    } else {
      next = [...current, size];
    }
    setCustomSizes((prev) => ({ ...prev, [index]: next }));
  }

  async function handleStartUpload() {
    if (!accessToken) {
      setUploadError("Please log in to upload products.");
      return;
    }
    if (files.length === 0) {
      setUploadError("No photos selected.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setStep(4);
    setUploadStatusText(`Preparing ${sortedFiles.length} photos...`);

    try {
      const formData = new FormData();
      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i]!;
        setUploadStatusText(`Optimizing photo ${i + 1} of ${sortedFiles.length} (${file.name})...`);
        const optimized = await optimizeImageForUpload(file);
        formData.append("files", optimized);
      }

      setUploadStatusText(`Uploading ${sortedFiles.length} photos to Cloud storage & creating products...`);
      formData.append("audience", audience);
      formData.append("category", category);
      formData.append("productType", productType);
      formData.append("imagesPerProduct", String(imagesPerProduct));
      formData.append("priceSM", String(priceSM));
      formData.append("priceLXL", String(priceLXL));
      formData.append("priceXXL", String(priceXXL));
      formData.append("mrp", String(mrp));
      formData.append("stockPerSize", String(stockPerSize));

      // Build product customizations
      const productCustomizations = productGroups.map((_, idx) => ({
        title: getProductTitle(idx),
        colour: customColours[idx] || defaultColour,
        sizes: getProductSizes(idx),
      }));

      formData.append("productCustomizations", JSON.stringify(productCustomizations));

      const response = await fetch(`${DIRECT_API_URL}/admin/products/batch-upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Batch upload failed");
      }

      setUploadResult(json.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  }

  function resetWizard() {
    setFiles([]);
    setStep(1);
    setUploadResult(null);
    setUploadError(null);
  }

  return (
    <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6 shadow-xl text-zinc-950">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-zinc-950">Product Photo Upload Wizard</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-0.5 text-xs font-black text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Space & Storage: 100% OK (25GB Free)
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-600">
            Upload a folder of photos, group them per product, and set size pricing automatically.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-zinc-100 border-2 border-zinc-300 px-4 text-sm font-black text-zinc-900 hover:bg-zinc-200 transition"
        >
          ← Back to Products
        </Link>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 grid grid-cols-4 gap-2 text-center text-xs font-semibold sm:text-sm">
        <div
          className={`rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider transition ${
            step === 1
              ? "bg-zinc-950 text-amber-400 shadow-md border-2 border-zinc-950"
              : step > 1
              ? "bg-amber-100 text-amber-950 border-2 border-amber-300"
              : "bg-zinc-100 text-zinc-400 border-2 border-zinc-200"
          }`}
        >
          1. Select Photos
        </div>
        <div
          className={`rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider transition ${
            step === 2
              ? "bg-zinc-950 text-amber-400 shadow-md border-2 border-zinc-950"
              : step > 2
              ? "bg-amber-100 text-amber-950 border-2 border-amber-300"
              : "bg-zinc-100 text-zinc-400 border-2 border-zinc-200"
          }`}
        >
          2. Category & Prices
        </div>
        <div
          className={`rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider transition ${
            step === 3
              ? "bg-zinc-950 text-amber-400 shadow-md border-2 border-zinc-950"
              : step > 3
              ? "bg-amber-100 text-amber-950 border-2 border-amber-300"
              : "bg-zinc-100 text-zinc-400 border-2 border-zinc-200"
          }`}
        >
          3. Preview
        </div>
        <div
          className={`rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider transition ${
            step === 4
              ? "bg-zinc-950 text-amber-400 shadow-md border-2 border-zinc-950"
              : "bg-zinc-100 text-zinc-400 border-2 border-zinc-200"
          }`}
        >
          4. Upload
        </div>
      </div>

      {/* STEP 1: Select Images */}
      {step === 1 && (
        <div className="space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center transition hover:border-amber-400 hover:bg-amber-50/20"
          >
            <FolderUp className="mb-3 h-12 w-12 text-zinc-400" />
            <h3 className="text-lg font-black text-zinc-950">Drop your product photos here</h3>
            <p className="mt-1 text-sm font-medium text-zinc-600">
              or click to browse from your computer. Select all 4–5 photos for each product.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileSelection}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-zinc-950">{files.length} photos selected</span>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="rounded-lg border-2 border-zinc-300 bg-white px-3 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-100 transition"
                >
                  Clear all
                </button>
              </div>

              <div className="grid max-h-[300px] grid-cols-4 gap-2 overflow-y-auto rounded-xl border-2 border-zinc-200 bg-zinc-50 p-2 sm:grid-cols-6 md:grid-cols-8">
                {sortedFiles.map((file, idx) => (
                  <div key={idx} className="group relative aspect-square rounded-lg bg-zinc-200 overflow-hidden shadow-sm">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 rounded-full bg-black/80 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/75 px-1 py-0.5 text-[9px] font-bold text-white truncate">
                      {idx + 1}. {file.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={files.length === 0}
              onClick={() => setStep(2)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black px-8 text-sm shadow-md transition disabled:opacity-50"
            >
              Continue to Settings ({files.length} Photos) →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Product Settings & Sizes */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Quick Size Selection Buttons */}
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5">
            <div className="mb-3">
              <h4 className="text-base font-black text-zinc-950">
                ⚡ Quick Size Selection (Click to choose which sizes are available)
              </h4>
              <p className="text-xs font-bold text-zinc-700">
                Select which sizes will be available for purchase. Customers can only buy the sizes you enable.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {ALL_SIZES.map((size) => {
                const isSelected = globalSizes.includes(size);
                const price =
                  size === "S" || size === "M" ? priceSM : size === "L" || size === "XL" ? priceLXL : priceXXL;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleGlobalSize(size)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition shadow-sm ${
                      isSelected
                        ? "bg-zinc-950 text-amber-400 border-2 border-amber-400 shadow-md ring-2 ring-amber-400/40"
                        : "bg-white text-zinc-900 border-2 border-zinc-300 hover:border-zinc-500 hover:bg-zinc-100"
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Square className="h-4 w-4 text-zinc-400" />
                    )}
                    <span>Size {size}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-black ${
                        isSelected ? "bg-amber-400/20 text-amber-300" : "bg-zinc-100 text-zinc-800"
                      }`}
                    >
                      ₹{price}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Photos per Product */}
            <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-4">
              <label className="block text-sm font-black text-zinc-950">Photos per Product</label>
              <p className="mb-3 text-xs font-semibold text-zinc-600">
                How many photos belong to each t-shirt design?
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={imagesPerProduct}
                  onChange={(e) => setImagesPerProduct(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded-xl border-2 border-zinc-400 bg-white px-3 py-2 text-center text-lg font-black text-zinc-950 focus:border-amber-400 focus:outline-none shadow-sm"
                />
                <span className="text-sm font-bold text-zinc-800">
                  photos per product = <strong className="text-black">{productGroups.length} products</strong>
                </span>
              </div>
            </div>

            {/* Target Audience */}
            <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-4">
              <label className="block text-sm font-black text-zinc-950">Target Audience</label>
              <p className="mb-3 text-xs font-semibold text-zinc-600">Who is this batch for?</p>
              <div className="flex gap-2">
                {(["men", "women", "unisex"] as const).map((aud) => (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setAudience(aud)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-black capitalize transition shadow-sm ${
                      audience === aud
                        ? "bg-zinc-950 text-white border-2 border-zinc-950 shadow-md"
                        : "border-2 border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 hover:text-black hover:border-zinc-400"
                    }`}
                  >
                    {aud === "men" ? "Men's" : aud === "women" ? "Women's" : "Unisex"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category & Fit */}
            <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-4">
              <label className="block text-sm font-black text-zinc-950">Category & Fit</label>
              <p className="mb-3 text-xs font-semibold text-zinc-600">Select fit category</p>
              <div className="flex gap-2">
                {[
                  { slug: "oversized-t-shirts", label: "Oversized Fit" },
                  { slug: "classic-fit-t-shirts", label: "Classic Fit" },
                ].map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => {
                      setCategory(cat.slug as any);
                      setProductType(cat.slug === "oversized-t-shirts" ? "oversized" : "regular");
                    }}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-black transition shadow-sm ${
                      category === cat.slug
                        ? "bg-zinc-950 text-white border-2 border-zinc-950 shadow-md"
                        : "border-2 border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 hover:text-black hover:border-zinc-400"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Colour */}
            <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-4">
              <label className="block text-sm font-black text-zinc-950">Default T-Shirt Colour</label>
              <p className="mb-3 text-xs font-semibold text-zinc-600">Named into title & description automatically</p>
              <div className="flex gap-2">
                <select
                  value={defaultColour}
                  onChange={(e) => setDefaultColour(e.target.value)}
                  className="w-full rounded-xl border-2 border-zinc-400 bg-white px-3 py-2.5 text-sm font-black text-zinc-950 focus:border-amber-400 focus:outline-none shadow-sm"
                >
                  {POPULAR_COLOURS.map((clr) => (
                    <option key={clr} value={clr} className="text-zinc-950 font-bold bg-white">
                      {clr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Size-Based Pricing Section */}
          <div className="rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-base font-black text-zinc-950">Size-Based Selling Prices (₹)</h4>
                <p className="text-xs font-bold text-zinc-700">
                  Configured according to your rules: S & M = ₹549, L & XL = ₹599, 2XL = ₹649
                </p>
              </div>
              <span className="rounded-lg bg-zinc-200 px-2.5 py-1 text-xs font-black text-zinc-800 border border-zinc-300">
                INR (₹)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-black text-zinc-800">Sizes S & M</label>
                <div className="mt-1 flex items-center rounded-xl border-2 border-zinc-400 bg-white px-3 shadow-sm">
                  <span className="text-sm font-black text-zinc-900">₹</span>
                  <input
                    type="number"
                    value={priceSM}
                    onChange={(e) => setPriceSM(Number(e.target.value))}
                    className="w-full bg-white text-zinc-950 px-2 py-2 font-black focus:outline-none text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-800">Sizes L & XL</label>
                <div className="mt-1 flex items-center rounded-xl border-2 border-zinc-400 bg-white px-3 shadow-sm">
                  <span className="text-sm font-black text-zinc-900">₹</span>
                  <input
                    type="number"
                    value={priceLXL}
                    onChange={(e) => setPriceLXL(Number(e.target.value))}
                    className="w-full bg-white text-zinc-950 px-2 py-2 font-black focus:outline-none text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-800">Size 2XL</label>
                <div className="mt-1 flex items-center rounded-xl border-2 border-zinc-400 bg-white px-3 shadow-sm">
                  <span className="text-sm font-black text-zinc-900">₹</span>
                  <input
                    type="number"
                    value={priceXXL}
                    onChange={(e) => setPriceXXL(Number(e.target.value))}
                    className="w-full bg-white text-zinc-950 px-2 py-2 font-black focus:outline-none text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-800">Original MRP (Crossed Out)</label>
                <div className="mt-1 flex items-center rounded-xl border-2 border-zinc-400 bg-white px-3 shadow-sm">
                  <span className="text-sm font-black text-zinc-900">₹</span>
                  <input
                    type="number"
                    value={mrp}
                    onChange={(e) => setMrp(Number(e.target.value))}
                    className="w-full bg-white text-zinc-500 line-through px-2 py-2 font-black focus:outline-none text-base"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-200 border-2 border-zinc-300 px-6 py-2.5 text-sm font-black text-zinc-900 hover:bg-zinc-300 transition"
            >
              <ArrowLeft className="h-4 w-4 stroke-[3]" /> Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black px-8 py-2.5 text-sm shadow-md transition"
            >
              Review & Customize Colours ({productGroups.length} Products) →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Custom Colour / Size Name */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-950">
            <h4 className="font-black text-zinc-950 text-base">Product Title & Colour Review</h4>
            <p className="text-xs font-semibold text-zinc-600 mt-1">
              Check the photos for each product below. Select or type the exact colour so customers can easily see the colour in the product name and filters!
            </p>
          </div>

          <div className="max-h-[500px] space-y-4 overflow-y-auto pr-2">
            {productGroups.map((group, idx) => {
              const currentColour = customColours[idx] || defaultColour;
              const currentTitle = getProductTitle(idx);
              const currentSizes = getProductSizes(idx);
              const productNum = getProductNumber(idx);
              const skuPrefix = `TH-${audience.toUpperCase().slice(0, 3)}-${productType.toUpperCase().slice(0, 3)}-${String(productNum).padStart(3, "0")}`;

              return (
                <div
                  key={idx}
                  className="rounded-2xl border-2 border-zinc-200 bg-white p-4 space-y-3 shadow-sm hover:border-amber-400 transition"
                >
                  <div className="flex items-start gap-4">
                    {/* Photos Preview */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {group.map((file, fIdx) => (
                        <div key={fIdx} className="relative h-16 w-16 rounded-xl overflow-hidden border-2 border-zinc-300 shadow-sm">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="h-full w-full object-cover"
                          />
                          {fIdx === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-amber-400 px-1 text-center text-[8px] font-black text-black">
                              COVER
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Title & Colour Controls */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 text-xs font-black text-white flex-shrink-0">
                          {productNum}
                        </span>
                        <input
                          type="text"
                          value={currentTitle}
                          onChange={(e) =>
                            setCustomTitles((prev) => ({ ...prev, [idx]: e.target.value }))
                          }
                          className="flex-1 rounded-xl border-2 border-zinc-300 bg-white px-3 py-1.5 text-sm font-black text-zinc-950 focus:border-amber-400 focus:outline-none shadow-sm"
                          placeholder="Product Title"
                        />
                      </div>

                      {/* Colour Picker */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-zinc-700">Colour:</span>
                        <select
                          value={currentColour}
                          onChange={(e) => {
                            const newClr = e.target.value;
                            setCustomColours((prev) => ({ ...prev, [idx]: newClr }));
                            const aud = audience === "men" ? "Men's" : audience === "women" ? "Women's" : "";
                            const fit = productType === "oversized" ? "Oversized" : "Regular";
                            setCustomTitles((prev) => ({
                              ...prev,
                              [idx]: `${aud} ${newClr} ${fit} Graphic T-Shirt #${productNum}`,
                            }));
                          }}
                          className="rounded-xl border-2 border-zinc-300 bg-white px-3 py-1.5 text-xs font-black text-zinc-950 focus:border-amber-400 focus:outline-none shadow-sm"
                        >
                          {POPULAR_COLOURS.map((clr) => (
                            <option key={clr} value={clr} className="text-zinc-950 font-bold bg-white">
                              {clr}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={currentColour}
                          onChange={(e) => {
                            const newClr = e.target.value;
                            setCustomColours((prev) => ({ ...prev, [idx]: newClr }));
                            const aud = audience === "men" ? "Men's" : audience === "women" ? "Women's" : "";
                            const fit = productType === "oversized" ? "Oversized" : "Regular";
                            setCustomTitles((prev) => ({
                              ...prev,
                              [idx]: `${aud} ${newClr} ${fit} Graphic T-Shirt #${productNum}`,
                            }));
                          }}
                          placeholder="or type custom colour..."
                          className="w-48 rounded-xl border-2 border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-950 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none shadow-sm"
                        />
                      </div>

                      {/* Sizes for this specific product */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs font-bold text-zinc-700">Sizes Available:</span>
                        {ALL_SIZES.map((size) => {
                          const isAvailable = currentSizes.includes(size);
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => toggleProductSize(idx, size)}
                              className={`rounded-lg px-3 py-1 text-xs font-black transition ${
                                isAvailable
                                  ? "bg-zinc-950 text-white shadow-sm"
                                  : "bg-zinc-100 text-zinc-500 border border-zinc-300 line-through font-bold"
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                        <span className="text-[11px] font-mono font-bold text-zinc-500 ml-2">
                          SKU: {skuPrefix}-[SIZE]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-200 border-2 border-zinc-300 px-6 py-2.5 text-sm font-black text-zinc-900 hover:bg-zinc-300 transition"
            >
              <ArrowLeft className="h-4 w-4 stroke-[3]" /> Back
            </button>
            <button
              type="button"
              onClick={handleStartUpload}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-3 text-sm shadow-md transition"
            >
              <Upload className="h-4 w-4 stroke-[3]" />
              Upload & Publish All {productGroups.length} Products
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Uploading / Complete */}
      {step === 4 && (
        <div className="py-8 text-center space-y-6 text-zinc-950">
          {isUploading && (
            <div className="space-y-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-amber-500" />
              <h3 className="text-xl font-black text-zinc-950">Uploading {files.length} Photos...</h3>
              <p className="text-sm font-bold text-amber-900 bg-amber-50 rounded-xl px-4 py-2 border border-amber-300 max-w-md mx-auto">
                {uploadStatusText}
              </p>
            </div>
          )}

          {uploadError && (
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-5 text-left text-red-900">
              <div className="flex items-center gap-2 font-black text-red-950">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Upload Failed
              </div>
              <p className="mt-2 text-sm font-medium">{uploadError}</p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-xl border-2 border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-zinc-100"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={handleStartUpload}
                  className="rounded-xl bg-amber-400 hover:bg-amber-300 px-5 py-2 text-xs font-black text-black shadow"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 p-6 text-center space-y-4">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <h3 className="text-2xl font-black text-emerald-950">Products Successfully Created!</h3>
              <div className="mx-auto max-w-sm grid grid-cols-3 gap-3 rounded-xl bg-white border-2 border-zinc-200 p-4 shadow-sm text-zinc-950">
                <div>
                  <span className="text-xs font-bold text-zinc-500 uppercase">Products</span>
                  <p className="text-2xl font-black text-black">{uploadResult.productsCreated}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-500 uppercase">Variants</span>
                  <p className="text-2xl font-black text-black">{uploadResult.variantsCreated}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-500 uppercase">Photos</span>
                  <p className="text-2xl font-black text-black">{uploadResult.imagesUploaded}</p>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="mt-3 text-left text-xs text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-300">
                  <span className="font-bold">Notices:</span>
                  <ul className="list-disc pl-4 mt-1">
                    {uploadResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 flex justify-center gap-4">
                <Link
                  href="/admin/products"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-8 py-2.5 text-sm font-black text-black shadow-md transition"
                >
                  View All Products
                </Link>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 px-6 py-2.5 text-sm font-bold text-white shadow-md transition"
                >
                  Upload Another Batch
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
