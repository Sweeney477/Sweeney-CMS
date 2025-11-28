import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import mime from "mime";
import sharp, { type FitEnum } from "sharp";
import { v4 as uuid } from "uuid";

import { env } from "@/env";

type SharpFormat = keyof sharp.FormatEnum;

type EnsureDirCache = Record<string, Promise<void>>;

const ensureDirCache: EnsureDirCache = {};

const uploadsRoot = path.isAbsolute(env.ASSET_STORAGE_ROOT)
  ? env.ASSET_STORAGE_ROOT
  : path.join(process.cwd(), env.ASSET_STORAGE_ROOT);
const baseAssetUrl = normalizeBaseUrl(env.ASSET_BASE_URL);
const relativeBase = "/uploads";
const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;

export type PersistedAsset = {
  storageKey: string;
  relativeUrl: string;
  cdnUrl: string;
  absolutePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  checksum: string;
};

export type TransformPreset = {
  name: string;
  width?: number;
  height?: number;
  fit?: keyof FitEnum;
  format?: SharpFormat;
  quality?: number;
};

export type GeneratedTransform = {
  preset: TransformPreset;
  storageKey: string;
  relativeUrl: string;
  cdnUrl: string;
  absolutePath: string;
  fileSize: number;
  width?: number;
  height?: number;
  checksum: string;
  format: string;
};

export type PersistFileOptions = {
  siteId: string;
  originalName: string;
  mimeType?: string;
  tempFilePath: string;
  folderHint?: string;
};

export const DEFAULT_TRANSFORM_PRESETS: TransformPreset[] = [
  { name: "thumbnail", width: 320, height: 320, fit: "cover", quality: 70 },
  { name: "medium", width: 1024, quality: 82 },
  { name: "large", width: 1920, quality: 82 },
  { name: "webp", format: "webp", quality: 70 },
];

export async function persistFile(
  options: PersistFileOptions,
): Promise<PersistedAsset> {
  await ensureDir(uploadsRoot);

  const tempStats = await fsp.stat(options.tempFilePath);
  if (tempStats.size > maxUploadBytes) {
    throw new Error(
      `File exceeds the configured upload limit of ${env.MAX_UPLOAD_MB} MB`,
    );
  }

  const mimeType = options.mimeType ?? detectMime(options.originalName);
  const storageKey = buildStorageKey(
    options.siteId,
    options.originalName,
    options.folderHint,
  );
  const destination = path.join(uploadsRoot, storageKey);
  await ensureDir(path.dirname(destination));
  await fsp.copyFile(options.tempFilePath, destination);

  const checksum = await hashFile(destination);
  const { width, height } = await readImageDimensions(destination, mimeType);
  const relativeUrl = buildRelativeUrl(storageKey);
  const cdnUrl = buildCdnUrl(storageKey);
  const stats = await fsp.stat(destination);

  return {
    storageKey,
    relativeUrl,
    cdnUrl,
    absolutePath: destination,
    fileName: path.basename(options.originalName),
    mimeType,
    fileSize: stats.size,
    width,
    height,
    checksum,
  };
}

export async function generateTransforms(
  asset: PersistedAsset,
  presets: TransformPreset[] = DEFAULT_TRANSFORM_PRESETS,
): Promise<GeneratedTransform[]> {
  if (!asset.mimeType.startsWith("image/")) {
    return [];
  }

  const results: GeneratedTransform[] = [];
  for (const preset of presets) {
    const format = preset.format ?? inferFormat(asset.mimeType);
    const buffer = await buildTransformBuffer(asset.absolutePath, preset, format);
    const transformKey = buildTransformKey(asset.storageKey, preset, format);
    const destination = path.join(uploadsRoot, transformKey);
    await ensureDir(path.dirname(destination));
    await fsp.writeFile(destination, buffer);
    const checksum = hashBuffer(buffer);
    const size = buffer.byteLength;
    const dimensions = await sharp(buffer).metadata();

    results.push({
      preset,
      storageKey: transformKey,
      relativeUrl: buildRelativeUrl(transformKey),
      cdnUrl: buildCdnUrl(transformKey),
      absolutePath: destination,
      fileSize: size,
      width: dimensions.width ?? undefined,
      height: dimensions.height ?? undefined,
      checksum,
      format,
    });
  }

  return results;
}

export function buildCdnUrl(storageKey: string) {
  return `${baseAssetUrl}${normalizeKey(storageKey)}`;
}

export function buildRelativeUrl(storageKey: string) {
  return `${relativeBase}/${normalizeKey(storageKey)}`;
}

export function getAbsolutePath(storageKey: string) {
  return path.join(uploadsRoot, storageKey);
}

async function ensureDir(dirPath: string) {
  if (!ensureDirCache[dirPath]) {
    ensureDirCache[dirPath] = fsp.mkdir(dirPath, { recursive: true }).then(() => undefined);
  }
  await ensureDirCache[dirPath];
}

function buildStorageKey(siteId: string, fileName: string, folderHint?: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const fallbackMime = detectMime(fileName);
  const ext =
    path.extname(fileName) ||
    `.${mime.getExtension(fallbackMime) ?? "bin"}`;
  const baseName = uuid();
  const folderSegmentRaw = folderHint
    ? sanitizeSegment(folderHint)
    : `site-${siteId}`;
  const folderSegment =
    folderSegmentRaw && folderSegmentRaw.length > 0
      ? folderSegmentRaw
      : `site-${siteId}`;
  return path.join(folderSegment, `${year}`, `${month}`, `${baseName}${ext}`);
}

function sanitizeSegment(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}

async function hashFile(filePath: string) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

function hashBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function detectMime(fileName: string) {
  return mime.getType(fileName) ?? "application/octet-stream";
}

async function readImageDimensions(filePath: string, mimeType: string) {
  if (!mimeType.startsWith("image/")) {
    return { width: undefined, height: undefined };
  }
  const metadata = await sharp(filePath).metadata();
  return {
    width: metadata.width ?? undefined,
    height: metadata.height ?? undefined,
  };
}

function inferFormat(mimeType: string): SharpFormat {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("avif")) return "avif";
  return "jpeg";
}

async function buildTransformBuffer(
  absolutePath: string,
  preset: TransformPreset,
  format: SharpFormat,
) {
  let pipeline = sharp(absolutePath);
  if (preset.width || preset.height) {
    pipeline = pipeline.resize({
      width: preset.width,
      height: preset.height,
      fit: preset.fit ?? "inside",
      withoutEnlargement: true,
    });
  }
  return pipeline
    .toFormat(format, {
      quality: preset.quality ?? 80,
    } as sharp.JpegOptions & sharp.WebpOptions & sharp.PngOptions)
    .toBuffer();
}

function buildTransformKey(
  storageKey: string,
  preset: TransformPreset,
  format: SharpFormat,
) {
  const dir = path.dirname(storageKey);
  const base = path.basename(storageKey, path.extname(storageKey));
  const ext = format === "jpeg" ? ".jpg" : `.${format}`;
  return path.join(dir, `${base}__${preset.name}${ext}`);
}

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

function normalizeKey(key: string) {
  return key.replace(/\\/g, "/").replace(/^\//, "");
}
