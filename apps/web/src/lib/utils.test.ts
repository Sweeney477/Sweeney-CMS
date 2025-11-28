import { describe, expect, it, beforeEach } from "vitest";

import { buildAssetUrl } from "@/lib/utils";

describe("buildAssetUrl", () => {
  beforeEach(() => {
    process.env.ASSET_BASE_URL = "http://localhost:3000/uploads";
    process.env.NEXT_PUBLIC_ASSET_BASE_URL =
      "http://localhost:3000/uploads";
  });

  it("prefers the provided CDN url when available", () => {
    const url = buildAssetUrl({
      cdnUrl: "https://cdn.example.com/assets/sample.jpg",
      url: "/uploads/sample.jpg",
    });
    expect(url).toBe("https://cdn.example.com/assets/sample.jpg");
  });

  it("falls back to the configured base for relative paths", () => {
    const url = buildAssetUrl({
      url: "site-123/2025/sample.jpg",
    });
    expect(url).toBe("http://localhost:3000/uploads/site-123/2025/sample.jpg");
  });

  it("returns the raw path when no base is configured", () => {
    process.env.ASSET_BASE_URL = "";
    process.env.NEXT_PUBLIC_ASSET_BASE_URL = "";
    const url = buildAssetUrl({
      url: "/uploads/sample.jpg",
    });
    expect(url).toBe("/uploads/sample.jpg");
  });
});



