"use client";

import { useEffect, useRef, useState } from "react";
import { CloudUpload, FileIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AssetDTO } from "@/types/assets";
import { cn } from "@/lib/utils";

type UploadPanelProps = {
  siteId: string;
  currentFolderId: string | null;
  maxUploadMb: number;
  onUploaded: (asset: AssetDTO) => void;
};

type UploadJob = {
  id: string;
  name: string;
  preview?: string;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
};

export function UploadPanel({
  siteId,
  currentFolderId,
  maxUploadMb,
  onUploaded,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [requestAltText, setRequestAltText] = useState(true);
  const [prompt, setPrompt] = useState(
    "Summarize the subject, scene, and emotion in one short sentence.",
  );
  const previewsRef = useRef<string[]>([]);

  useEffect(
    () => () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const newJobs: UploadJob[] = fileArray.map((file) => {
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      if (preview) {
        previewsRef.current.push(preview);
      }
      return {
        id: randomId(),
        name: file.name,
        preview,
        status: "pending",
      };
    });
    setJobs((prev) => [...newJobs, ...prev]);

    newJobs.forEach((job, index) => {
      uploadFile(job, fileArray[index]);
    });
  }

  async function uploadFile(job: UploadJob, file: File) {
    setJobs((prev) =>
      prev.map((existing) =>
        existing.id === job.id ? { ...existing, status: "uploading" } : existing,
      ),
    );

    const form = new FormData();
    form.append("siteId", siteId);
    if (currentFolderId) {
      form.append("folderId", currentFolderId);
    }
    form.append("label", file.name);
    if (requestAltText) {
      form.append("altTextPrompt", prompt);
    }
    form.append("file", file);

    try {
      const response = await fetch("/api/assets/upload", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Upload failed");
      }
      const payload = await response.json();

      if (requestAltText) {
        try {
          const aiResponse = await fetch("/api/assets/alt-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: payload.asset.id,
              prompt,
            }),
          });
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            payload.asset.altText = aiData.altText;
          }
        } catch (error) {
          console.warn("Alt text generation failed", error);
        }
      }

      setJobs((prev) =>
        prev.map((existing) =>
          existing.id === job.id
            ? {
                ...existing,
                status: "complete",
              }
            : existing,
        ),
      );
      onUploaded(payload.asset);
    } catch (error) {
      setJobs((prev) =>
        prev.map((existing) =>
          existing.id === job.id
            ? {
                ...existing,
                status: "error",
                error:
                  error instanceof Error ? error.message : "Unexpected failure",
              }
            : existing,
        ),
      );
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(true);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-slate-400",
          isDragging && "border-slate-900 bg-slate-50",
        )}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
      >
        <CloudUpload className="mb-3 h-8 w-8 text-slate-500" />
        <p className="text-sm font-medium text-slate-900">
          Drag & drop or click to upload
        </p>
        <p className="text-xs text-slate-500">
          Up to {maxUploadMb} MB per file
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => event.target.files && handleFiles(event.target.files)}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Label className="text-xs text-slate-600">
          Alt text prompt (per upload batch)
        </Label>
        <Textarea
          rows={2}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={requestAltText}
            onChange={(event) => setRequestAltText(event.target.checked)}
            className="rounded border-slate-300"
          />
          Request AI-generated alt text suggestions
        </label>
      </div>

      {jobs.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent uploads
          </p>
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-3 rounded border border-slate-100 px-3 py-2 text-sm"
            >
              {job.preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={job.preview}
                  alt={job.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100">
                  <FileIcon className="h-4 w-4 text-slate-500" />
                </div>
              )}
              <div className="flex flex-1 flex-col">
                <p className="truncate text-slate-900">{job.name}</p>
                <p className="text-xs text-slate-500">{job.status}</p>
                {job.error && (
                  <p className="text-xs text-red-500">{job.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function randomId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}


