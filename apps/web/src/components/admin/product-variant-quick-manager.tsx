"use client";

import type { AdminProductDto } from "@thread/types";
import { AlertCircle, Check, Loader2, Sparkles, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

export const POPULAR_COLOURS = [
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
] as const;

export const ALL_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

interface Props {
  product: AdminProductDto;
  onSuccess: () => void;
  onCancel?: () => void;
  isInitialSetup?: boolean;
}

export function ProductVariantQuickManager({
  product,
  onSuccess,
  onCancel,
  isInitialSetup = false,
}: Props) {
  const { accessToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Product metadata
  const [audience, setAudience] = useState<"men" | "women" | "unisex">(
    product.audience === "women" ? "women" : product.audience === "unisex" ? "unisex" : "men",
  );
  const [fit, setFit] = useState<string>(product.fit || "Oversized");

  // Determine initial colour
  const initialColour = useMemo(() => {
    if (product.variants && product.variants.length > 0 && product.variants[0]?.colour) {
      return product.variants[0].colour;
    }
    for (const c of POPULAR_COLOURS) {
      if (product.title.toLowerCase().includes(c.toLowerCase())) return c;
    }
    return "Sage Green";
  }, [product]);

  const [selectedColour, setSelectedColour] = useState<string>(initialColour);
  const [customColour, setCustomColour] = useState<string>("");
  const [isCustomColour, setIsCustomColour] = useState<boolean>(
    !POPULAR_COLOURS.includes(initialColour as any),
  );

  const effectiveColour = isCustomColour ? (customColour || "Custom") : selectedColour;

  // Title state
  const [title, setTitle] = useState<string>(product.title);

  // Variant mappings
  const existingVariantMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const v of product.variants || []) {
      map.set(v.size.toUpperCase(), v);
    }
    return map;
  }, [product.variants]);

  // Active sizes selection
  const [activeSizes, setActiveSizes] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const sz of ALL_SIZES) {
      init[sz] = existingVariantMap.size > 0 ? existingVariantMap.has(sz) : true;
    }
    return init;
  });

  // Prices per size (in Rupees)
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const sz of ALL_SIZES) {
      const ex = existingVariantMap.get(sz);
      if (ex) {
        init[sz] = Math.round(ex.salePricePaise / 100);
      } else {
        init[sz] = sz === "S" || sz === "M" ? 549 : sz === "2XL" ? 649 : 599;
      }
    }
    return init;
  });

  // MRPs per size (in Rupees)
  const [mrps, setMrps] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const sz of ALL_SIZES) {
      const ex = existingVariantMap.get(sz);
      init[sz] = ex ? Math.round(ex.mrpPaise / 100) : 899;
    }
    return init;
  });

  // Stock counts
  const [stockCounts, setStockCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const sz of ALL_SIZES) {
      const ex = existingVariantMap.get(sz);
      init[sz] = ex ? ex.stockOnHand : 25;
    }
    return init;
  });

  // Availability surety toggle
  const [inStockMap, setInStockMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const sz of ALL_SIZES) {
      const ex = existingVariantMap.get(sz);
      init[sz] = ex ? ex.stockOnHand > 0 && ex.status === "active" : true;
    }
    return init;
  });

  function toggleSize(sz: string) {
    setActiveSizes((prev) => ({ ...prev, [sz]: !prev[sz] }));
  }

  function selectAllSizes() {
    const next: Record<string, boolean> = {};
    for (const sz of ALL_SIZES) next[sz] = true;
    setActiveSizes(next);
  }

  function toggleInStock(sz: string) {
    setInStockMap((prev) => {
      const nextVal = !prev[sz];
      if (nextVal && (stockCounts[sz] || 0) === 0) {
        setStockCounts((s) => ({ ...s, [sz]: 25 }));
      }
      return { ...prev, [sz]: nextVal };
    });
  }

  function handleAutoName(clr = effectiveColour, aud = audience, f = fit) {
    const audPrefix = aud === "women" ? "Women's" : aud === "unisex" ? "Unisex" : "Men's";
    const fitLabel = f === "Regular" ? "Classic Fit" : f;
    const matchNum = product.title.match(/#(\d+)/);
    const numPart = matchNum ? ` #${matchNum[1]}` : "";
    setTitle(`${audPrefix} ${clr} ${fitLabel} Graphic T-Shirt${numPart}`);
  }

  async function handleSave() {
    if (!accessToken) return;
    const selectedList = ALL_SIZES.filter((sz) => activeSizes[sz]);
    if (selectedList.length === 0) {
      setError("Please select at least one size variant (e.g. S, M, L, XL, 2XL).");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const variantItems = selectedList.map((sz) => ({
        size: sz,
        salePrice: prices[sz] || (sz === "S" || sz === "M" ? 549 : sz === "2XL" ? 649 : 599),
        mrp: mrps[sz] || 899,
        stock: inStockMap[sz] ? Math.max(1, stockCounts[sz] || 25) : 0,
        isAvailable: inStockMap[sz],
      }));

      await apiRequest(`/admin/products/${product.id}/quick-variants`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          title,
          colour: effectiveColour,
          audience,
          fit,
          variantItems,
        }),
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save variants.");
    } finally {
      setSaving(false);
    }
  }

  const skuBase = `TH-${(audience === "women" ? "WMN" : "MEN")}-${(fit.slice(0, 3)).toUpperCase()}`;

  return (
    <div className="space-y-4 rounded-xl border-2 border-zinc-300 bg-zinc-50 p-4 text-zinc-950 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <div>
          <h4 className="text-sm font-black uppercase tracking-wider text-zinc-800">
            {isInitialSetup ? "⚡ Quick Setup: Add Sizes, Prices & Stock" : "⚙ Edit Product Sizes, Prices & Colour"}
          </h4>
          <p className="text-xs text-zinc-600">
            Select available sizes, set sale prices (S/M: ₹549, L/XL: ₹599, 2XL: ₹649), and toggle stock surety.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200 hover:text-black"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Row 1: Product Title, Colour, Audience & Fit */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Colour Picker */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 mb-1">
            Visual Colour:
          </label>
          {isCustomColour ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customColour}
                onChange={(e) => {
                  setCustomColour(e.target.value);
                  handleAutoName(e.target.value, audience, fit);
                }}
                placeholder="e.g. Sage Green, Charcoal"
                className="h-9 w-full rounded-lg border-2 border-zinc-300 bg-white px-2.5 text-xs font-bold text-black focus:border-amber-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setIsCustomColour(false);
                  setSelectedColour(POPULAR_COLOURS[0]);
                  handleAutoName(POPULAR_COLOURS[0], audience, fit);
                }}
                className="h-9 px-2 rounded-lg bg-zinc-200 text-xs font-bold hover:bg-zinc-300"
                title="Select from popular colours list"
              >
                List
              </button>
            </div>
          ) : (
            <select
              value={selectedColour}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setIsCustomColour(true);
                  setCustomColour("");
                } else {
                  setSelectedColour(e.target.value);
                  handleAutoName(e.target.value, audience, fit);
                }
              }}
              className="h-9 w-full rounded-lg border-2 border-zinc-300 bg-white px-2.5 text-xs font-bold text-black focus:border-amber-400 focus:outline-none"
            >
              {POPULAR_COLOURS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__custom__">✏️ Custom colour (type)...</option>
            </select>
          )}
        </div>

        {/* Audience / Gender */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 mb-1">
            Audience:
          </label>
          <select
            value={audience}
            onChange={(e) => {
              const aud = e.target.value as "men" | "women" | "unisex";
              setAudience(aud);
              handleAutoName(effectiveColour, aud, fit);
            }}
            className="h-9 w-full rounded-lg border-2 border-zinc-300 bg-white px-2.5 text-xs font-bold text-black focus:border-amber-400 focus:outline-none"
          >
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>

        {/* Fit */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 mb-1">
            Fit:
          </label>
          <select
            value={fit}
            onChange={(e) => {
              setFit(e.target.value);
              handleAutoName(effectiveColour, audience, e.target.value);
            }}
            className="h-9 w-full rounded-lg border-2 border-zinc-300 bg-white px-2.5 text-xs font-bold text-black focus:border-amber-400 focus:outline-none"
          >
            <option value="Oversized">Oversized (Streetwear)</option>
            <option value="Regular">Classic / Regular Fit</option>
            <option value="Relaxed">Relaxed Fit</option>
          </select>
        </div>

        {/* Product Title with Auto-Name button */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-zinc-700">Product Title:</label>
            <button
              type="button"
              onClick={() => handleAutoName()}
              className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800"
              title="Automatically name product from colour, audience and fit"
            >
              <Sparkles className="h-3 w-3" /> Auto-Name
            </button>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 w-full rounded-lg border-2 border-zinc-300 bg-white px-2.5 text-xs font-bold text-black focus:border-amber-400 focus:outline-none"
            placeholder="e.g. Men's Sage Green Oversized Graphic T-Shirt"
          />
        </div>
      </div>

      {/* Row 2: Quick Size Variant Selector Buttons */}
      <div className="space-y-2 rounded-xl bg-white p-3 border border-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-800">
            Quick Size Variant Selector (Click to toggle on/off):
          </span>
          <button
            type="button"
            onClick={selectAllSizes}
            className="rounded bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200"
          >
            ✓ Select All 5 Sizes (S to 2XL)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ALL_SIZES.map((sz) => {
            const active = !!activeSizes[sz];
            const price = prices[sz] || (sz === "S" || sz === "M" ? 549 : sz === "2XL" ? 649 : 599);
            return (
              <button
                key={sz}
                type="button"
                onClick={() => toggleSize(sz)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition shadow-sm ${
                  active
                    ? "bg-zinc-900 text-amber-400 border-2 border-amber-400 hover:bg-black"
                    : "bg-zinc-100 text-zinc-400 border-2 border-zinc-200 hover:border-zinc-300 hover:text-zinc-600"
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black">
                  {active ? "✓" : "+"}
                </span>
                <span className="text-sm">{sz}</span>
                <span className="text-[11px] font-bold opacity-90">
                  ₹{price}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: Granular Variant Price & Stock Surety Grid */}
      <div className="space-y-2">
        <span className="text-xs font-black uppercase tracking-wider text-zinc-700">
          Sizes Configuration & Stock Surety:
        </span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {ALL_SIZES.filter((sz) => activeSizes[sz]).map((sz) => {
            const inStock = !!inStockMap[sz];
            const sku = `${skuBase}-${sz}`;

            return (
              <div
                key={sz}
                className={`rounded-xl border-2 p-3 space-y-2.5 transition shadow-sm ${
                  inStock
                    ? "border-emerald-300 bg-white"
                    : "border-rose-200 bg-rose-50/50"
                }`}
              >
                {/* Size Badge & SKU */}
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 font-black text-white text-sm">
                    {sz}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-zinc-500 truncate" title={sku}>
                    {sku}
                  </span>
                </div>

                {/* Price input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600">
                    Sale Price (₹):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prices[sz] ?? 549}
                    onChange={(e) =>
                      setPrices((prev) => ({
                        ...prev,
                        [sz]: Math.max(1, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 w-full rounded-lg border-2 border-zinc-300 bg-white px-2 text-xs font-black text-black focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* MRP input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600">
                    MRP (₹):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={mrps[sz] ?? 899}
                    onChange={(e) =>
                      setMrps((prev) => ({
                        ...prev,
                        [sz]: Math.max(1, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs font-bold text-zinc-700 focus:outline-none"
                  />
                </div>

                {/* Availability / Surety Toggle Button */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                    Stock Availability:
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleInStock(sz)}
                    className={`h-8 w-full rounded-lg font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm ${
                      inStock
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-rose-600 text-white hover:bg-rose-700"
                    }`}
                  >
                    {inStock ? (
                      <>
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                        <span>In Stock</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3.5 w-3.5 stroke-[3]" />
                        <span>Out of Stock</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600">
                    Units on Hand:
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!inStock}
                    value={inStock ? (stockCounts[sz] ?? 25) : 0}
                    onChange={(e) =>
                      setStockCounts((prev) => ({
                        ...prev,
                        [sz]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 w-full rounded-lg border-2 border-zinc-300 bg-white px-2 text-xs font-black text-black disabled:bg-zinc-100 disabled:text-zinc-400 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-100 border border-rose-300 p-2.5 text-xs font-bold text-rose-900">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Save Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200">
        <div className="text-xs font-medium text-zinc-600">
          Ready to publish <strong>{ALL_SIZES.filter((sz) => activeSizes[sz]).length}</strong> size variants for <strong>{effectiveColour}</strong> fit.
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-xl border-2 border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-black shadow-md hover:bg-amber-300 disabled:opacity-50 transition"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Variants...</span>
              </>
            ) : (
              <>
                <span>💾 Save & Apply Variants</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
