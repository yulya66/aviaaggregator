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
