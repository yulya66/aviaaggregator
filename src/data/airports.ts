// IATA (city) code -> Russian city name. Covers home hubs, transit hubs,
// seed destinations, and the layover cities from the design spec (§4.1).
// Falls back to the raw code for anything not listed (see cityName).

export const CITY_BY_IATA: Record<string, string> = {
  // Home hubs
  EKB: "Екатеринбург",
  MOW: "Москва",
  LED: "Санкт-Петербург",

  // Transit hubs (L3)
  EVN: "Ереван",
  TBS: "Тбилиси",
  IST: "Стамбул",
  DXB: "Дубай",
  BEG: "Белград",
  HEL: "Хельсинки",
  RIX: "Рига",
  TLL: "Таллин",
  AYT: "Анталья",
  KUT: "Кутаиси",

  // Common destinations / seed
  AER: "Сочи",
  GOI: "Гоа",
  DPS: "Бали",

  // Layover Tier A (no visa / visa on arrival)
  DOH: "Доха",
  SIN: "Сингапур",
  ICN: "Сеул",
  HKG: "Гонконг",
  BKK: "Бангкок",
  AUH: "Абу-Даби",
  KUL: "Куала-Лумпур",
  TPE: "Тайбэй",
  ADD: "Аддис-Абеба",
  BAH: "Манама",
  MCT: "Маскат",
  EBL: "Эрбиль",
  TAS: "Ташкент",
  GYD: "Баку",
  REK: "Рейкьявик",
  AMS: "Амстердам",
  FRA: "Франкфурт",

  // Layover Tier B (Schengen)
  CDG: "Париж",
  MUC: "Мюнхен",
  BER: "Берлин",
  ZRH: "Цюрих",
  VIE: "Вена",
  CPH: "Копенгаген",
  WAW: "Варшава",
  FCO: "Рим",
  BCN: "Барселона",
  MAD: "Мадрид",
  LIS: "Лиссабон",
  ATH: "Афины",
  NAP: "Неаполь",
  MXP: "Милан",
  PRG: "Прага",
  KRK: "Краков",
  BUD: "Будапешт",
  BRU: "Брюссель",

  // Layover Tier C
  BOM: "Мумбаи",
  DEL: "Дели",
  CMB: "Коломбо",
  MNL: "Манила",
  CAI: "Каир",
};

/** City name for an IATA code, or the raw code if unknown. */
export function cityName(iata: string): string {
  return CITY_BY_IATA[iata] ?? iata;
}
