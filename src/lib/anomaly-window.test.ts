import { describe, expect, it } from "vitest";
import { anomalyWindow, presetWindow } from "./anomaly-window";

const today = "2026-09-22";

describe("anomalyWindow", () => {
  it("без параметров: нижняя граница — сегодня, верх открыт, фильтр не задан", () => {
    expect(anomalyWindow({ today })).toEqual({
      gte: today,
      lte: null,
      from: "",
      to: "",
      active: false,
    });
  });

  it("берёт «С», когда он в будущем", () => {
    expect(anomalyWindow({ from: "2026-10-01", today })).toEqual({
      gte: "2026-10-01",
      lte: null,
      from: "2026-10-01",
      to: "",
      active: true,
    });
  });

  it("не пускает «С» в прошлое, но сохраняет выбор пользователя в поле", () => {
    const w = anomalyWindow({ from: "2026-01-01", today });
    expect(w.gte).toBe(today);
    expect(w.from).toBe("2026-01-01");
    expect(w.active).toBe(true);
  });

  it("ставит верхнюю границу из «По»", () => {
    expect(anomalyWindow({ to: "2026-10-31", today })).toEqual({
      gte: today,
      lte: "2026-10-31",
      from: "",
      to: "2026-10-31",
      active: true,
    });
  });

  it("не исправляет «По» раньше «С» — список просто окажется пустым", () => {
    expect(anomalyWindow({ from: "2026-10-10", to: "2026-10-01", today })).toEqual({
      gte: "2026-10-10",
      lte: "2026-10-01",
      from: "2026-10-10",
      to: "2026-10-01",
      active: true,
    });
  });

  it("игнорирует мусор вместо даты", () => {
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

  it("«По» в прошлом без «С»: нижняя граница всё равно сегодня", () => {
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
  it("считает окна на 1, 3 и 6 месяцев от сегодня", () => {
    expect(presetWindow(1, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2026-10-22" });
    expect(presetWindow(3, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2026-12-22" });
    expect(presetWindow(6, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2027-03-22" });
  });

  it("не перескакивает через месяц, когда сегодня 31 число", () => {
    expect(presetWindow(1, "2026-03-31")).toEqual({ from: "2026-03-31", to: "2026-04-30" });
  });

  it("зажимает 29 января по последнему дню февраля в невисокосный год", () => {
    expect(presetWindow(1, "2026-01-29")).toEqual({ from: "2026-01-29", to: "2026-02-28" });
  });

  it("сохраняет 29 февраля в високосный год", () => {
    expect(presetWindow(1, "2028-01-29")).toEqual({ from: "2028-01-29", to: "2028-02-29" });
  });
});
