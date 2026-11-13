import type { ReactNode } from "react";
import type { AgentName, ReactionKey, Stance } from "../../wave/types";
import type { FileType } from "../../wave/format";

/* Hand-drawn style line icons: ink stroke 1.5, round caps, slightly off-true curves. Decorative (aria-hidden). */

export interface IconProps {
  className?: string;
  size?: number;
}

function Svg({ className, size = 18, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const PaperclipIcon = (p: IconProps) => (
  <Svg {...p}><path d="M20 11.5 12 19.6a5 5 0 0 1-7.1-7.1l8.6-8.7a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" /></Svg>
);
export const ImageIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 5.6c4-.7 11-.4 16-.6l-.4 13.6c-5.6.6-10.6.2-15.3.4Z" /><circle cx="9" cy="10" r="1.5" /><path d="m4.5 17 5-4.5 3.5 3 2.5-2.5 4 4" /></Svg>
);
export const ScreenshotIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 8.2V4.1h4.2M15.8 4h4.2v4.1M20 15.8v4.2h-4.1M8.2 20H4v-4.1" /><path d="M9 9.6h6.1v4.9H8.9Z" /></Svg>
);
export const PollIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 19.2V11M12 19V5.2M19 19.1v-6.3M3.5 20.4h17" /></Svg>
);
export const MicIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3Z" /><path d="M6 11.5a6 6 0 0 0 12 0M12 17.6V21M9 21h6" /></Svg>
);
export const ScribbleIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 17c2.5-1 3.5-7 5.5-7s1.5 6 4 6 2.5-9 5-9 1.5 5 2.5 5" /></Svg>
);
export const CodeIcon = (p: IconProps) => (
  <Svg {...p}><path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.6 5 10.4 19" /></Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>
);
export const PlayIcon = (p: IconProps) => (
  <Svg {...p}><path d="M8 5.6c0-.8.8-1.2 1.5-.8l9 6c.6.4.6 1.2 0 1.6l-9 6c-.7.4-1.5 0-1.5-.8Z" /></Svg>
);
export const PauseIcon = (p: IconProps) => (
  <Svg {...p}><path d="M8.5 5v14M15.5 5.2v13.8" /></Svg>
);
export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14" /></Svg>
);
export const CopyIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 9h10.2v11H9ZM15 9V4.6H4.8V16H9" /></Svg>
);
export const PinIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 4h6l-1 6 3.5 3.5h-11L10 10 9 4ZM12 13.5V20" /></Svg>
);
export const ReplyIcon = (p: IconProps) => (
  <Svg {...p}><path d="m10 6-6 6 6 6M4 12h10a6 6 0 0 1 6 6" /></Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7M10.5 10.5v6M13.5 10.5v6" /></Svg>
);
export const PencilIcon = (p: IconProps) => (
  <Svg {...p}><path d="m4 20 1-4.5L16.5 4a2 2 0 0 1 2.8 2.8L7.8 18.3 4 20ZM14.5 6l3.5 3.5" /></Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="m4.5 12.6 5 4.9L19.6 6.6" /></Svg>
);
export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="m14.5 5-7 7 7 7" /></Svg>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9.5 5 7 7-7 7" /></Svg>
);
export const ArrowUpIcon = (p: IconProps) => (
  <Svg {...p}><path d="m5 14.5 7-7 7 7" /></Svg>
);
export const ArrowDownIcon = (p: IconProps) => (
  <Svg {...p}><path d="m5 9.5 7 7 7-7" /></Svg>
);
export const RetryIcon = (p: IconProps) => (
  <Svg {...p}><path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5M19.5 4.5v4h-4" /></Svg>
);
export const LinkIcon = (p: IconProps) => (
  <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>
);
export const UndoIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9 6.5-5 5 5 5M4.5 11.5h9.8a5 5 0 0 1 0 10H11" /></Svg>
);
export const RedoIcon = (p: IconProps) => (
  <Svg {...p}><path d="m15 6.5 5 5-5 5M19.5 11.5H9.7a5 5 0 0 0 0 10H13" /></Svg>
);
export const EraserIcon = (p: IconProps) => (
  <Svg {...p}><path d="m4 15.5 9.5-9.6a2 2 0 0 1 2.8 0l3.2 3.3a2 2 0 0 1 0 2.8L12 19.5H7.5ZM9 11l6 6M12 19.5h8" /></Svg>
);
export const SmileIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.3" /><path d="M8.6 14c1 1.5 2.2 2.2 3.4 2.2s2.5-.7 3.5-2.2M9.5 9.8h.01M14.6 9.8h.01" /></Svg>
);
export const FilmIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 6.2c5-.5 11-.3 16 0v11.6c-5 .4-11 .3-16 0ZM8 6v12M16 6v12M4 10.5h4M16 10.5h4M4 14h4M16 14h4" /></Svg>
);
export const WarnIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 4 21 19.5H3ZM12 10v4.5M12 17h.01" /></Svg>
);

/* ---------- File types ---------- */

const FILE_MARKS: Record<FileType, string> = {
  pdf: "M8.4 16c1.4-3.2 2.6-3.4 3.6-.4s2.2 2.8 3.6-.2",
  doc: "M8.5 12h7M8.5 15h7M8.5 18h4",
  sheet: "M8.5 12h7M8.5 15.5h7M12 10.5v8",
  zip: "M12 8h1.6M10.4 10h1.6M12 12h1.6M10.4 14h1.6M10.5 16h3v3h-3Z",
  generic: "M8.5 13h7M8.5 16.5h4",
};

export function FileTypeIcon({ type, size = 28, className }: IconProps & { type: FileType }) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 3.6c2.6-.2 5.4-.2 8 0l4 4V20.4c-4 .3-8 .2-12 0Z" />
      <path d="M14 3.6v4h4" />
      <path d={FILE_MARKS[type]} />
    </Svg>
  );
}

/* ---------- Reactions ---------- */

const REACTION_PATHS: Record<ReactionKey, ReactNode> = {
  thumbsUp: <path d="M7 11v8.5H4V11h3ZM7 11l3.5-6.5c1.5-.3 2.5.8 2.2 2.3L12 10h5.8a1.8 1.8 0 0 1 1.8 2.2l-1.3 6a2 2 0 0 1-2 1.6H7" />,
  heart: <path d="M12 19.5C6 15.5 3.8 12.5 3.8 9.2A4 4 0 0 1 12 7a4 4 0 0 1 8.2 2.2c0 3.3-2.2 6.3-8.2 10.3Z" />,
  laugh: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M8 10.4c.7-.9 1.5-.9 2.2 0M13.8 10.4c.7-.9 1.5-.9 2.2 0M7.8 13.8h8.4c0 2.6-1.8 4.3-4.2 4.3s-4.2-1.7-4.2-4.3Z" />
    </>
  ),
  think: (
    <>
      <path d="M8 16.8c-2.5 0-4.3-1.7-4.3-3.9s1.8-3.7 4-3.7c.5-2.3 2.5-3.9 5-3.9 2.7 0 4.8 1.8 5.2 4.2 1.6.2 2.8 1.5 2.8 3.2 0 1.8-1.5 3.1-3.4 3.1Z" />
      <path d="M9.4 19.6h.01M7 22h.01M12 11.6c0-1 1.5-1 1.5-2.2a1.5 1.5 0 0 0-3-.2M12 14h.01" />
    </>
  ),
  eyes: (
    <>
      <path d="M2.8 12c1-2 2.6-3.2 4.2-3.2s3.2 1.2 4.2 3.2c-1 2-2.6 3.2-4.2 3.2S3.8 14 2.8 12ZM12.8 12c1-2 2.6-3.2 4.2-3.2s3.2 1.2 4.2 3.2c-1 2-2.6 3.2-4.2 3.2S13.8 14 12.8 12Z" />
      <path d="M7 12h.01M17 12h.01" strokeWidth={3} />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="m8 12.3 2.8 2.8 5.4-5.6" />
    </>
  ),
};

export const REACTION_LABEL: Record<ReactionKey, string> = {
  thumbsUp: "Thumbs up",
  heart: "Heart",
  laugh: "Laugh",
  think: "Thinking",
  eyes: "Eyes",
  check: "Done",
};

export function ReactionIcon({ name, ...p }: IconProps & { name: ReactionKey }) {
  return <Svg {...p}>{REACTION_PATHS[name]}</Svg>;
}

/* ---------- Stances ---------- */

export function StanceIcon({ stance, ...p }: IconProps & { stance: Stance }) {
  return (
    <Svg size={14} {...p}>
      <circle cx="12" cy="12" r="8.6" />
      {stance === "agree" ? <path d="m8 12.3 2.8 2.8 5.4-5.6" /> : null}
      {stance === "disagree" ? <path d="m9 9 6 6M15 9l-6 6" /> : null}
      {stance === "unsure" ? <path d="M9.6 9.7a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.2 1-1.2 1.8M12 16.8h.01" /> : null}
    </Svg>
  );
}

/* ---------- Agents ---------- */

export function AgentGlyph({ agent, ...p }: IconProps & { agent: AgentName }) {
  return (
    <Svg size={14} {...p}>
      {agent === "scribe" ? <path d="M19.5 4.5c-6 0-11 4-12.5 11l-1.5 4 4-1.5c7-1.5 11-6.5 10-13.5ZM7 17.5l7-7" /> : null}
      {agent === "skeptic" ? <path d="m12 3.8 8.2 8.2-8.2 8.2L3.8 12ZM12 8.5v4.2M12 15.6h.01" /> : null}
      {agent === "researcher" ? <><circle cx="10.5" cy="10.5" r="5.8" /><path d="m15 15 5 5" /></> : null}
    </Svg>
  );
}

/** Little strip of washi tape stuck on a corner. Decorative. */
export function TapeCorner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 14" width="30" height="14" aria-hidden="true" focusable="false">
      <path d="M1 3.2 27.5 1l1.5 10.2L2.4 13Z" />
      <path d="M8 2.6l.8 9.6M20 1.8l.9 9.8" />
    </svg>
  );
}
