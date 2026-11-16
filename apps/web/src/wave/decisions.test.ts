import { describe, expect, it } from "vitest";
import { decisionsToMarkdown } from "./decisions";

describe("decisionsToMarkdown", () => {
  it("lists decisions without internal citations", () => {
    const md = decisionsToMarkdown([{ id: "1", text: "Ship on Friday [b:a1]", createdAt: Date.UTC(2026, 0, 5), author: "Asha" }]);
    expect(md).toBe("# Decision log\n\n- Ship on Friday (Asha, 2026-01-05)\n");
  });
  it("handles an empty log", () => {
    expect(decisionsToMarkdown([])).toContain("No decisions yet.");
  });
});
