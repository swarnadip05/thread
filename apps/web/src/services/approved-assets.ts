import type { HomepageImageDto } from "@thread/types";

import {
  generatedAssetManifest,
  type AssetAudience,
  type AssetRole,
} from "@/content/generated-asset-manifest";

const warnedRoles = new Set<string>();

export function approvedAsset(
  role: AssetRole,
  audience: AssetAudience = null,
): HomepageImageDto | null {
  const asset = generatedAssetManifest.find(
    (candidate) =>
      candidate.assetRole === role &&
      !candidate.needsReview &&
      candidate.publicPath !== null &&
      candidate.width !== null &&
      candidate.height !== null &&
      (audience === null || candidate.audience === audience),
  );
  if (!asset || asset.publicPath === null || asset.width === null || asset.height === null) {
    const warningKey = `${role}:${audience ?? "all"}`;
    if (process.env.NODE_ENV === "development" && !warnedRoles.has(warningKey)) {
      warnedRoles.add(warningKey);
      console.warn(`[THREAD assets] Missing approved homepage asset role: ${warningKey}`);
    }
    return null;
  }
  return {
    source: "local",
    src: asset.publicPath,
    width: asset.width,
    height: asset.height,
    alt: `THREAD ${role} image`,
  };
}
