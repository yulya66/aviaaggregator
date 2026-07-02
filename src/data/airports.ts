import { CITIES } from "./cities";
import { CITY_COUNTRY } from "./city-country";
import { COUNTRIES } from "./countries";

/** City name for an IATA (city) code, or the raw code if unknown. */
export function cityName(iata: string): string {
  return CITIES[iata] ?? iata;
}

/** ISO country code (2 letters) for a city IATA code, or "" if unknown. */
export function cityCountryCode(iata: string): string {
  return CITY_COUNTRY[iata] ?? "";
}

/** Russian country name for an ISO country code, or the raw code if unknown. */
export function countryName(code: string): string {
  return COUNTRIES[code] ?? code;
}

/** Russian country name for a city IATA code, or "" if unknown. */
export function cityCountryName(iata: string): string {
  const code = CITY_COUNTRY[iata];
  return code ? (COUNTRIES[code] ?? code) : "";
}

/** True when the city is inside `home` (default RU) — for a «только за границу» filter. */
export function isDomestic(iata: string, home = "RU"): boolean {
  return CITY_COUNTRY[iata] === home;
}
