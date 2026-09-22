import { describe, expect, it } from "vitest";
import { anomalyWindow, presetWindow } from "./anomaly-window";

const today = "2026-09-22";

describe("anomalyWindow", () => {
  it("no params: lower bound is today, upper is open, filter is unset", () => {
    expect(anomalyWindow({ today })).toEqual({
      gte: today,
      lte: null,
      from: "",
      to: "",
      active: false,
    });
  });

  it("takes «С» when it's in the future", () => {
    expect(anomalyWindow({ from: "2026-10-01", today })).toEqual({
      gte: "2026-10-01",
      lte: null,
      from: "2026-10-01",
      to: "",
      active: true,
    });
  });

  it("keeps «С» from going into the past, but preserves the user's input in the field", () => {
    const w = anomalyWindow({ from: "2026-01-01", today });
    expect(w.gte).toBe(today);
    expect(w.from).toBe("2026-01-01");
    expect(w.active).toBe(true);
  });

  it("sets the upper bound from «По»", () => {
    expect(anomalyWindow({ to: "2026-10-31", today })).toEqual({
      gte: today,
      lte: "2026-10-31",
      from: "",
      to: "2026-10-31",
      active: true,
    });
  });

  it("doesn't correct «По» earlier than «С» — the list just ends up empty", () => {
    expect(anomalyWindow({ from: "2026-10-10", to: "2026-10-01", today })).toEqual({
      gte: "2026-10-10",
      lte: "2026-10-01",
      from: "2026-10-10",
      to: "2026-10-01",
      active: true,
    });
  });

  it("ignores garbage in place of a date", () => {
    for (const bad of ["2026-13-40", "2026-02-31", "вчера", "", "20261001"]) {
      expect(anomalyWindow({ from: bad, to: bad, today })).toEqual({
        gte: today,
        lte: null,
        from: "",
        to: "",
        active: false,
      });
    }
  });

  it("«По» in the past without «С»: the lower bound is still today", () => {
    expect(anomalyWindow({ to: "2020-01-01", today })).toEqual({
      gte: today,
      lte: "2020-01-01",
      from: "",
      to: "2020-01-01",
      active: true,
    });
  });
});

describe("presetWindow", () => {
  it("computes windows of 1, 3 and 6 months from today", () => {
    expect(presetWindow(1, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2026-10-22" });
    expect(presetWindow(3, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2026-12-22" });
    expect(presetWindow(6, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2027-03-22" });
  });

  it("doesn't skip a month when today is the 31st", () => {
    expect(presetWindow(1, "2026-03-31")).toEqual({ from: "2026-03-31", to: "2026-04-30" });
  });

  it("clamps January 29 to the last day of February in a non-leap year", () => {
    expect(presetWindow(1, "2026-01-29")).toEqual({ from: "2026-01-29", to: "2026-02-28" });
  });

  it("keeps February 29 in a leap year", () => {
    expect(presetWindow(1, "2028-01-29")).toEqual({ from: "2028-01-29", to: "2028-02-29" });
  });
});
