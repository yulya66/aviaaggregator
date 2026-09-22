import { describe, expect, it } from "vitest";
import {
  cityCountryCode,
  cityCountryName,
  cityName,
  countryName,
  countryNameGenitive,
  isDomestic,
  routeCountries,
} from "./airports";

describe("airports country accessors", () => {
  it("maps home hubs to RU", () => {
    for (const hub of ["SVX", "MOW", "LED", "CEK", "PEE", "TJM", "KUF"]) {
      expect(cityCountryCode(hub)).toBe("RU");
      expect(isDomestic(hub)).toBe(true);
    }
  });

  it("maps foreign destinations to their country", () => {
    expect(cityCountryCode("IST")).toBe("TR");
    expect(cityCountryName("IST")).toBe("Турция");
    expect(isDomestic("IST")).toBe(false);
    expect(cityCountryCode("DXB")).toBe("AE");
    expect(countryName("AE")).toBe("ОАЭ");
  });

  it("gives the genitive country form for «в любой город <страны>»", () => {
    expect(countryNameGenitive("IT")).toBe("Италии");
    expect(countryNameGenitive("TR")).toBe("Турции");
    expect(countryNameGenitive("RU")).toBe("России");
    expect(countryNameGenitive("ZZ")).toBe("ZZ"); // unknown → raw code
  });

  it("falls back gracefully on unknown codes", () => {
    expect(cityCountryCode("ZZZ")).toBe("");
    expect(cityCountryName("ZZZ")).toBe("");
    expect(countryName("ZZ")).toBe("ZZ");
    expect(cityName("ZZZ")).toBe("ZZZ");
  });
});

describe("routeCountries", () => {
  it("показывает обе страны, когда они разные", () => {
    expect(routeCountries("SVX", "DXB")).toBe("Россия → ОАЭ");
    expect(routeCountries("SVX", "IST")).toBe("Россия → Турция");
  });

  it("не дублирует одну и ту же страну", () => {
    expect(routeCountries("SVX", "LED")).toBe("Россия");
  });

  it("опускает сторону с неизвестным кодом", () => {
    expect(routeCountries("SVX", "ZZZ")).toBe("Россия");
    expect(routeCountries("ZZZ", "IST")).toBe("Турция");
  });

  it("отдаёт пустую строку, когда обе стороны неизвестны", () => {
    expect(routeCountries("ZZZ", "QQQ")).toBe("");
  });
});
