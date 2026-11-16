import { describe, expect, it } from "vitest";
import { IMPORT_MAX_MESSAGES, parseThread } from "./importThread";

describe("parseThread", () => {
  it("splits chat lines by speaker and joins continuation lines", () => {
    const out = parseThread("Asha: We should ship Friday.\nStill need QA.\nBen: I disagree, too risky.");
    expect(out).toEqual([
      { author: "Asha", text: "We should ship Friday.\nStill need QA." },
      { author: "Ben", text: "I disagree, too risky." },
    ]);
  });
  it("reads email From: lines and skips headers and quoted text", () => {
    const out = parseThread(
      "From: Asha Rao <a@x.com>\nSubject: Launch\nDate: Mon\n\nLet's go.\n> old text\n\nFrom: Ben <b@x.com>\n\nNot yet.",
    );
    expect(out).toEqual([
      { author: "Asha Rao", text: "Let's go." },
      { author: "Ben", text: "Not yet." },
    ]);
  });
  it("reads Slack-style header lines", () => {
    const out = parseThread("Asha  10:42 AM\nShip it\nBen  10:45 AM\nWait");
    expect(out).toEqual([
      { author: "Asha", text: "Ship it" },
      { author: "Ben", text: "Wait" },
    ]);
  });
  it("falls back to paragraphs authored 'imported'", () => {
    expect(parseThread("one\n\ntwo")).toEqual([
      { author: "imported", text: "one" },
      { author: "imported", text: "two" },
    ]);
  });
  it("does not treat a single 'Note:' line as a speaker", () => {
    expect(parseThread("Note: this is just prose")).toEqual([{ author: "imported", text: "Note: this is just prose" }]);
  });
  it("caps the message count and returns nothing for blank input", () => {
    expect(parseThread("   \n\n  ")).toEqual([]);
    const many = Array.from({ length: 150 }, (_, i) => `p${i}`).join("\n\n");
    expect(parseThread(many)).toHaveLength(IMPORT_MAX_MESSAGES);
  });
});
