import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applyDiff } from "./applyDiff";

function pair() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on("update", (u: Uint8Array) => Y.applyUpdate(b, u));
  b.on("update", (u: Uint8Array) => Y.applyUpdate(a, u));
  return [a.getText("t"), b.getText("t")] as const;
}

describe("applyDiff", () => {
  it("reproduces the target string", () => {
    const [ta] = pair();
    applyDiff(ta, "hello world");
    applyDiff(ta, "hello brave new world");
    applyDiff(ta, "bye");
    expect(ta.toString()).toBe("bye");
  });

  it("keeps both replicas identical", () => {
    const [ta, tb] = pair();
    applyDiff(ta, "Hotel options:");
    applyDiff(tb, "Hotel options: Goa");
    expect(ta.toString()).toBe(tb.toString());
  });
});
