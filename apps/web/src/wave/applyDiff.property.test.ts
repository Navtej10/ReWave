import { describe, it } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { applyDiff } from "./applyDiff";

// Property-based tests (referenced in .kiro/specs/01-live-wave-sync/design.md).
describe("applyDiff (property-based)", () => {
  it("always produces exactly the target string", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (start, target) => {
        const t = new Y.Doc().getText("t");
        t.insert(0, start);
        applyDiff(t, target);
        return t.toString() === target;
      }),
    );
  });

  it("replicas converge after concurrent edits are exchanged", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (base, editA, editB) => {
        const a = new Y.Doc();
        const b = new Y.Doc();
        a.getText("t").insert(0, base);
        Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
        applyDiff(a.getText("t"), editA);
        applyDiff(b.getText("t"), editB);
        Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
        Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
        return a.getText("t").toString() === b.getText("t").toString();
      }),
    );
  });
});
