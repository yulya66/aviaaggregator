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
import { CITY_COUNTRY } from "./city-country";
import { COUNTRIES } from "./countries";

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
  it("shows both countries when they differ", () => {
    expect(routeCountries("SVX", "DXB")).toBe("Россия → ОАЭ");
    expect(routeCountries("SVX", "IST")).toBe("Россия → Турция");
  });

  it("doesn't duplicate the same country", () => {
    expect(routeCountries("SVX", "LED")).toBe("Россия");
  });

  it("drops the side with an unknown code", () => {
    expect(routeCountries("SVX", "ZZZ")).toBe("Россия");
    expect(routeCountries("ZZZ", "IST")).toBe("Турция");
  });

  it("returns an empty string when both sides are unknown", () => {
    expect(routeCountries("ZZZ", "QQQ")).toBe("");
  });

  it("collapses the same city code on both sides", () => {
    expect(routeCountries("SVX", "SVX")).toBe("Россия");
  });
});

describe("reference data consistency", () => {
  it("every country code in the city lookup exists in the country lookup", () => {
    const codes = [...new Set(Object.values(CITY_COUNTRY))];
    const missing = codes.filter((code) => !(code in COUNTRIES));
    expect(missing).toEqual([]);
  });
});
