export type BlipKind = "human" | "agent";

/** Plain, render-ready view of one blip (the Yjs data stays inside useWave). */
export interface BlipView {
  id: string;
  parentId: string | null;
  author: string;
  kind: BlipKind;
  text: string;
  createdAt: number;
  /** Blip ids an agent cited as evidence (agent blips only). */
  sources: string[];
}

export type AgentName = "scribe" | "skeptic" | "researcher";

/** Where a user is composing: a reply under a parent blip, or a new top-level blip. */
export type TypingTarget = string | "root";

/** Someone (not you) currently typing, as surfaced by useWave(). */
export interface TyperView {
  /** Parent blip id, or "root" for a new top-level blip. */
  target: TypingTarget;
  name: string;
}
