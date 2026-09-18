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

  // Pricing (in Rupees)
  const [priceSM, setPriceSM] = useState<number>(549);
  const [priceLXL, setPriceLXL] = useState<number>(599);
  const [priceXXL, setPriceXXL] = useState<number>(649);
  const [mrp, setMrp] = useState<number>(899);
  const [stockPerSize, setStockPerSize] = useState<number>(25);

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

      {/* STEP 2: Product Settings */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Photos per Product */}
            <div className="rounded-lg border border-ink/10 p-4">
              <label className="block text-sm font-bold">Photos per Product</label>
              <p className="mb-3 text-xs text-paper/60">
                How many photos belong to each t-shirt design?
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={imagesPerProduct}
                  onChange={(e) => setImagesPerProduct(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded border border-ink/20 px-3 py-2 text-center text-lg font-bold"
                />
                <span className="text-sm text-paper/60">
                  photos per product = <strong>{productGroups.length} products</strong>
                </span>
              </div>
            </div>

            {/* Target Audience */}
            <div className="rounded-lg border border-ink/10 p-4">
              <label className="block text-sm font-bold">Target Audience</label>
              <p className="mb-3 text-xs text-paper/60">Who is this batch for?</p>
              <div className="flex gap-2">
                {(["men", "women", "unisex"] as const).map((aud) => (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setAudience(aud)}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize transition ${
                      audience === aud
                        ? "bg-ink text-paper shadow-sm"
                        : "border border-ink/15 hover:bg-ink/5"
                    }`}
                  >
                    {aud === "men" ? "Men's" : aud === "women" ? "Women's" : "Unisex"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="rounded-lg border border-ink/10 p-4">
              <label className="block text-sm font-bold">Category</label>
              <p className="mb-3 text-xs text-paper/60">Select category for listing</p>
              <div className="flex gap-2">
                {[
                  { slug: "oversized-t-shirts", label: "Oversized T-Shirts" },
                  { slug: "classic-fit-t-shirts", label: "Classic Fit" },
                ].map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => {
                      setCategory(cat.slug as any);
                      setProductType(cat.slug === "oversized-t-shirts" ? "oversized" : "regular");
                    }}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                      category === cat.slug
                        ? "bg-ink text-paper"
                        : "border border-ink/15 hover:bg-ink/5"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock per variant */}
            <div className="rounded-lg border border-ink/10 p-4">
              <label className="block text-sm font-bold">Stock per Size</label>
              <p className="mb-3 text-xs text-paper/60">Initial quantity for each size (S, M, L, XL, 2XL)</p>
              <input
                type="number"
                min={1}
                value={stockPerSize}
                onChange={(e) => setStockPerSize(Math.max(1, Number(e.target.value)))}
                className="w-full rounded border border-ink/20 px-3 py-2 font-bold"
              />
            </div>
          </div>

          {/* Size-Based Pricing Section */}
          <div className="rounded-lg border-2 border-ink/20 bg-ink/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold">Size-Based Selling Prices (₹)</h4>
                <p className="text-xs text-paper/60">
                  Configured according to your rules: S/M = ₹549, L/XL = ₹599, 2XL = ₹649
                </p>
              </div>
              <Badge variant="neutral">Rupees</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-bold text-paper/70">Sizes S & M</label>
                <div className="mt-1 flex items-center rounded border border-ink/20 bg-paper px-2">
                  <span className="text-sm font-bold text-paper/40">₹</span>
                  <input
                    type="number"
                    value={priceSM}
                    onChange={(e) => setPriceSM(Number(e.target.value))}
                    className="w-full bg-transparent px-2 py-2 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-paper/70">Sizes L & XL</label>
                <div className="mt-1 flex items-center rounded border border-ink/20 bg-paper px-2">
                  <span className="text-sm font-bold text-paper/40">₹</span>
                  <input
                    type="number"
                    value={priceLXL}
                    onChange={(e) => setPriceLXL(Number(e.target.value))}
                    className="w-full bg-transparent px-2 py-2 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-paper/70">Size 2XL</label>
                <div className="mt-1 flex items-center rounded border border-ink/20 bg-paper px-2">
                  <span className="text-sm font-bold text-paper/40">₹</span>
                  <input
                    type="number"
                    value={priceXXL}
                    onChange={(e) => setPriceXXL(Number(e.target.value))}
                    className="w-full bg-transparent px-2 py-2 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-paper/70">Original MRP (Crossed Out)</label>
                <div className="mt-1 flex items-center rounded border border-ink/20 bg-paper px-2">
                  <span className="text-sm font-bold text-paper/40">₹</span>
                  <input
                    type="number"
                    value={mrp}
                    onChange={(e) => setMrp(Number(e.target.value))}
                    className="w-full bg-transparent px-2 py-2 font-bold text-paper/60 line-through focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={() => setStep(3)} className="px-6">
              Review {productGroups.length} Products
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4 text-sm">
            <h4 className="font-bold">Batch Summary</h4>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <span className="text-xs text-paper/60">Total Products:</span>
                <p className="font-bold">{productGroups.length}</p>
              </div>
              <div>
                <span className="text-xs text-paper/60">Category:</span>
                <p className="font-bold capitalize">{category.replace(/-/g, " ")}</p>
              </div>
              <div>
                <span className="text-xs text-paper/60">Audience:</span>
                <p className="font-bold capitalize">{audience}</p>
              </div>
              <div>
                <span className="text-xs text-paper/60">Pricing:</span>
                <p className="font-bold">₹{priceSM} - ₹{priceXXL}</p>
              </div>
            </div>
          </div>

          <h4 className="font-bold">Products to be Created ({productGroups.length})</h4>
          <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
            {productGroups.map((group, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 rounded-lg border border-ink/10 p-3"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ink/10 font-black">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold truncate">
                    {audience === "men" ? "Men's" : audience === "women" ? "Women's" : ""}{" "}
                    {productType === "oversized" ? "Oversized" : "Regular"} Graphic T-Shirt #{idx + 1}
                  </h5>
                  <p className="text-xs text-paper/60">
                    {group.length} photos ({group.map((f) => f.name).join(", ")})
                  </p>
                </div>
                <div className="flex gap-1">
                  {group.map((file, fIdx) => (
                    <img
                      key={fIdx}
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-12 w-12 rounded object-cover border border-ink/10"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={handleStartUpload} className="px-6 flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload All {productGroups.length} Products
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
