"use client";

import { Badge, Button } from "@thread/ui";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FolderArchive,
  Layers,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { useAuth } from "@/auth/auth-provider";

// POST large files (ZIPs with photos) directly to the Render backend to bypass
// the Vercel serverless 4.5 MB request body limit on the /api/:path* rewrite proxy.
const DIRECT_API_URL = "https://thread-sfe5.onrender.com/api/v1";

interface ImportPreviewData {
  totalProducts: number;
  detectedColumns: string[];
  standardColumns: string[];
  dynamicColumns: string[];
  categoriesToCreate: Array<{ name: string; slug: string; audience: string; count: number }>;
  existingCategoriesMatched: Array<{ name: string; slug: string; count: number }>;
  sampleProducts: Array<{
    title: string;
    slug: string;
    categoryName: string;
    categorySlug: string;
    audience: string;
    mrp: number;
    salePrice: number;
    sizes: string[];
    colour: string;
    stockPerSize: number;
    dynamicAttributes: Record<string, string>;
  }>;
}

interface ImportExecutionData {
  totalProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  categoriesCreated: Array<{ name: string; slug: string }>;
  dynamicColumnsCatalogued: string[];
  errors: Array<{ item: string; error: string }>;
}

interface ProductImportModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

export function ProductImportModal({ isOpen, onClose, onSuccess }: ProductImportModalProps) {
  const { accessToken, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "executing" | "complete">("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [result, setResult] = useState<ImportExecutionData | null>(null);

  if (!isOpen) return null;

  // Authorization check
  const hasWritePermission = user?.roles?.some((r) =>
    ["super_admin", "admin", "catalog_manager"].includes(r),
  );

  function resetState() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep("upload");
    setError("");
    setLoading(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError("");
    }
  }

  async function handleInspectFile() {
    if (!file || !accessToken) return;
    setLoading(true);
    setError("");

    try {
      // Send directly to Render to bypass Vercel's 4.5 MB proxy cap
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${DIRECT_API_URL}/admin/products/import-preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Server error ${res.status}`);
      }
      const json = (await res.json()) as { success: boolean; data: ImportPreviewData };
      if (!json.success) throw new Error("Unexpected server response");

      setPreview(json.data);
      setStep("preview");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to inspect file. Please verify the archive or spreadsheet format.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteImport() {
    if (!file || !accessToken) return;
    setLoading(true);
    setError("");
    setStep("executing");

    try {
      // Send directly to Render to bypass Vercel's 4.5 MB proxy cap
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${DIRECT_API_URL}/admin/products/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string; code?: string };
        };
        const errorMsg =
          body?.error?.message ??
          (res.status === 504 || res.status === 502
            ? "Gateway Timeout (504/502): The cloud server proxy timed out. Please ensure the backend is active."
            : res.status === 500
              ? "Internal Server Error (500): Database write or cloud media error."
              : `Server error ${res.status}`);
        throw new Error(errorMsg);
      }
      const json = (await res.json()) as { success: boolean; data: ImportExecutionData };
      if (!json.success) throw new Error("Unexpected server response");

      setResult(json.data);
      setStep("complete");
      onSuccess();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Bulk import failed. Check database write permissions.",
      );
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-ink border border-paper/10 text-paper shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-paper/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Automated Catalogue & Inventory Import</h2>
              <p className="text-xs text-paper/60">
                Upload ZIP archive or Excel / CSV spreadsheet to automatically categorize and import
                inventory.
              </p>
            </div>
          </div>
          <button
            className="rounded-md p-1.5 text-paper/60 hover:bg-paper/10 hover:text-paper"
            onClick={handleClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Permission Notice */}
        {!hasWritePermission && (
          <div className="bg-error/20 px-6 py-3 text-sm text-error flex items-center gap-2 border-b border-error/30">
            <AlertCircle className="h-4 w-4 shrink-0" />
            You lack catalog write permissions. Only Administrators or Catalog Managers can import
            inventory.
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-5 rounded-lg border border-error/40 bg-error/15 p-4 text-sm text-error flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Import notice</p>
                <p className="mt-1 opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === "upload" && (
            <div className="space-y-6">
              <div
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
                  dragActive
                    ? "border-accent bg-accent/10"
                    : file
                      ? "border-paper/40 bg-paper/5"
                      : "border-paper/20 hover:border-paper/40 bg-paper/5"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  accept=".zip,.xlsx,.xls,.csv,.json"
                  className="hidden"
                  id="file-upload-input"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  type="file"
                />

                {file ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-accent">
                      {file.name.endsWith(".zip") ? (
                        <FolderArchive className="h-8 w-8" />
                      ) : (
                        <FileSpreadsheet className="h-8 w-8" />
                      )}
                    </div>
                    <p className="text-base font-medium">{file.name}</p>
                    <p className="mt-1 text-xs text-paper/60">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready for analysis
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => fileInputRef.current?.click()}
                      size="sm"
                      variant="outline"
                    >
                      Choose different file
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper/10 text-paper/70">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-base font-medium">Drag & drop your product file here</p>
                    <p className="mt-1 text-xs text-paper/60">
                      Supports ZIP (containing photos + catalog), Excel (.xlsx, .xls), CSV, or JSON
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => fileInputRef.current?.click()}
                      size="sm"
                      variant="outline"
                    >
                      Browse Files
                    </Button>
                  </div>
                )}
              </div>

              {/* Supported capabilities feature callout */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4">
                  <div className="flex items-center gap-2 text-accent">
                    <Layers className="h-4 w-4" />
                    <span className="text-sm font-semibold">Description Classification</span>
                  </div>
                  <p className="mt-2 text-xs text-paper/70 leading-relaxed">
                    Automatically categorizes products by scanning descriptions and titles for fits,
                    fabrics, and audiences.
                  </p>
                </div>
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4">
                  <div className="flex items-center gap-2 text-accent">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-semibold">Auto Category Creation</span>
                  </div>
                  <p className="mt-2 text-xs text-paper/70 leading-relaxed">
                    If an item description specifies a category that does not exist yet, a new
                    category is created in MongoDB automatically.
                  </p>
                </div>
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4">
                  <div className="flex items-center gap-2 text-accent">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-semibold">Dynamic Column Matching</span>
                  </div>
                  <p className="mt-2 text-xs text-paper/70 leading-relaxed">
                    Custom attributes (GSM, Fabric, Sleeve, Wash Care, etc.) are matched and indexed
                    into inventory attributes dynamically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & ANALYSIS */}
          {step === "preview" && preview && (
            <div className="space-y-6">
              {/* Metric Highlights */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4">
                  <p className="text-xs text-paper/60">Total Products Found</p>
                  <p className="mt-1 text-2xl font-bold">{preview.totalProducts}</p>
                </div>
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4">
                  <p className="text-xs text-paper/60">Standard Columns Matched</p>
                  <p className="mt-1 text-2xl font-bold text-accent">
                    {preview.standardColumns.length}
                  </p>
                </div>
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4">
                  <p className="text-xs text-paper/60">Dynamic Attributes Detected</p>
                  <p className="mt-1 text-2xl font-bold text-amber-400">
                    {preview.dynamicColumns.length}
                  </p>
                </div>
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4">
                  <p className="text-xs text-paper/60">New Categories to Create</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-400">
                    {preview.categoriesToCreate.length}
                  </p>
                </div>
              </div>

              {/* Dynamic Columns Notice */}
              {preview.dynamicColumns.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                  <p className="font-semibold text-sm text-amber-300">
                    New Columns Detected from Description/File:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {preview.dynamicColumns.map((col) => (
                      <Badge
                        key={col}
                        variant="neutral"
                        className="border-amber-400/40 text-amber-300"
                      >
                        {col}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-amber-200/80">
                    These will be registered as dynamic inventory columns on all imported variants.
                  </p>
                </div>
              )}

              {/* Category Breakdown */}
              <div className="rounded-lg border border-paper/10 bg-paper/5 p-4">
                <p className="text-sm font-semibold mb-3">Description-Based Category Placement:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Existing Matched */}
                  <div>
                    <span className="text-paper/60 uppercase font-medium">
                      Existing Categories Matched:
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {preview.existingCategoriesMatched.length > 0 ? (
                        preview.existingCategoriesMatched.map((c) => (
                          <div
                            key={c.slug}
                            className="flex justify-between items-center bg-paper/5 px-2.5 py-1.5 rounded"
                          >
                            <span>
                              {c.name} ({c.slug})
                            </span>
                            <span className="font-semibold text-accent">{c.count} items</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-paper/40 italic">None</p>
                      )}
                    </div>
                  </div>
                  {/* New To Create */}
                  <div>
                    <span className="text-emerald-400 uppercase font-medium">
                      + New Categories to Auto-Create:
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {preview.categoriesToCreate.length > 0 ? (
                        preview.categoriesToCreate.map((c) => (
                          <div
                            key={c.slug}
                            className="flex justify-between items-center bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-1.5 rounded text-emerald-300"
                          >
                            <span>
                              {c.name} ({c.audience})
                            </span>
                            <span className="font-bold">{c.count} items</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-paper/40 italic">
                          All items matched existing categories
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample Rows Table */}
              <div>
                <p className="text-sm font-semibold mb-2">
                  Sample Product Preview (First {preview.sampleProducts.length} Items):
                </p>
                <div className="overflow-x-auto rounded-lg border border-paper/10 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-paper/10 text-paper/70">
                      <tr>
                        <th className="p-2.5">Title</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Audience</th>
                        <th className="p-2.5">Price</th>
                        <th className="p-2.5">Sizes</th>
                        <th className="p-2.5">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paper/5">
                      {preview.sampleProducts.map((p) => (
                        <tr key={p.slug} className="hover:bg-paper/5">
                          <td className="p-2.5 font-medium">{p.title}</td>
                          <td className="p-2.5 text-accent">{p.categoryName}</td>
                          <td className="p-2.5 capitalize">{p.audience}</td>
                          <td className="p-2.5 font-mono">
                            ₹{p.salePrice}{" "}
                            <span className="line-through text-paper/40 text-[10px]">₹{p.mrp}</span>
                          </td>
                          <td className="p-2.5">{p.sizes.join(", ")}</td>
                          <td className="p-2.5">{p.stockPerSize} / size</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EXECUTING */}
          {step === "executing" && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-paper/20 border-t-accent" />
              <h3 className="text-lg font-semibold">Processing & Placing Inventory...</h3>
              <p className="text-sm text-paper/60 max-w-md">
                Analyzing descriptions, generating size matrices, cataloguing dynamic columns, and
                populating database records. Please do not refresh.
              </p>
            </div>
          )}

          {/* STEP 4: COMPLETE */}
          {step === "complete" && result && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-4">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold text-emerald-400">
                  Import Completed Successfully!
                </h3>
                <p className="mt-1 text-sm text-paper/70">
                  {result.totalProcessed} inventory items have been placed into the THREAD
                  catalogue.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4 text-center">
                  <p className="text-xs text-paper/60">Products Created</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {result.productsCreated}
                  </p>
                </div>
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4 text-center">
                  <p className="text-xs text-paper/60">Products Updated</p>
                  <p className="text-2xl font-bold text-accent mt-1">{result.productsUpdated}</p>
                </div>
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4 text-center">
                  <p className="text-xs text-paper/60">Variants Generated</p>
                  <p className="text-2xl font-bold text-paper mt-1">{result.variantsCreated}</p>
                </div>
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4 text-center">
                  <p className="text-xs text-paper/60">Categories Created</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">
                    {result.categoriesCreated.length}
                  </p>
                </div>
              </div>

              {result.categoriesCreated.length > 0 && (
                <div className="rounded-lg border border-paper/10 bg-paper/5 p-4 text-xs">
                  <p className="font-semibold text-paper/80 mb-2">
                    New Categories Added from Descriptions:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.categoriesCreated.map((c) => (
                      <Badge
                        key={c.slug}
                        variant="neutral"
                        className="border-emerald-500/40 text-emerald-300"
                      >
                        + {c.name} ({c.slug})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-paper/10 bg-paper/5 px-6 py-4">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={loading && step === "executing"}
          >
            {step === "complete" ? "Close" : "Cancel"}
          </Button>

          <div className="flex items-center gap-3">
            {step === "upload" && (
              <Button
                disabled={!file || loading || !hasWritePermission}
                onClick={handleInspectFile}
              >
                {loading ? "Analyzing..." : "Inspect & Match Columns"}
              </Button>
            )}

            {step === "preview" && (
              <>
                <Button onClick={() => setStep("upload")} variant="outline">
                  Back
                </Button>
                <Button disabled={loading || !hasWritePermission} onClick={handleExecuteImport}>
                  {loading
                    ? "Starting Import..."
                    : `Run Automated Import (${preview?.totalProducts} Items)`}
                </Button>
              </>
            )}

            {step === "complete" && <Button onClick={handleClose}>View Products</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
