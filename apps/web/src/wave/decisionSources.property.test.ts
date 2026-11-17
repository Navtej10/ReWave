import fc from "fast-check";
import { describe, it } from "vitest";
import { decisionSources } from "./decisionSources";

const id = fc.stringMatching(/^[a-z0-9]{1,4}$/);

describe("decisionSources (property)", () => {
  it("never returns an unknown id or a duplicate, and keeps thread order", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(id, { maxLength: 10 }),
        fc.array(id, { maxLength: 10 }),
        fc.option(fc.array(id, { maxLength: 10 }), { nil: undefined }),
        (blipIds, cited, stored) => {
          const text = cited.map((c) => `claim [b:${c}]`).join(" ");
          const out = decisionSources({ text, sourceBlipIds: stored }, blipIds);
          const known = new Set(blipIds);
          if (!out.every((o) => known.has(o))) return false;
          if (new Set(out).size !== out.length) return false;
          const positions = out.map((o) => blipIds.indexOf(o));
          return positions.every((p, i) => i === 0 || positions[i - 1] < p);
        },
      ),
    );
  });
});
