import { describe, expect, it } from "vitest";
import { todayIso } from "./format";

describe("todayIso", () => {
  it("отдаёт местную дату Екатеринбурга, а не UTC", () => {
    // 22.10 в 21:00 по UTC — это уже 23.10, 02:00 в Екатеринбурге
    expect(todayIso(new Date("2026-10-22T21:00:00Z"))).toBe("2026-10-23");
  });

  it("совпадает с UTC-датой в середине дня", () => {
    expect(todayIso(new Date("2026-10-22T09:00:00Z"))).toBe("2026-10-22");
  });

  it("умеет работать с другим часовым поясом", () => {
    expect(todayIso(new Date("2026-10-22T21:00:00Z"), "UTC")).toBe("2026-10-22");
  });
});
