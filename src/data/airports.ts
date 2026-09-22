import { CITIES } from "./cities";
import { CITY_COUNTRY } from "./city-country";
import { COUNTRIES, COUNTRIES_GENITIVE } from "./countries";

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

/** Genitive (родительный) country name — for «в любой город <страны>». */
export function countryNameGenitive(code: string): string {
  return COUNTRIES_GENITIVE[code] ?? COUNTRIES[code] ?? code;
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

/**
 * Route countries for the card meta line: "Россия → ОАЭ". The same country is
 * written once, a side with an unknown code is dropped, and two unknown sides
 * give "" — then the card renders no separator and no stray space.
 */
export function routeCountries(origin: string, destination: string): string {
  const from = cityCountryName(origin);
  const to = cityCountryName(destination);
  if (from && to) return from === to ? from : `${from} → ${to}`;
  return from || to;
}
