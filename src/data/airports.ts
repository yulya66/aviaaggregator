import { CITIES } from "./cities";

/** City name for an IATA (city) code, or the raw code if unknown. */
export function cityName(iata: string): string {
  return CITIES[iata] ?? iata;
}
