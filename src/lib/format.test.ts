import { describe, expect, it } from "vitest";
import { todayIso } from "./format";

describe("todayIso", () => {
  it("returns the Yekaterinburg local date, not UTC", () => {
    // 22.10 at 21:00 UTC is already 23.10, 02:00 in Yekaterinburg
    expect(todayIso(new Date("2026-10-22T21:00:00Z"))).toBe("2026-10-23");
  });

  it("matches the UTC date in the middle of the day", () => {
    expect(todayIso(new Date("2026-10-22T09:00:00Z"))).toBe("2026-10-22");
  });

  it("works with a different timezone", () => {
    expect(todayIso(new Date("2026-10-22T21:00:00Z"), "UTC")).toBe("2026-10-22");
  });
});
