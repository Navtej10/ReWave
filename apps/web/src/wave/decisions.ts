import { dropUnknownCitations } from "./agents";
import type { Decision } from "./types";

/** The decision log as Markdown for pasting into a doc or ticket. Citations are internal, so they are stripped. */
export function decisionsToMarkdown(decisions: readonly Decision[], title = "Decision log"): string {
  if (decisions.length === 0) return `# ${title}\n\nNo decisions yet.\n`;
  const lines = decisions.map((d) => {
    const text = dropUnknownCitations(d.text, new Set()).replace(/\s+/g, " ");
    const day = new Date(d.createdAt).toISOString().slice(0, 10);
    return `- ${text} (${d.author}, ${day})`;
  });
  return `# ${title}\n\n${lines.join("\n")}\n`;
}
