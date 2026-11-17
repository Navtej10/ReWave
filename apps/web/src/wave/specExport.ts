import { agentTextOf, detailOf } from "./agents";
import { decisionSources } from "./decisionSources";
import { buildReplayFrames } from "./replayFrames";
import type { BlipView, Decision } from "./types";

// Spec export (spec 09): pure templates, slugify, redaction and the API client. No React, and no
// access to `location`: the wave id and origin come in as options so nothing can leak by accident.

export type SpecFileName = "requirements.md" | "design.md" | "tasks.md";
export const SPEC_FILES: readonly SpecFileName[] = ["requirements.md", "design.md", "tasks.md"];

export interface SpecRequirement {
  title: string;
  userStory: string;
  criteria: string[];
  evidence: string[];
  raisedBy: string[];
}
export interface SpecAlternative {
  option: string;
  whyRejected: string;
  evidence: string[];
}
export interface SpecExport {
  title: string;
  introduction: string;
  requirements: SpecRequirement[];
  design: { decision: string; alternatives: SpecAlternative[]; tradeoffs: string[]; risks: string[] };
  openQuestions: string[];
  tasks: string[];
  /** True when the thread had too little discussion to derive requirements. */
  thin?: boolean;
  notice?: string | null;
}

/** What must never appear in an export: the wave's capability and anything that points at it. */
export interface RedactOptions {
  waveId?: string;
  origin?: string;
}

export const REMOVED_LINK = "[link removed]";
export const SLUG_MAX = 40;
export const REVIEW_NOTE = "Review before committing. This is a starting point.";

// ---- text helpers ----

function flat(text: unknown): string {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace every whitespace-delimited token that contains the wave id or the origin with
 * "[link removed]". Repeats until nothing changes, so a replacement can never leave a match behind.
 */
export function redact(text: string, options: RedactOptions = {}): string {
  const needles = [options.waveId, options.origin].filter((n): n is string => typeof n === "string" && n.length > 0);
  if (needles.length === 0) return text;
  const re = new RegExp(`\\S*(?:${needles.map(escapeRegExp).join("|")})\\S*`, "g");
  let out = text;
  for (let i = 0; i < 8; i++) {
    const next = out.replace(re, REMOVED_LINK);
    if (next === out) break;
    out = next;
  }
  return out;
}

/** kebab-case ASCII folder name, at most 40 characters; "decision" when nothing usable is left. */
export function slugify(text: string): string {
  const slug = text
    .replace(/\[b:[^\]]*\]/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return slug || "decision";
}

/** The folder name for a decision. The text is redacted first, so the wave id can never reach a path. */
export function slugFor(decisionText: string, options: RedactOptions = {}): string {
  return slugify(redact(decisionText, options));
}

export function specPaths(slug: string): Record<SpecFileName, string> {
  return {
    "requirements.md": `.kiro/specs/${slug}/requirements.md`,
    "design.md": `.kiro/specs/${slug}/design.md`,
    "tasks.md": `.kiro/specs/${slug}/tasks.md`,
  };
}

// ---- templates ----

const SHORT_ID = 6;

/** "Raised by Asha, Ben (blips d4e5f6, a1b2c3)". Either part may be missing. */
function provenance(names: readonly string[], evidence: readonly string[]): string {
  const ids = evidence.map((id) => id.slice(0, SHORT_ID));
  const blips = `${ids.length === 1 ? "blip" : "blips"} ${ids.join(", ")}`;
  if (names.length > 0) return `Raised by ${names.join(", ")}${ids.length > 0 ? ` (${blips})` : ""}`;
  return ids.length > 0 ? `Raised in ${blips}` : "";
}

function bullets(items: readonly string[], none: string, clean: (s: string) => string): string {
  const lines = items.map(clean).filter(Boolean);
  return lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : none;
}

/**
 * The three spec files from one export. Every string passes through `redact` before it is placed in
 * a template, and each finished file is redacted once more.
 */
export function renderSpecFiles(spec: SpecExport, options: RedactOptions = {}): Record<SpecFileName, string> {
  const clean = (s: unknown) => redact(flat(s), options);
  const title = clean(spec.title) || "Decision";

  const intro = [clean(spec.notice), clean(spec.introduction)].filter(Boolean).join(" ");
  const reqBlocks = spec.requirements.map((r, i) => {
    const criteria = r.criteria.map(clean).filter(Boolean);
    const lines = [
      `### R${i + 1}: ${clean(r.title)}`,
      `**User story:** ${clean(r.userStory)}`,
      "#### Acceptance criteria",
      ...criteria.map((c, j) => `${j + 1}. ${c}`),
    ];
    const raised = provenance(r.raisedBy.map(clean).filter(Boolean), r.evidence.map(clean).filter(Boolean));
    return raised ? `${lines.join("\n")}\n\n${raised}` : lines.join("\n");
  });
  const requirements = [
    `# Requirements: ${title}`,
    "## Introduction",
    intro || "Exported from a recorded team decision.",
    "## Requirements",
    reqBlocks.length > 0 ? reqBlocks.join("\n") : "None derived.",
  ].join("\n");

  const alternatives = spec.design.alternatives.map((a) => {
    const why = clean(a.whyRejected);
    const ids = a.evidence.map((id) => clean(id).slice(0, SHORT_ID)).filter(Boolean);
    const tail = ids.length > 0 ? `${ids.length === 1 ? "blip" : "blips"} ${ids.join(", ")}` : "";
    const base = `**${clean(a.option)}**: ${why ? `rejected because ${why}` : "no reason is stated in the thread"}`;
    return `${base}${tail ? ` (${tail})` : ""}`;
  });
  const design = [
    `# Design: ${title}`,
    "## Approach",
    "This design records a decision the team reached in discussion. It is a starting point for review, not a finished design.",
    "## Decision",
    clean(spec.design.decision) || "Not stated.",
    "## Alternatives considered",
    bullets(alternatives, "None recorded.", (s) => s),
    "## Trade-offs",
    bullets(spec.design.tradeoffs, "None recorded.", clean),
    "## Risks",
    bullets(spec.design.risks, "None recorded.", clean),
    "## Open questions",
    bullets(spec.openQuestions, "None.", clean),
  ].join("\n");

  const taskLines = spec.tasks.map(clean).filter(Boolean).map((t, i) => `- [ ] ${i + 1}. ${t}`);
  const tasks = [`# Tasks: ${title}`, taskLines.length > 0 ? taskLines.join("\n") : "No tasks derived."].join("\n");

  return {
    "requirements.md": `${redact(requirements, options)}\n`,
    "design.md": `${redact(design, options)}\n`,
    "tasks.md": `${redact(tasks, options)}\n`,
  };
}

// ---- request and response ----

const MAX_SOURCES = 40;
const MAX_CONTEXT = 12;
const MAX_BLIP_CHARS = 2000;

export interface SpecRequestBlip {
  id: string;
  parentId: string | null;
  author: string;
  text: string;
  kind: "human" | "agent";
}
export interface SpecRequestBody {
  decision: string;
  sources: SpecRequestBlip[];
  context: SpecRequestBlip[];
}

/**
 * What the API gets: the decision, the blips it cites, and the last few blips of the thread up to the
 * decision. Deleted blips are never sent, and the wave id and origin are removed from every text.
 */
export function buildSpecRequest(decision: Decision, blips: readonly BlipView[], options: RedactOptions = {}): SpecRequestBody {
  const live = blips.filter((b) => !b.deleted);
  const byId = new Map(live.map((b) => [b.id, b]));
  const toBlip = (b: BlipView): SpecRequestBlip => ({
    id: b.id,
    parentId: b.parentId !== null && byId.has(b.parentId) ? b.parentId : null,
    author: redact(b.author, options),
    text: redact(agentTextOf(b), options).slice(0, MAX_BLIP_CHARS),
    kind: b.kind,
  });
  const sourceIds = decisionSources(decision, live.map((b) => b.id)).slice(0, MAX_SOURCES);
  const sources = sourceIds.map((id) => toBlip(byId.get(id)!));
  const taken = new Set(sourceIds);
  const context = buildReplayFrames(blips, decision)
    .map((f) => f.blip)
    .filter((b) => !b.deleted && !taken.has(b.id))
    .slice(-MAX_CONTEXT)
    .map(toBlip);
  return { decision: redact(flat(decision.text.replace(/\[b:[^\]]*\]/g, "")), options), sources, context };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** The API's answer, or null when it is not shaped like one. Never throws. */
export function parseSpecExport(raw: unknown): SpecExport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const d = (typeof o.design === "object" && o.design !== null ? o.design : {}) as Record<string, unknown>;
  const records = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const title = str(o.title);
  const decision = str(d.decision);
  if (!flat(title) && !flat(decision)) return null;
  return {
    title,
    introduction: str(o.introduction),
    requirements: records(o.requirements).map((r) => ({
      title: str(r.title),
      userStory: str(r.userStory),
      criteria: strings(r.criteria),
      evidence: strings(r.evidence),
      raisedBy: strings(r.raisedBy),
    })),
    design: {
      decision,
      alternatives: records(d.alternatives).map((a) => ({
        option: str(a.option),
        whyRejected: str(a.whyRejected),
        evidence: strings(a.evidence),
      })),
      tradeoffs: strings(d.tradeoffs),
      risks: strings(d.risks),
    },
    openQuestions: strings(o.openQuestions),
    tasks: strings(o.tasks),
    thin: o.thin === true,
    notice: typeof o.notice === "string" && o.notice ? o.notice : null,
  };
}

/** Plain-language reason an export failed. `status` is the HTTP status, null for network errors. */
export function specErrorMessage(status: number | null, detail: string): string {
  if (status === null) return "The spec couldn't be written. Check that the agents API is running.";
  if (/GROQ_API_KEY/i.test(detail)) return "Export is off because GROQ_API_KEY is not set on the API.";
  if (status === 413) return `This thread is too long to export. ${detail}`.trim();
  if (status === 429 && /daily/i.test(detail)) return "Export is out of budget for today.";
  if (status === 429) return "Export is busy right now. Try again in a moment.";
  if (status === 502) return "The model didn't return a usable spec. Try again.";
  return `The spec couldn't be written (error ${status}).`;
}

export class SpecExportError extends Error {}
export const SPEC_EXPORT_TIMEOUT_MS = 90_000;

/** Ask the API for a spec. Throws SpecExportError with a user-facing message. */
export async function requestSpec(
  body: SpecRequestBody,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = SPEC_EXPORT_TIMEOUT_MS,
): Promise<SpecExport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchImpl("/api/export/spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new SpecExportError("The spec took too long to write.");
      throw new SpecExportError(specErrorMessage(null, ""));
    }
    if (!res.ok) throw new SpecExportError(specErrorMessage(res.status, detailOf(await res.text())));
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new SpecExportError(specErrorMessage(502, ""));
    }
    const spec = parseSpecExport(json);
    if (!spec) throw new SpecExportError(specErrorMessage(502, ""));
    return spec;
  } finally {
    clearTimeout(timer);
  }
}
