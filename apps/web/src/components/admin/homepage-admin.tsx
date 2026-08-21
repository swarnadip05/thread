"use client";

import { useEffect, useState, type DragEvent } from "react";
import type {
  AdminHomepageDto,
  HomepageCollectionOptionDto,
  HomepageImageDto,
  HomepageSectionDto,
} from "@thread/types";
import { Button, Skeleton } from "@thread/ui";
import { ExternalLink, Save, Send } from "lucide-react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { useAdminUnsavedChanges } from "./admin-unsaved-changes";
import { HomepageSectionEditor } from "./homepage-section-editor";

interface HomepageOptions {
  readonly collections: readonly HomepageCollectionOptionDto[];
}

interface UploadSignature {
  readonly apiKey: string;
  readonly signature: string;
  readonly uploadUrl: string;
  readonly signedParameters: Readonly<Record<string, string | number>>;
}

interface CloudinaryUpload {
  readonly public_id: string;
  readonly secure_url: string;
  readonly width: number;
  readonly height: number;
  readonly format: "jpg" | "jpeg" | "png" | "webp" | "avif";
  readonly bytes: number;
  readonly resource_type: string;
}

export function HomepageAdmin() {
  const auth = useAuth();
  const { setDirty } = useAdminUnsavedChanges();
  const [homepage, setHomepage] = useState<AdminHomepageDto | null>(null);
  const [collections, setCollections] = useState<readonly HomepageCollectionOptionDto[]>([]);
  const [sections, setSections] = useState<readonly HomepageSectionDto[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading homepage content…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.accessToken) return;
    let active = true;
    void Promise.all([
      apiRequest<AdminHomepageDto>("/admin/homepage", auth.accessToken),
      apiRequest<HomepageOptions>("/admin/homepage/options", auth.accessToken),
    ])
      .then(([content, options]) => {
        if (!active) return;
        setHomepage(content);
        setSections([...content.draft.sections].sort((a, b) => a.sortOrder - b.sortOrder));
        setCollections(options.collections);
        setDirty(false);
        setStatus("");
      })
      .catch(() => {
        if (active) setStatus("Homepage content could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [auth.accessToken, setDirty]);

  function normalizeOrder(next: readonly HomepageSectionDto[]) {
    return next.map((section, index) => ({ ...section, sortOrder: (index + 1) * 10 }));
  }

  function updateSection(id: string, patch: Partial<HomepageSectionDto>) {
    setDirty(true);
    setSections((current) =>
      current.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    );
  }

  function updateSchedule(id: string, field: "startsAt" | "endsAt", value: string | undefined) {
    setDirty(true);
    setSections((current) =>
      current.map((section) => {
        if (section.id !== id) return section;
        if (value) return { ...section, [field]: value };
        const withoutDate = { ...section };
        delete withoutDate[field];
        return withoutDate;
      }),
    );
  }

  function moveSection(id: string, direction: -1 | 1) {
    setDirty(true);
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(target, 0, moved);
      return normalizeOrder(next);
    });
  }

  function dropSection(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    setSections((current) => {
      const sourceIndex = current.findIndex((section) => section.id === draggedId);
      const targetIndex = current.findIndex((section) => section.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      if (!moved) return current;
      next.splice(targetIndex, 0, moved);
      return normalizeOrder(next);
    });
    setDraggedId(null);
    setDirty(true);
  }

  async function saveDraft(): Promise<AdminHomepageDto | null> {
    if (!auth.accessToken) return null;
    setBusy(true);
    setStatus("Saving draft…");
    try {
      const result = await apiRequest<AdminHomepageDto>("/admin/homepage/draft", auth.accessToken, {
        method: "PUT",
        body: JSON.stringify({ sections }),
      });
      setHomepage(result);
      setSections(result.draft.sections);
      setDirty(false);
      setStatus(`Draft v${result.draft.version} saved.`);
      return result;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Draft could not be saved.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!auth.accessToken || !(await saveDraft())) return;
    setBusy(true);
    setStatus("Publishing…");
    try {
      const result = await apiRequest<AdminHomepageDto>(
        "/admin/homepage/publish",
        auth.accessToken,
        { method: "POST" },
      );
      setHomepage(result);
      setStatus(`Published homepage v${result.published.version}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Homepage could not be published.");
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    if (!auth.accessToken || !(await saveDraft())) return;
    try {
      const result = await apiRequest<{ token: string }>(
        "/admin/homepage/preview-token",
        auth.accessToken,
        { method: "POST" },
      );
      window.open(`/?preview=${encodeURIComponent(result.token)}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview could not be created.");
    }
  }

  async function uploadImage(sectionId: string, slot: "desktopImage" | "mobileImage", file: File) {
    if (!auth.accessToken) return;
    const uploadKey = `${sectionId}:${slot}`;
    setUploading(uploadKey);
    setStatus(`Uploading ${file.name}…`);
    try {
      const signature = await apiRequest<UploadSignature>(
        "/admin/homepage/media/upload-signature",
        auth.accessToken,
        { method: "POST" },
      );
      const form = new FormData();
      form.set("file", file);
      form.set("api_key", signature.apiKey);
      form.set("signature", signature.signature);
      for (const [key, value] of Object.entries(signature.signedParameters))
        form.set(key, String(value));
      const response = await fetch(signature.uploadUrl, { method: "POST", body: form });
      if (!response.ok) throw new Error("Image upload failed.");
      const uploaded = (await response.json()) as CloudinaryUpload;
      if (uploaded.resource_type !== "image") throw new Error("The uploaded file is not an image.");
      const mimeType = (
        {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
          avif: "image/avif",
        } as const
      )[uploaded.format];
      const section = sections.find((candidate) => candidate.id === sectionId);
      if (!section) throw new Error("Homepage section no longer exists.");
      const image: HomepageImageDto = {
        source: "cloudinary",
        src: uploaded.secure_url,
        publicId: uploaded.public_id,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
        mimeType,
        bytes: uploaded.bytes,
        alt: `${section.title} — THREAD`,
      };
      updateSection(sectionId, { [slot]: image });
      setStatus("Image uploaded. Save the draft to keep this selection.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Image could not be uploaded.");
    } finally {
      setUploading(null);
    }
  }

  if (!homepage)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 bg-paper/10" />
        <Skeleton className="h-72 bg-paper/10" />
        <p aria-live="polite" className="text-sm text-paper/60">
          {status}
        </p>
      </div>
    );

  const reviewCount = sections.filter((section) => section.needsClientReview).length;

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Homepage content
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Arrange, schedule and publish
          </h1>
          <p className="mt-3 text-sm text-paper/60">
            Draft v{homepage.draft.version} · Published v{homepage.published.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void saveDraft()} variant="outline">
            <Save aria-hidden="true" className="size-4" />
            Save draft
          </Button>
          <Button disabled={busy} onClick={() => void preview()} variant="outline">
            <ExternalLink aria-hidden="true" className="size-4" />
            Preview
          </Button>
          <Button disabled={busy} onClick={() => void publish()} variant="gold">
            <Send aria-hidden="true" className="size-4" />
            Publish
          </Button>
        </div>
      </div>
      <p aria-live="polite" className="mt-5 min-h-6 text-sm text-gold">
        {status}
      </p>
      {reviewCount > 0 ? (
        <div
          className="mt-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-paper/80"
          role="status"
        >
          {reviewCount} homepage {reviewCount === 1 ? "section contains" : "sections contain"} copy
          or claims that need client confirmation before production launch.
        </div>
      ) : null}
      <div className="mt-5 space-y-4">
        {sections.map((section, index) => (
          <div
            key={section.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropSection(event, section.id)}
          >
            <div onDragStart={() => setDraggedId(section.id)}>
              <HomepageSectionEditor
                collections={collections}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
                onImageUpload={(sectionId, slot, file) => void uploadImage(sectionId, slot, file)}
                onMove={moveSection}
                onScheduleChange={updateSchedule}
                onUpdate={updateSection}
                section={section}
                uploading={uploading}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
