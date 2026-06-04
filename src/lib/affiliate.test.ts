import { describe, expect, it } from "vitest";
import { buildAviasalesLink } from "./affiliate";

describe("buildAviasalesLink", () => {
  const dealId = "a3f7c901-b8e2-5f12-09cd-7eab12345678";

  it("builds a one-way search path ORIG+DDMM+DEST+1", () => {
    const url = buildAviasalesLink({
      origin: "EKB",
      destination: "AER",
      departDate: "2026-09-10",
      marker: "123456",
      dealKind: "l2",
      dealId,
    });
    expect(url).toContain("/search/EKB1009AER1?");
  });

  it("encodes marker as MARKER.SUB_ID with hex deal id and no user", () => {
    const url = buildAviasalesLink({
      origin: "EKB",
      destination: "AER",
      departDate: "2026-09-10",
      marker: "123456",
      dealKind: "l2",
      dealId,
    });
    expect(url).toContain("marker=123456.l2_a3f7c901b8e25f1209cd7eab12345678_");
  });

  it("appends a u-prefixed user id when provided", () => {
    const url = buildAviasalesLink({
      origin: "EVN",
      destination: "FCO",
      departDate: "2026-10-12",
      marker: "999",
      dealKind: "l3",
      dealId,
      userId: "7c4a9b8e-2d5f-190a-bcde-f1234567890a",
    });
    expect(url).toContain(
      "marker=999.l3_a3f7c901b8e25f1209cd7eab12345678_u7c4a9b8e2d5f190abcdef1234567890a",
    );
  });

  it("includes a return DDMM segment for round-trips", () => {
    const url = buildAviasalesLink({
      origin: "MOW",
      destination: "IST",
      departDate: "2026-10-12",
      returnDate: "2026-10-20",
      marker: "1",
      dealKind: "l1",
      dealId,
    });
    expect(url).toContain("/search/MOW1210IST20101?");
  });
});
