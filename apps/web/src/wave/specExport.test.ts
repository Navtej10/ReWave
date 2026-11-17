import { describe, expect, it } from "vitest";
import {
  buildSpecRequest,
  parseSpecExport,
  redact,
  renderSpecFiles,
  requestSpec,
  slugFor,
  slugify,
  specErrorMessage,
  specPaths,
  type SpecExport,
} from "./specExport";
import type { BlipView, Decision } from "./types";

const WAVE_ID = "AbCdEfGhIjKlMnOpQrStUv";
const ORIGIN = "https://rewave.example";

function blip(id: string, author: string, text: string, extra: Partial<BlipView> = {}): BlipView {
  return {
    id,
    parentId: null,
    author,
    kind: "human",
    text,
    createdAt: 1,
    sources: [],
    contentKind: "text",
    attachments: [],
    reactions: {},
    stances: {},
    pinned: false,
    editedBy: [],
    deleted: false,
    ...extra,
  };
}

const SPEC: SpecExport = {
  title: "Release date",
  introduction: "The team agreed on Monday.",
  requirements: [
    {
      title: "Hold the release for QA",
      userStory: "As a lead, I want QA to finish, so that we ship safely.",
      criteria: ["WHEN QA is not done THEN the system SHALL NOT release.", "WHEN QA signs off THEN the system SHALL release."],
      evidence: ["d4e5f6aaaa", "a1b2c3bbbb"],
      raisedBy: ["Asha", "Ben"],
    },
  ],
  design: {
    decision: "Ship on Monday.",
    alternatives: [{ option: "Ship Friday", whyRejected: "QA needs the weekend", evidence: ["d4e5f6aaaa"] }],
    tradeoffs: ["Two days later"],
    risks: ["Scope creep"],
  },
  openQuestions: ["Who runs QA?"],
  tasks: ["Move the release date", "Tell the customers"],
};

describe("slugify", () => {
  it("makes kebab-case ASCII", () => {
    expect(slugify("Ship on Monday!")).toBe("ship-on-monday");
    expect(slugify("  Caf\u00e9 au lait -- now  ")).toBe("cafe-au-lait-now");
  });
  it("removes citations and trims the cut to 40 characters", () => {
    expect(slugify("Use Postgres [b:abc123] for storage")).toBe("use-postgres-for-storage");
    const slug = slugify("a".repeat(39) + " bbbbbbbb");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
    expect(slugify("word ".repeat(30)).length).toBeLessThanOrEqual(40);
  });
  it("falls back to 'decision'", () => {
    expect(slugify("")).toBe("decision");
    expect(slugify("!!! \u2713")).toBe("decision");
    expect(slugify("\u65e5\u672c\u8a9e")).toBe("decision");
  });
});

describe("redact", () => {
  it("removes tokens that contain the wave id or origin", () => {
    const text = `join ${ORIGIN}/#${WAVE_ID} or ${WAVE_ID} or see ${ORIGIN}/ok.`;
    const out = redact(text, { waveId: WAVE_ID, origin: ORIGIN });
    expect(out).toBe("join [link removed] or [link removed] or see [link removed]");
    expect(out).not.toContain(WAVE_ID);
  });
  it("leaves text alone without options", () => {
    expect(redact("hello", {})).toBe("hello");
    expect(redact("hello", { waveId: "" })).toBe("hello");
  });
  it("slugFor never lets the id reach the folder name", () => {
    expect(slugFor(`see #${WAVE_ID}`, { waveId: WAVE_ID }).toLowerCase()).not.toContain(WAVE_ID.toLowerCase());
  });
});

describe("renderSpecFiles", () => {
  const files = renderSpecFiles(SPEC);

  it("renders requirements.md in the repo's spec format", () => {
    const md = files["requirements.md"];
    expect(md).toContain("# Requirements: Release date");
    expect(md).toContain("## Introduction\nThe team agreed on Monday.");
    expect(md).toContain("## Requirements");
    expect(md).toContain("### R1: Hold the release for QA");
    expect(md).toContain("**User story:** As a lead, I want QA to finish, so that we ship safely.");
    expect(md).toContain("#### Acceptance criteria\n1. WHEN QA is not done THEN the system SHALL NOT release.\n2. WHEN QA signs off");
  });

  it("renders provenance lines with the first six characters of each blip id", () => {
    expect(files["requirements.md"]).toContain("Raised by Asha, Ben (blips d4e5f6, a1b2c3)");
    const one = renderSpecFiles({ ...SPEC, requirements: [{ ...SPEC.requirements[0], raisedBy: ["Asha"], evidence: ["d4e5f6aaaa"] }] });
    expect(one["requirements.md"]).toContain("Raised by Asha (blip d4e5f6)");
  });

  it("renders design.md with every section, including open questions", () => {
    const md = files["design.md"];
    for (const h of ["# Design: Release date", "## Approach", "## Decision", "## Alternatives considered", "## Trade-offs", "## Risks", "## Open questions"]) {
      expect(md).toContain(h);
    }
    expect(md).toContain("## Decision\nShip on Monday.");
    expect(md).toContain("- **Ship Friday**: rejected because QA needs the weekend (blip d4e5f6)");
    expect(md).toContain("## Open questions\n- Who runs QA?");
  });

  it("renders tasks.md as numbered checkboxes", () => {
    expect(files["tasks.md"]).toBe("# Tasks: Release date\n- [ ] 1. Move the release date\n- [ ] 2. Tell the customers\n");
  });

  it("renders empty lists with a fixed placeholder", () => {
    const empty = renderSpecFiles({
      title: "T",
      introduction: "",
      requirements: [],
      design: { decision: "D", alternatives: [], tradeoffs: [], risks: [] },
      openQuestions: [],
      tasks: [],
    });
    expect(empty["requirements.md"]).toContain("None derived.");
    expect(empty["design.md"]).toContain("## Alternatives considered\nNone recorded.");
    expect(empty["design.md"]).toContain("## Open questions\nNone.");
    expect(empty["tasks.md"]).toContain("No tasks derived.");
  });

  it("puts the thin-thread notice in the requirements introduction", () => {
    const thin = renderSpecFiles({
      title: "T",
      introduction: "",
      requirements: [],
      design: { decision: "D", alternatives: [], tradeoffs: [], risks: [] },
      openQuestions: ["What are the requirements?"],
      tasks: [],
      thin: true,
      notice: "There was not enough discussion in this thread to derive requirements.",
    });
    expect(thin["requirements.md"]).toContain("## Introduction\nThere was not enough discussion");
  });

  it("keeps multi-line model text on one line", () => {
    const md = renderSpecFiles({ ...SPEC, tasks: ["one\n## Injected heading"] })["tasks.md"];
    expect(md).toBe("# Tasks: Release date\n- [ ] 1. one ## Injected heading\n");
  });

  it("never contains the wave id or origin, even when the text does", () => {
    const leaky: SpecExport = {
      ...SPEC,
      title: `Plan ${ORIGIN}/#${WAVE_ID}`,
      introduction: `Invite: ${ORIGIN}/#${WAVE_ID}`,
      requirements: [{ ...SPEC.requirements[0], title: WAVE_ID, raisedBy: [WAVE_ID], criteria: [`WHEN x THEN ${ORIGIN}/a`] }],
      openQuestions: [`see #${WAVE_ID}`],
    };
    const out = renderSpecFiles(leaky, { waveId: WAVE_ID, origin: ORIGIN });
    for (const text of Object.values(out)) {
      expect(text).not.toContain(WAVE_ID);
      expect(text).not.toContain(ORIGIN);
    }
  });

  it("lays out the zip paths", () => {
    expect(specPaths("ship")["design.md"]).toBe(".kiro/specs/ship/design.md");
  });
});

describe("buildSpecRequest", () => {
  const decision: Decision = { id: "d", text: "Ship Monday [b:b1]", createdAt: 10, author: "Asha", sourceBlipIds: ["b1", "b2"], threadLength: 4 };
  const blips = [
    blip("b0", "Cleo", "intro"),
    blip("b1", "Asha", `Friday? ${ORIGIN}/#${WAVE_ID}`),
    blip("b2", "Ben", "QA needs Monday", { parentId: "b1" }),
    blip("b3", "Cleo", "gone", { deleted: true }),
    blip("b4", "scribe", "Summary", { kind: "agent" }),
  ];

  it("sends sources and context, without deleted blips or the wave link", () => {
    const body = buildSpecRequest(decision, blips, { waveId: WAVE_ID, origin: ORIGIN });
    expect(body.decision).toBe("Ship Monday");
    expect(body.sources.map((s) => s.id)).toEqual(["b1", "b2"]);
    expect(body.context.map((s) => s.id)).toEqual(["b0"]);
    expect(body.sources[1]).toMatchObject({ parentId: "b1", author: "Ben", kind: "human" });
    expect(JSON.stringify(body)).not.toContain(WAVE_ID);
    expect(JSON.stringify(body)).not.toContain(ORIGIN);
  });
});

describe("parseSpecExport", () => {
  it("accepts a valid answer and rejects junk without throwing", () => {
    expect(parseSpecExport({ ...SPEC, thin: false, notice: null })?.title).toBe("Release date");
    for (const bad of [null, 5, "x", [], {}, { title: 5 }]) expect(parseSpecExport(bad)).toBeNull();
  });
  it("coerces wrong field types to empty", () => {
    const out = parseSpecExport({ title: "T", requirements: [null, { title: 3, criteria: "x" }], design: { tradeoffs: [1, "ok"] }, tasks: 5 });
    expect(out?.requirements).toHaveLength(1);
    expect(out?.requirements[0].criteria).toEqual([]);
    expect(out?.design.tradeoffs).toEqual(["ok"]);
    expect(out?.tasks).toEqual([]);
  });
});

describe("requestSpec", () => {
  const body = { decision: "x", sources: [], context: [] };
  const reply = (status: number, payload: unknown) => async () => new Response(JSON.stringify(payload), { status });

  it("returns the parsed spec", async () => {
    const spec = await requestSpec(body, reply(200, { ...SPEC, thin: true, notice: "n" }) as typeof fetch);
    expect(spec.thin).toBe(true);
    expect(spec.notice).toBe("n");
  });
  it("turns failures into plain messages", async () => {
    await expect(requestSpec(body, reply(429, { detail: "The daily agent budget is used up." }) as typeof fetch)).rejects.toThrow(/budget/);
    await expect(requestSpec(body, (async () => { throw new TypeError("x"); }) as typeof fetch)).rejects.toThrow(/agents API/);
    await expect(requestSpec(body, reply(200, { nope: 1 }) as typeof fetch)).rejects.toThrow(/usable spec/);
  });
  it("maps status codes", () => {
    expect(specErrorMessage(500, "GROQ_API_KEY is not set")).toMatch(/GROQ_API_KEY/);
    expect(specErrorMessage(429, "Too many")).toMatch(/busy/);
    expect(specErrorMessage(418, "")).toMatch(/418/);
  });
});
