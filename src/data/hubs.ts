// Single source of truth for the cities the app scans, shows, and filters by.

export const HOME_HUBS = [
  { code: "SVX", label: "Екб" },
  { code: "MOW", label: "Мск" },
  { code: "LED", label: "Спб" },
  { code: "CEK", label: "Челябинск" },
  { code: "PEE", label: "Пермь" },
  { code: "TJM", label: "Тюмень" },
  { code: "KUF", label: "Самара" },
] as const;

export const TRANSIT_HUBS = [
  { code: "EVN", label: "Ереван" },
  { code: "TBS", label: "Тбилиси" },
  { code: "IST", label: "Стамбул" },
  { code: "DXB", label: "Дубай" },
  { code: "BEG", label: "Белград" },
  { code: "HEL", label: "Хельсинки" },
  { code: "RIX", label: "Рига" },
  { code: "TLL", label: "Таллин" },
  { code: "AYT", label: "Анталья" },
  { code: "KUT", label: "Кутаиси" },
] as const;

export const HOME_HUB_CODES = HOME_HUBS.map((h) => h.code);
export const TRANSIT_HUB_CODES = TRANSIT_HUBS.map((h) => h.code);
export const ALL_HUB_CODES = [...HOME_HUB_CODES, ...TRANSIT_HUB_CODES];

// "Я знаю куда хочу" mode — dropdown options.
// Origin: our hubs (the only cities we have data for).
export const ORIGIN_OPTIONS = [...HOME_HUBS, ...TRANSIT_HUBS];

// Destination: popular routes people actually search.
export const POPULAR_DESTINATIONS = [
  { code: "AER", label: "Сочи" },
  { code: "MOW", label: "Москва" },
  { code: "LED", label: "Санкт-Петербург" },
  { code: "KZN", label: "Казань" },
  { code: "MRV", label: "Минеральные Воды" },
  { code: "KGD", label: "Калининград" },
  { code: "UFA", label: "Уфа" },
  { code: "KRR", label: "Краснодар" },
  { code: "AAQ", label: "Анапа" },
  { code: "GOJ", label: "Нижний Новгород" },
  { code: "ROV", label: "Ростов-на-Дону" },
  { code: "OVB", label: "Новосибирск" },
  { code: "IST", label: "Стамбул" },
  { code: "AYT", label: "Анталья" },
  { code: "DXB", label: "Дубай" },
  { code: "AUH", label: "Абу-Даби" },
  { code: "EVN", label: "Ереван" },
  { code: "TBS", label: "Тбилиси" },
  { code: "GYD", label: "Баку" },
  { code: "BKK", label: "Бангкок" },
  { code: "DPS", label: "Бали" },
  { code: "HKT", label: "Пхукет" },
  { code: "GOI", label: "Гоа" },
  { code: "CAI", label: "Каир" },
  { code: "FCO", label: "Рим" },
  { code: "BCN", label: "Барселона" },
  { code: "PRG", label: "Прага" },
  { code: "BEG", label: "Белград" },
] as const;
