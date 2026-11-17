import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { redact, renderSpecFiles, slugFor, slugify, type SpecExport } from "./specExport";
import { makeZip } from "./zip";

const URLSAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-".split("");
// Same shape as a real wave id (22 url-safe chars), with a fixed first letter so it is not a word.
const waveIdArb = fc.array(fc.constantFrom(...URLSAFE), { minLength: 21, maxLength: 21 }).map((cs) => `Q${cs.join("")}`);
const originArb = fc
  .tuple(fc.constantFrom("http", "https"), fc.stringMatching(/^[a-z]{3,10}$/), fc.constantFrom("com", "dev", "app"))
  .map(([scheme, host, tld]) => `${scheme}://${host}.${tld}`);

const text = fc.string({ maxLength: 60 });
const ids = fc.array(fc.string({ minLength: 1, maxLength: 12 }), { maxLength: 4 });
const specArb: fc.Arbitrary<SpecExport> = fc.record({
  title: text,
  introduction: text,
  requirements: fc.array(
    fc.record({ title: text, userStory: text, criteria: fc.array(text, { maxLength: 4 }), evidence: ids, raisedBy: fc.array(text, { maxLength: 3 }) }),
    { maxLength: 4 },
  ),
  design: fc.record({
    decision: text,
    alternatives: fc.array(fc.record({ option: text, whyRejected: text, evidence: ids }), { maxLength: 3 }),
    tradeoffs: fc.array(text, { maxLength: 3 }),
    risks: fc.array(text, { maxLength: 3 }),
  }),
  openQuestions: fc.array(text, { maxLength: 4 }),
  tasks: fc.array(text, { maxLength: 4 }),
  thin: fc.boolean(),
  notice: fc.option(text, { nil: null }),
});

/** Sprinkle the secrets into a spec so the test checks redaction, not luck. */
function leak(spec: SpecExport, waveId: string, origin: string): SpecExport {
  const bad = (s: string) => `${s} ${origin}/#${waveId} ${waveId}`;
  return {
    ...spec,
    title: bad(spec.title),
    introduction: bad(spec.introduction),
    requirements: spec.requirements.map((r) => ({
      ...r,
      title: bad(r.title),
      userStory: bad(r.userStory),
      criteria: r.criteria.map(bad),
      evidence: [...r.evidence, waveId],
      raisedBy: [...r.raisedBy, waveId],
    })),
    design: {
      decision: bad(spec.design.decision),
      alternatives: spec.design.alternatives.map((a) => ({ ...a, option: bad(a.option), whyRejected: bad(a.whyRejected), evidence: [...a.evidence, waveId] })),
      tradeoffs: spec.design.tradeoffs.map(bad),
      risks: spec.design.risks.map(bad),
    },
    openQuestions: spec.openQuestions.map(bad),
    tasks: spec.tasks.map(bad),
    notice: spec.notice ? bad(spec.notice) : spec.notice,
  };
}

describe("renderSpecFiles (property)", () => {
  it("always has the required headings, for any export", () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        const files = renderSpecFiles(spec);
        expect(files["requirements.md"]).toMatch(/^# Requirements: /);
        for (const h of ["## Introduction", "## Requirements"]) expect(files["requirements.md"]).toContain(`\n${h}\n`);
        expect(files["design.md"]).toMatch(/^# Design: /);
        for (const h of ["## Approach", "## Decision", "## Alternatives considered", "## Trade-offs", "## Risks", "## Open questions"]) {
          expect(files["design.md"]).toContain(`\n${h}\n`);
        }
        expect(files["tasks.md"]).toMatch(/^# Tasks: /);
      }),
      { numRuns: 200 },
    );
  });

  it("never contains the wave id or origin, even when the content does", () => {
    fc.assert(
      fc.property(specArb, waveIdArb, originArb, (spec, waveId, origin) => {
        const files = renderSpecFiles(leak(spec, waveId, origin), { waveId, origin });
        for (const out of Object.values(files)) {
          expect(out).not.toContain(waveId);
          expect(out).not.toContain(origin);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("keeps the wave id out of the folder name and the zip", () => {
    fc.assert(
      fc.property(specArb, waveIdArb, originArb, (spec, waveId, origin) => {
        const options = { waveId, origin };
        const slug = slugFor(`${spec.title} ${origin}/#${waveId} ${waveId}`, options);
        expect(slug.toLowerCase()).not.toContain(waveId.toLowerCase());
        const files = renderSpecFiles(leak(spec, waveId, origin), options);
        const zip = new TextDecoder("latin1").decode(makeZip({ [`.kiro/specs/${slug}/design.md`]: files["design.md"] }));
        expect(zip).not.toContain(waveId);
        expect(zip).not.toContain(origin);
      }),
      { numRuns: 100 },
    );
  });
});

describe("slugify (property)", () => {
  it("is kebab-case ASCII, at most 40 characters, never edged by a dash", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => {
        const slug = slugify(s);
        expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(slug.length).toBeLessThanOrEqual(40);
      }),
      { numRuns: 300 },
    );
  });
});

describe("redact (property)", () => {
  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), waveIdArb, originArb, (s, waveId, origin) => {
        const once = redact(`${s} ${origin}/#${waveId}`, { waveId, origin });
        expect(redact(once, { waveId, origin })).toBe(once);
      }),
      { numRuns: 100 },
    );
  });
});
