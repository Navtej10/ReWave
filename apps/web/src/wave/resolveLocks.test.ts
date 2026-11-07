import { describe, expect, it } from "vitest";
import { resolveLocks, type EditClaim } from "./resolveLocks";

describe("resolveLocks", () => {
  it("returns no holders for no claims", () => {
    expect(resolveLocks([]).size).toBe(0);
  });

  it("gives an uncontested blip to its only claimant", () => {
    const claims: EditClaim[] = [{ clientID: 7, blipId: "a", name: "Asha" }];
    const holders = resolveLocks(claims);
    expect(holders.get("a")).toEqual({ clientID: 7, name: "Asha" });
  });

  it("the lowest clientID wins a contested blip", () => {
    const claims: EditClaim[] = [
      { clientID: 9, blipId: "a", name: "Ben" },
      { clientID: 3, blipId: "a", name: "Asha" },
      { clientID: 5, blipId: "a", name: "Cy" },
    ];
    expect(resolveLocks(claims).get("a")).toEqual({ clientID: 3, name: "Asha" });
  });

  it("resolves different blips independently", () => {
    const claims: EditClaim[] = [
      { clientID: 9, blipId: "a", name: "Ben" },
      { clientID: 3, blipId: "b", name: "Asha" },
    ];
    const holders = resolveLocks(claims);
    expect(holders.get("a")).toEqual({ clientID: 9, name: "Ben" });
    expect(holders.get("b")).toEqual({ clientID: 3, name: "Asha" });
  });

  it("is order-independent", () => {
    const claims: EditClaim[] = [
      { clientID: 5, blipId: "a", name: "Cy" },
      { clientID: 3, blipId: "a", name: "Asha" },
      { clientID: 9, blipId: "a", name: "Ben" },
    ];
    const reversed = [...claims].reverse();
    expect(resolveLocks(claims)).toEqual(resolveLocks(reversed));
  });
});
