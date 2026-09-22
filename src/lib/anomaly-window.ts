/** Границы запроса к таблице `anomalies` плюс очищенные значения для полей формы. */
export type DateWindow = {
  /** Нижняя граница `depart_date` — никогда не раньше сегодняшнего дня. */
  gte: string;
  /** Верхняя граница `depart_date` или null, когда «По» не заполнено. */
  lte: string | null;
  /** Значение для поля «Вылет с» ("" — параметра не было или он не прошёл проверку). */
  from: string;
  /** Значение для поля «По». */
  to: string;
  /** Задан ли фильтр — от этого зависит только текст пустого состояния. */
  active: boolean;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-01" → "2026-10-01"; "2026-02-31", "вчера", undefined → "". */
function cleanDate(value: string | undefined): string {
  if (!value || !ISO_DATE.test(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  const real =
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  return real ? value : "";
}

/**
 * Параметры адреса → границы запроса. Прошедшие вылеты не показываются никогда:
 * нижняя граница — максимум из «С» и сегодняшнего дня. «По» раньше «С» намеренно
 * не исправляется, пользователь увидит пустой список и подсказку.
 */
export function anomalyWindow({
  from,
  to,
  today,
}: {
  from?: string;
  to?: string;
  today: string;
}): DateWindow {
  const cleanFrom = cleanDate(from);
  const cleanTo = cleanDate(to);
  return {
    gte: cleanFrom && cleanFrom > today ? cleanFrom : today,
    lte: cleanTo || null,
    from: cleanFrom,
    to: cleanTo,
    active: Boolean(cleanFrom || cleanTo),
  };
}

/**
 * Окно пресета: от сегодня на `months` месяцев вперёд. Если в целевом месяце нет
 * такого числа (31 марта + 1 месяц), берётся последний день месяца, а не переход
 * на следующий.
 */
export function presetWindow(months: number, today: string): { from: string; to: string } {
  const [y, m, d] = today.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const to = new Date(Date.UTC(ty, tm, Math.min(d, lastDay))).toISOString().slice(0, 10);
  return { from: today, to };
}
