import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

type Item = { code: string; name: string; type: "city" | "country" };

async function search(q: string): Promise<Item[]> {
  const req = new NextRequest(`http://localhost/api/cities?q=${encodeURIComponent(q)}`);
  const res = GET(req);
  const body = (await res.json()) as { items: Item[] };
  return body.items;
}

describe("GET /api/cities", () => {
  it("returns nothing for queries under 2 chars", async () => {
    expect(await search("и")).toEqual([]);
  });

  it("ranks a matching country above cities", async () => {
    const items = await search("итали");
    expect(items[0]).toMatchObject({ code: "IT", type: "country", name: "Италия" });
    // A 2-letter country code is what the form submits and the server recognizes.
    expect(items[0].code).toHaveLength(2);
  });

  it("still returns cities alongside countries", async () => {
    const items = await search("сочи");
    expect(items.some((i) => i.type === "city" && i.name === "Сочи")).toBe(true);
  });

  it("tags every item with a type", async () => {
    const items = await search("мос");
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) expect(i.type === "city" || i.type === "country").toBe(true);
  });
});
