import { describe, expect, it } from "vitest";

import { isValidTimeZone, TIMEZONES } from "./timezones";

describe("timezone helpers", () => {
  it("always includes UTC", () => {
    expect(TIMEZONES).toContain("UTC");
  });

  it("validates IANA zones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});



