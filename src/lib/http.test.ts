import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./http";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("fetchJson", () => {
  it("returns parsed JSON on first success", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ a: 1 }));
    const result = await fetchJson<{ a: number }>("https://x.test", { backoffMs: [0, 0, 0] });
    expect(result).toEqual({ a: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(jsonResponse({ ok: true }));
    const result = await fetchJson<{ ok: boolean }>("https://x.test", { backoffMs: [0, 0, 0] });
    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    await expect(fetchJson("https://x.test", { retries: 3, backoffMs: [0, 0, 0] })).rejects.toThrow(
      /down/,
    );
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("treats a non-ok HTTP status as a failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, false, 500));
    await expect(fetchJson("https://x.test", { retries: 1, backoffMs: [0] })).rejects.toThrow(
      /HTTP 500/,
    );
  });
});
