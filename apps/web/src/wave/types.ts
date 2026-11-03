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
