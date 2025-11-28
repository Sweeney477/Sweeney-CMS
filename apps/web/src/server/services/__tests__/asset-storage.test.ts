import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  generateTransforms,
  persistFile,
} from "@/server/services/asset-storage";

const uploadsRoot = process.env.ASSET_STORAGE_ROOT!;

async function createTempImage() {
  const buffer = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 120, g: 200, b: 255 },
    },
  })
    .png()
    .toBuffer();

  const tempDir = path.join(uploadsRoot, "tmp");
  await fs.mkdir(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, `image-${Date.now()}.png`);
  await fs.writeFile(tempFile, buffer);
  return tempFile;
}

describe("asset-storage", () => {
  beforeAll(async () => {
    await fs.mkdir(uploadsRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(uploadsRoot, { recursive: true, force: true });
  });

  it("persists files with metadata and generates transforms", async () => {
    const tempFilePath = await createTempImage();

    const persisted = await persistFile({
      siteId: "site-test",
      originalName: "hero.png",
      mimeType: "image/png",
      tempFilePath,
    });

    expect(persisted.storageKey).toContain("site-site-test");
    expect(persisted.fileSize).toBeGreaterThan(0);
    expect(persisted.width).toBeGreaterThan(0);
    expect(persisted.relativeUrl).toMatch(/^\/uploads\//);

    const transforms = await generateTransforms(persisted);
    expect(transforms.length).toBeGreaterThan(0);
    expect(transforms[0].storageKey).toContain("__thumbnail");
  });

  it("gracefully handles non-image uploads", async () => {
    const tempDir = path.join(os.tmpdir(), "sweeney-text");
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, "notes.txt");
    await fs.writeFile(tempFile, "hello world");

    const persisted = await persistFile({
      siteId: "site-test",
      originalName: "notes.txt",
      mimeType: "text/plain",
      tempFilePath: tempFile,
    });

    expect(persisted.width).toBeUndefined();
    const transforms = await generateTransforms(persisted);
    expect(transforms.length).toBe(0);
  });
});

