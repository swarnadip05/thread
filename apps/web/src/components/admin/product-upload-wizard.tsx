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
import React, { useMemo, useRef, useState } from "react";
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
  "Sage Green",
  "Olive Green",
  "Vintage Black",
  "Off-White / Cream",
  "Charcoal Grey",
  "Beige / Sand",
  "Mocha Brown",
  "Maroon",
  "Cobalt Blue",
  "Lavender Purple",
  "Pure White",
  "Navy Blue",
];

const ALL_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

export function ProductUploadWizard() {
  const { accessToken } = useAuth();

  // Wizard step: 1 = select, 2 = settings, 3 = review, 4 = uploading/done
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Selected files
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [audience, setAudience] = useState<"men" | "women" | "unisex">("men");
  const [category, setCategory] = useState<"oversized-t-shirts" | "classic-fit-t-shirts">("oversized-t-shirts");
  const [productType, setProductType] = useState<"oversized" | "regular">("oversized");
  const [imagesPerProduct, setImagesPerProduct] = useState<number>(5);
  const [defaultColour, setDefaultColour] = useState<string>("Sage Green");

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
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    return `${aud} ${clr} ${fit} Graphic T-Shirt #${index + 1}`.trim();
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

    try {
      const formData = new FormData();
      for (const file of sortedFiles) {
        formData.append("files", file);
      }
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
    <div className="rounded-xl border border-ink/10 bg-paper p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <div>
          <h2 className="text-2xl font-bold">Product Photo Upload Wizard</h2>
          <p className="text-sm text-paper/60">
            Upload a folder of photos, group them per product, and set size pricing automatically.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/products">Back to Products</Link>
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 grid grid-cols-4 gap-2 text-center text-xs font-semibold sm:text-sm">
        <div
          className={`rounded-lg py-2 ${
            step === 1 ? "bg-ink text-paper" : step > 1 ? "bg-ink/10 text-ink" : "bg-ink/5 text-ink/40"
          }`}
        >
          1. Select Photos
        </div>
        <div
          className={`rounded-lg py-2 ${
            step === 2 ? "bg-ink text-paper" : step > 2 ? "bg-ink/10 text-ink" : "bg-ink/5 text-ink/40"
          }`}
        >
          2. Category & Prices
        </div>
        <div
          className={`rounded-lg py-2 ${
            step === 3 ? "bg-ink text-paper" : step > 3 ? "bg-ink/10 text-ink" : "bg-ink/5 text-ink/40"
          }`}
        >
          3. Preview
        </div>
        <div
          className={`rounded-lg py-2 ${
            step === 4 ? "bg-ink text-paper" : "bg-ink/5 text-ink/40"
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
            className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink/20 bg-ink/[0.02] p-8 text-center transition hover:border-ink/40 hover:bg-ink/[0.04]"
          >
            <FolderUp className="mb-3 h-12 w-12 text-ink/40" />
            <h3 className="text-lg font-semibold">Drop your product photos here</h3>
            <p className="mt-1 text-sm text-paper/60">
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
                <span className="font-semibold">{files.length} photos selected</span>
                <Button variant="outline" size="sm" onClick={() => setFiles([])}>
                  Clear all
                </Button>
              </div>

              <div className="grid max-h-[300px] grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-ink/10 p-2 sm:grid-cols-6 md:grid-cols-8">
                {sortedFiles.map((file, idx) => (
                  <div key={idx} className="group relative aspect-square rounded bg-ink/5 overflow-hidden">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[9px] text-white truncate">
                      {idx + 1}. {file.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={files.length === 0}
              onClick={() => setStep(2)}
              className="px-6"
            >
              Continue to Settings ({files.length} Photos)
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Product Settings & Sizes */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Quick Size Selection Buttons */}
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-5">
            <div className="mb-3">
              <h4 className="text-base font-black text-zinc-900">
                ⚡ Quick Size Selection (Click to choose which sizes are available)
              </h4>
              <p className="text-xs font-medium text-zinc-600">
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
                        ? "bg-zinc-900 text-white ring-2 ring-amber-400"
                        : "bg-white text-zinc-400 border border-zinc-300 hover:bg-zinc-100"
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Square className="h-4 w-4 text-zinc-300" />
                    )}
                    <span>Size {size}</span>
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-xs text-amber-700">
                      ₹{price}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Photos per Product */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <label className="block text-sm font-black text-zinc-900">Photos per Product</label>
              <p className="mb-3 text-xs font-medium text-zinc-600">
                How many photos belong to each t-shirt design?
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={imagesPerProduct}
                  onChange={(e) => setImagesPerProduct(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-center text-lg font-black"
                />
                <span className="text-sm font-bold text-zinc-700">
                  photos per product = <strong>{productGroups.length} products</strong>
                </span>
              </div>
            </div>

            {/* Target Audience */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <label className="block text-sm font-black text-zinc-900">Target Audience</label>
              <p className="mb-3 text-xs font-medium text-zinc-600">Who is this batch for?</p>
              <div className="flex gap-2">
                {(["men", "women", "unisex"] as const).map((aud) => (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setAudience(aud)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-black capitalize transition ${
                      audience === aud
                        ? "bg-zinc-950 text-white shadow-md"
                        : "border border-zinc-300 bg-white hover:bg-zinc-100"
                    }`}
                  >
                    {aud === "men" ? "Men's" : aud === "women" ? "Women's" : "Unisex"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category & Fit */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <label className="block text-sm font-black text-zinc-900">Category & Fit</label>
              <p className="mb-3 text-xs font-medium text-zinc-600">Select fit category</p>
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
                    className={`flex-1 rounded-xl py-2.5 text-xs font-black transition ${
                      category === cat.slug
                        ? "bg-zinc-950 text-white shadow-md"
                        : "border border-zinc-300 bg-white hover:bg-zinc-100"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Colour */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <label className="block text-sm font-black text-zinc-900">Default T-Shirt Colour</label>
              <p className="mb-3 text-xs font-medium text-zinc-600">Named into title & description automatically</p>
              <div className="flex gap-2">
                <select
                  value={defaultColour}
                  onChange={(e) => setDefaultColour(e.target.value)}
                  className="w-full rounded-lg border-2 border-zinc-300 bg-white px-3 py-2 text-sm font-bold"
                >
                  {POPULAR_COLOURS.map((clr) => (
                    <option key={clr} value={clr}>
                      {clr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Size-Based Pricing Section */}
          <div className="rounded-xl border-2 border-zinc-300 bg-zinc-50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-base font-black text-zinc-900">Size-Based Selling Prices (₹)</h4>
                <p className="text-xs font-medium text-zinc-600">
                  Configured according to your rules: S & M = ₹549, L & XL = ₹599, 2XL = ₹649
                </p>
              </div>
              <Badge variant="neutral">Rupees</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-black text-zinc-700">Sizes S & M</label>
                <div className="mt-1 flex items-center rounded-lg border-2 border-zinc-300 bg-white px-3">
                  <span className="text-sm font-black text-zinc-500">₹</span>
                  <input
                    type="number"
                    value={priceSM}
                    onChange={(e) => setPriceSM(Number(e.target.value))}
                    className="w-full bg-transparent px-2 py-2 font-black focus:outline-none text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700">Sizes L & XL</label>
                <div className="mt-1 flex items-center rounded-lg border-2 border-zinc-300 bg-white px-3">
                  <span className="text-sm font-black text-zinc-500">₹</span>
                  <input
                    type="number"
                    value={priceLXL}
                    onChange={(e) => setPriceLXL(Number(e.target.value))}
                    className="w-full bg-transparent px-2 py-2 font-black focus:outline-none text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700">Size 2XL</label>
                <div className="mt-1 flex items-center rounded-lg border-2 border-zinc-300 bg-white px-3">
                  <span className="text-sm font-black text-zinc-500">₹</span>
                  <input
                    type="number"
                    value={priceXXL}
                    onChange={(e) => setPriceXXL(Number(e.target.value))}
                    className="w-full bg-transparent px-2 py-2 font-black focus:outline-none text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700">Original MRP (Crossed Out)</label>
                <div className="mt-1 flex items-center rounded-lg border-2 border-zinc-300 bg-white px-3">
                  <span className="text-sm font-black text-zinc-500">₹</span>
                  <input
                    type="number"
                    value={mrp}
                    onChange={(e) => setMrp(Number(e.target.value))}
                    className="w-full bg-transparent px-2 py-2 font-black text-zinc-400 line-through focus:outline-none text-base"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="flex items-center gap-2 font-bold border-zinc-300">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={() => setStep(3)} className="bg-amber-400 font-black text-black hover:bg-amber-300 px-8 shadow-md">
              Review & Customize Colours ({productGroups.length} Products)
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Custom Colour / Size Name */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <h4 className="font-black text-zinc-900">Product Title & Colour Review</h4>
            <p className="text-xs text-zinc-600 mt-1">
              Check the photos for each product below. Select or type the exact colour so customers can easily see the colour in the product name and filters!
            </p>
          </div>

          <div className="max-h-[500px] space-y-4 overflow-y-auto pr-2">
            {productGroups.map((group, idx) => {
              const currentColour = customColours[idx] || defaultColour;
              const currentTitle = getProductTitle(idx);
              const currentSizes = getProductSizes(idx);
              const skuPrefix = `TH-${audience.toUpperCase().slice(0, 3)}-${productType.toUpperCase().slice(0, 3)}-${String(idx + 1).padStart(2, "0")}`;

              return (
                <div
                  key={idx}
                  className="rounded-2xl border-2 border-zinc-200 bg-white p-4 space-y-3 shadow-sm hover:border-amber-400 transition"
                >
                  <div className="flex items-start gap-4">
                    {/* Photos Preview */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {group.map((file, fIdx) => (
                        <div key={fIdx} className="relative h-16 w-16 rounded-xl overflow-hidden border border-zinc-300 shadow-sm">
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
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-black text-white">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={currentTitle}
                          onChange={(e) =>
                            setCustomTitles((prev) => ({ ...prev, [idx]: e.target.value }))
                          }
                          className="flex-1 rounded-lg border-2 border-zinc-300 px-3 py-1.5 text-sm font-black text-zinc-900 focus:border-amber-400 focus:outline-none"
                          placeholder="Product Title"
                        />
                      </div>

                      {/* Colour Picker */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500">Colour:</span>
                        <select
                          value={currentColour}
                          onChange={(e) => {
                            const newClr = e.target.value;
                            setCustomColours((prev) => ({ ...prev, [idx]: newClr }));
                            const aud = audience === "men" ? "Men's" : audience === "women" ? "Women's" : "";
                            const fit = productType === "oversized" ? "Oversized" : "Regular";
                            setCustomTitles((prev) => ({
                              ...prev,
                              [idx]: `${aud} ${newClr} ${fit} Graphic T-Shirt #${idx + 1}`,
                            }));
                          }}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-bold text-zinc-900"
                        >
                          {POPULAR_COLOURS.map((clr) => (
                            <option key={clr} value={clr}>
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
                              [idx]: `${aud} ${newClr} ${fit} Graphic T-Shirt #${idx + 1}`,
                            }));
                          }}
                          placeholder="or type custom colour..."
                          className="w-40 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium"
                        />
                      </div>

                      {/* Sizes for this specific product */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs font-bold text-zinc-500">Sizes Available:</span>
                        {ALL_SIZES.map((size) => {
                          const isAvailable = currentSizes.includes(size);
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => toggleProductSize(idx, size)}
                              className={`rounded-md px-2.5 py-1 text-xs font-black transition ${
                                isAvailable
                                  ? "bg-zinc-900 text-white shadow-sm"
                                  : "bg-zinc-100 text-zinc-400 line-through"
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                        <span className="text-[11px] font-mono text-zinc-400 ml-2">
                          SKU: {skuPrefix}-[SIZE]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="flex items-center gap-2 font-bold border-zinc-300">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={handleStartUpload} className="bg-amber-400 font-black text-black hover:bg-amber-300 px-8 min-h-12 shadow-md flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload & Publish All {productGroups.length} Products
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Uploading / Complete */}
      {step === 4 && (
        <div className="py-8 text-center space-y-6">
          {isUploading && (
            <div className="space-y-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-ink" />
              <h3 className="text-xl font-bold">Uploading {files.length} Photos...</h3>
              <p className="text-sm text-paper/60">
                Photos are being uploaded to Cloudinary and products are being created with size-based pricing.
                Please wait a moment.
              </p>
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-left text-red-600">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-5 w-5" />
                Upload Failed
              </div>
              <p className="mt-2 text-sm">{uploadError}</p>
              <div className="mt-4 flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Go Back
                </Button>
                <Button onClick={handleStartUpload}>Try Again</Button>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center space-y-4">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
              <h3 className="text-2xl font-bold text-green-800">Products Successfully Created!</h3>
              <div className="mx-auto max-w-sm grid grid-cols-3 gap-3 rounded-lg bg-paper p-3 text-ink">
                <div>
                  <span className="text-xs text-paper/60">Products</span>
                  <p className="text-xl font-black">{uploadResult.productsCreated}</p>
                </div>
                <div>
                  <span className="text-xs text-paper/60">Variants</span>
                  <p className="text-xl font-black">{uploadResult.variantsCreated}</p>
                </div>
                <div>
                  <span className="text-xs text-paper/60">Photos</span>
                  <p className="text-xl font-black">{uploadResult.imagesUploaded}</p>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="mt-3 text-left text-xs text-amber-700">
                  <span className="font-semibold">Notices:</span>
                  <ul className="list-disc pl-4">
                    {uploadResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 flex justify-center gap-4">
                <Button asChild>
                  <Link href="/admin/products">View All Products</Link>
                </Button>
                <Button variant="outline" onClick={resetWizard}>
                  Upload Another Batch
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
