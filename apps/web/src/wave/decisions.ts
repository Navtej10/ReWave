import { dropUnknownCitations } from "./agents";
import { decisionSources } from "./decisionSources";
import type { BlipView, Decision } from "./types";

/**
 * The decision log as Markdown for pasting into a doc or ticket. `[b:id]` markers are replaced by a
 * readable reference, "(raised in: Asha, Navtej)", built from the authors of the cited blips.
 */
export function decisionsToMarkdown(
  decisions: readonly Decision[],
  title = "Decision log",
  blips: readonly BlipView[] = [],
): string {
  if (decisions.length === 0) return `# ${title}\n\nNo decisions yet.\n`;
  const blipIds = blips.map((b) => b.id);
  const authorOf = new Map(blips.map((b) => [b.id, b.author]));
  const lines = decisions.map((d) => {
    const text = dropUnknownCitations(d.text, new Set()).replace(/\s+/g, " ");
    const authors = [...new Set(decisionSources(d, blipIds).map((id) => authorOf.get(id) ?? ""))].filter(Boolean);
    const raised = authors.length > 0 ? ` (raised in: ${authors.join(", ")})` : "";
    const day = new Date(d.createdAt).toISOString().slice(0, 10);
    return `- ${text}${raised} (${d.author}, ${day})`;
  });
  return `# ${title}\n\n${lines.join("\n")}\n`;
}
