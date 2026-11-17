import { describe, expect, it } from "vitest";
import { decisionsToMarkdown } from "./decisions";
import type { BlipView } from "./types";

describe("decisionsToMarkdown", () => {
  const d = { id: "1", text: "Ship on Friday [b:a1] [b:n2] [b:zz]", createdAt: Date.UTC(2026, 0, 5), author: "Asha" };
  const blip = (id: string, author: string) => ({ id, author }) as BlipView;

  it("turns citations into a readable 'raised in' reference", () => {
    const md = decisionsToMarkdown([d], undefined, [blip("a1", "Asha"), blip("n2", "Navtej")]);
    expect(md).toBe("# Decision log\n\n- Ship on Friday (raised in: Asha, Navtej) (Asha, 2026-01-05)\n");
  });
  it("lists each author once and omits the reference without known sources", () => {
    const twice = decisionsToMarkdown([d], undefined, [blip("a1", "Asha"), blip("n2", "Asha")]);
    expect(twice).toContain("(raised in: Asha) (Asha");
    expect(decisionsToMarkdown([d])).toBe("# Decision log\n\n- Ship on Friday (Asha, 2026-01-05)\n");
  });
  it("handles an empty log", () => {
    expect(decisionsToMarkdown([])).toContain("No decisions yet.");
  });
});
