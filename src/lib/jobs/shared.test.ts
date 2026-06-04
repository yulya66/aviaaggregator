import { describe, expect, it } from "vitest";
import type { TpLatestPrice } from "@/lib/tp/client";
import { dealId, dedupeCheapest, toDeal, toSnapshot } from "./shared";

function price(partial: Partial<TpLatestPrice>): TpLatestPrice {
  return {
    origin: "EKB",
    destination: "AER",
    depart_date: "2026-09-10",
    return_date: null,
    value: 4200,
    airline: "U6",
    number_of_changes: 0,
    ...partial,
  };
}

describe("dedupeCheapest", () => {
  it("keeps only the cheapest price per (destination, depart_date)", () => {
    const result = dedupeCheapest([
      price({ destination: "AER", value: 5000 }),
      price({ destination: "AER", value: 4200 }),
      price({ destination: "LED", value: 3000 }),
    ]);
    expect(result).toHaveLength(2);
    const aer = result.find((p) => p.destination === "AER");
    expect(aer?.value).toBe(4200);
  });
});

describe("dealId", () => {
  it("is deterministic for the same route", () => {
    expect(dealId("EKB", price({}))).toBe(dealId("EKB", price({})));
  });
  it("differs for different routes", () => {
    expect(dealId("EKB", price({ destination: "AER" }))).not.toBe(
      dealId("EKB", price({ destination: "LED" })),
    );
  });
});

describe("toSnapshot", () => {
  it("maps a TP price to a snapshot row", () => {
    const snap = toSnapshot("EKB", price({ value: 4200, number_of_changes: 1 }));
    expect(snap).toMatchObject({
      origin_iata: "EKB",
      destination_iata: "AER",
      depart_date: "2026-09-10",
      price_rub: 4200,
      transfers: 1,
    });
  });
});

describe("toDeal", () => {
  it("includes a deterministic id and an affiliate deep link", () => {
    const deal = toDeal("EKB", price({}), "555", "2026-06-04T07:00:00.000Z");
    expect(deal.id).toBe(dealId("EKB", price({})));
    expect(deal.deep_link).toContain("marker=555.l2_");
    expect(deal.is_active).toBe(true);
    expect(deal.last_seen_at).toBe("2026-06-04T07:00:00.000Z");
  });
});
