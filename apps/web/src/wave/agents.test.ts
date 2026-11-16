import { describe, expect, it } from "vitest";
import { SseParser, agentErrorMessage, citedIds, dropUnknownCitations, mentionedAgents, sanitizeReply } from "./agents";

describe("mentionedAgents", () => {
  it("finds explicit mentions only", () => {
    expect(mentionedAgents("@scribe summarize please")).toEqual(["scribe"]);
    expect(mentionedAgents("hey @Skeptic and @researcher")).toEqual(["skeptic", "researcher"]);
  });
  it("ignores look-alikes and plain words", () => {
    expect(mentionedAgents("the scribe was here")).toEqual([]);
    expect(mentionedAgents("email@scribe.com")).toEqual([]);
  });
});

describe("citations", () => {
  const known = new Set(["a1", "b2"]);
  it("drops unknown ids and keeps real ones", () => {
    expect(dropUnknownCitations("Ship it [b:a1] but [b:zzz] wait.", known)).toBe("Ship it [b:a1] but wait.");
  });
  it("lists cited ids once, in order", () => {
    expect(citedIds("[b:b2] and [b:a1] and [b:b2]")).toEqual(["b2", "a1"]);
  });
  it("sanitizes text, sources and card fields", () => {
    const out = sanitizeReply(
      {
        text: "Yes [b:a1] [b:nope]",
        sources: ["a1", "nope"],
        card: { agent: "scribe", summary: "Sum [b:nope]", decisions: ["Do X [b:b2]", "[b:nope]"] },
      },
      known,
    );
    expect(out.text).toBe("Yes [b:a1]");
    expect(out.sources).toEqual(["a1"]);
    expect(out.card).toEqual({ agent: "scribe", summary: "Sum", decisions: ["Do X [b:b2]"] });
  });
});
describe("agentErrorMessage", () => {
  it("explains a missing API key", () => {
    expect(agentErrorMessage("scribe", 500, "GROQ_API_KEY is not set.")).toMatch(/\.env/);
  });
  it("explains an unreachable API", () => {
    expect(agentErrorMessage("skeptic", null, "")).toMatch(/couldn't be reached/);
  });
  it("explains an empty thread", () => {
    expect(agentErrorMessage("researcher", 400, "")).toMatch(/nothing to read/);
  });
});

describe("SseParser", () => {
  it("returns complete events and holds partial ones across chunks", () => {
    const p = new SseParser();
    expect(p.push('event: status\ndata: {"message":"Rea')).toEqual([]);
    expect(p.push('ding"}\n\nevent: delta\r\ndata: {"text":"hi"}\r\n\r\n')).toEqual([
      { event: "status", data: '{"message":"Reading"}' },
      { event: "delta", data: '{"text":"hi"}' },
    ]);
  });
  it("ignores blocks without data", () => {
    expect(new SseParser().push(": keep-alive\n\n")).toEqual([]);
  });
});

describe("agentErrorMessage limits", () => {
  it("explains a spent daily budget and a too-long thread", () => {
    expect(agentErrorMessage("scribe", 429, "The daily agent budget is used up")).toMatch(/tomorrow/);
    expect(agentErrorMessage("scribe", 429, "Too many agent requests")).toMatch(/busy/);
    expect(agentErrorMessage("scribe", 413, "Too long.")).toMatch(/too long|Too long/i);
  });
});