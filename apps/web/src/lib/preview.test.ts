import { describe, expect, it } from "vitest";

import { decodePreviewCookie, encodePreviewCookie } from "./preview";

describe("preview cookie helpers", () => {
  it("round trips revision and site ids", () => {
    const value = encodePreviewCookie("rev_123", "site_456");
    expect(decodePreviewCookie(value)).toEqual({
      revisionId: "rev_123",
      siteId: "site_456",
    });
  });

  it("returns null for bad payloads", () => {
    expect(decodePreviewCookie(undefined)).toBeNull();
    expect(decodePreviewCookie("only-one-part")).toBeNull();
    expect(decodePreviewCookie("no-site:")).toBeNull();
  });
});



