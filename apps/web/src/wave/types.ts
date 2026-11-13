/** Who wrote a blip. */
export type BlipKind = "human" | "agent";

/** What a blip mainly contains (derived; used for labels, search and the Media tab). */
export type ContentKind =
  | "text"
  | "image"
  | "video"
  | "file"
  | "screenshot"
  | "poll"
  | "link"
  | "code"
  | "voice"
  | "sketch"
  | "agent-card";

export type AttachmentKind = "image" | "video" | "file" | "screenshot" | "voice";
export type UploadStatus = "queued" | "uploading" | "done" | "failed";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  size: number;
  mimeType: string;
  /** Remote URL once uploaded. Empty while the uploader's browser is still sending it. */
  url: string;
  width?: number;
  height?: number;
  durationSec?: number;
  status: UploadStatus;
  /** 0..100. Local to the uploader; never synced. */
  progress: number;
  /** Editable description. Falls back to `name` for alt text. */
  alt?: string;
  posterUrl?: string;
  /** WebVTT captions for videos. */
  captionsUrl?: string;
  /** Voice notes: an agent can fill this in later. */
  transcript?: string;
}

export interface PollOption {
  id: string;
  label: string;
  /** Names of the people who picked this option. */
  votes: string[];
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  multiSelect: boolean;
  anonymous: boolean;
  /** ISO timestamp. */
  closesAt?: string;
  closed: boolean;
  /** Hide bars and counts until the viewer has voted. */
  hideResultsUntilVoted?: boolean;
}

export type Stance = "agree" | "disagree" | "unsure";

export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  domain: string;
  thumbnailUrl?: string;
}

export interface CodeSnippet {
  language: string;
  code: string;
  lineNumbers?: boolean;
}

export interface ResearchSource {
  title: string;
  domain: string;
  url: string;
  quote: string;
}

/** Structured agent output, rendered as a dedicated card. */
export type AgentCardData =
  | { agent: "scribe"; summary: string; decisions: string[] }
  | { agent: "skeptic"; counterpoint: string }
  | { agent: "researcher"; summary?: string; sources: ResearchSource[]; lookups?: string[] };

export const REACTION_KEYS = ["thumbsUp", "heart", "laugh", "think", "eyes", "check"] as const;
export type ReactionKey = (typeof REACTION_KEYS)[number];

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
  contentKind: ContentKind;
  attachments: Attachment[];
  poll?: Poll;
  link?: LinkPreview;
  code?: CodeSnippet;
  card?: AgentCardData;
  /** reaction key -> names of the people who reacted */
  reactions: Record<string, string[]>;
  /** person -> their stance on this blip */
  stances: Record<string, Stance>;
  pinned: boolean;
  /** Epoch ms of the last text edit. */
  editedAt?: number;
  /** People other than the author who edited the text, most recent editor first. */
  editedBy: string[];
  /** Soft-deleted: kept so its replies stay attached to the thread. */
  deleted: boolean;
}

/** One entry in the wave's decision log (synced in the wave's own Y.Doc). */
export interface Decision {
  id: string;
  text: string;
  createdAt: number;
  author: string;
  /** The poll / agent blip this decision came from. */
  sourceBlipId?: string;
  sourceLabel?: string;
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
