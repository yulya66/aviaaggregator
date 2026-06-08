import { describe, expect, it } from "vitest";
import { flatValues, signFlightSearch } from "./live-search";

describe("flatValues", () => {
  it("sorts keys alphabetically with nesting and flattens to values", () => {
    const params = {
      host: "h",
      locale: "ru",
      marker: "1",
      passengers: { adults: 1, children: 0, infants: 0 },
      segments: [{ origin: "A", destination: "B", date: "2026-09-12" }],
      trip_class: "Y",
      user_ip: "1.2.3.4",
    };
    // top-level: host, locale, marker, passengers, segments, trip_class, user_ip
    // passengers: adults, children, infants ; segment: date, destination, origin
    expect(flatValues(params)).toEqual([
      "h",
      "ru",
      "1",
      "1",
      "0",
      "0",
      "2026-09-12",
      "B",
      "A",
      "Y",
      "1.2.3.4",
    ]);
  });
});

describe("signFlightSearch", () => {
  it("produces a deterministic 32-char md5 hex", () => {
    const params = { host: "h", marker: "1", segments: [] };
    const sig = signFlightSearch("token", params);
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    expect(signFlightSearch("token", params)).toBe(sig); // stable
  });
});
