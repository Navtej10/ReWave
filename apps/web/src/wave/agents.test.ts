import { describe, expect, it } from "vitest";
import { mentionedAgents } from "./agents";

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
