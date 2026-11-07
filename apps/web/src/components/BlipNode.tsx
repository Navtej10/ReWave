import { useState } from "react";
import type { BlipView, TyperView } from "../wave/types";
import { Avatar } from "./Avatar";
import { AgentBadge } from "./AgentBadge";
import { SourceChips } from "./SourceChips";
import { EditLockLabel } from "./EditLockLabel";
import { TypingBubble } from "./TypingBubble";
import { relativeTime, isOwnBlip } from "./ui";

/** Recursive blip card: header, body (editable inline when unlocked), reply box, children.
 *  Behavior mirrors the original App.tsx; this is a presentation refactor only. */
export function BlipNode(props: {
  blip: BlipView;
  all: BlipView[];
  typers: TyperView[];
  editors: Map<string, string>;
  myName: string;
  onReply: (parentId: string, text: string) => void;
  onEdit: (id: string, text: string) => void;
  setTyping: (target: string | null) => void;
  setEditing: (blipId: string | null) => void;
}) {
  const { blip, all, typers, editors, myName, onReply, onEdit, setTyping, setEditing } = props;
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const children = all.filter((b) => b.parentId === blip.id);

  // Any human blip is editable; agent blips never are. A lock held by someone else
  // makes it temporarily read-only.
  const lockedBy = editors.get(blip.id);
  const editable = blip.kind === "human" && !lockedBy;
  const childTypers = typers.filter((t) => t.target === blip.id);
  const own = isOwnBlip(blip, myName);

  const classes = [
    "rw-blip",
    blip.kind === "agent" ? "rw-blip--agent" : "rw-blip--human",
    own ? "rw-blip--own" : "",
    lockedBy ? "rw-blip--locked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={classes} id={`b-${blip.id}`}>
      <article className="rw-blip-card">
        <header className="rw-blip-head">
          <Avatar name={blip.author} size="md" title={blip.author} />
          <span className="rw-blip-author">{blip.author}</span>
          {blip.kind === "agent" && <AgentBadge />}
          <time className="rw-blip-time">{relativeTime(blip.createdAt)}</time>
          {lockedBy && <EditLockLabel name={lockedBy} />}
        </header>

        {editable ? (
          <textarea
            className="rw-blip-edit"
            value={blip.text}
            onChange={(e) => {
              onEdit(blip.id, e.target.value);
              setEditing(blip.id); // keep the lock alive on each keystroke
            }}
            onFocus={() => setEditing(blip.id)}
            onBlur={() => setEditing(null)}
            rows={2}
            aria-label={`Edit ${blip.author}'s blip`}
          />
        ) : blip.kind === "human" ? (
          <textarea
            className="rw-blip-edit"
            value={blip.text}
            readOnly
            disabled
            rows={2}
            aria-label={`${blip.author}'s blip (locked by ${lockedBy})`}
          />
        ) : (
          <p className="rw-blip-body">{blip.text}</p>
        )}

        <SourceChips sources={blip.sources} />

        <div className="rw-blip-actions">
          <button
            type="button"
            className="rw-reply-toggle"
            aria-expanded={replying}
            onClick={() => setReplying((v) => !v)}
          >
            Reply
          </button>
        </div>

        {replying && (
          <div className="rw-reply">
            <input
              className="rw-reply-input"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setTyping(e.target.value.trim() ? blip.id : null);
              }}
              onFocus={() => {
                if (draft.trim()) setTyping(blip.id);
              }}
              onBlur={() => setTyping(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  onReply(blip.id, draft.trim());
                  setDraft("");
                  setReplying(false);
                  setTyping(null);
                }
              }}
              placeholder="Reply under this blip"
              aria-label={`Reply to ${blip.author}`}
            />
            <button
              type="button"
              className="rw-reply-send"
              onClick={() => {
                if (!draft.trim()) return;
                onReply(blip.id, draft.trim());
                setDraft("");
                setReplying(false);
                setTyping(null);
              }}
            >
              Send
            </button>
          </div>
        )}
      </article>

      {(children.length > 0 || childTypers.length > 0) && (
        <ul className="rw-children">
          {children.map((c) => (
            <BlipNode
              key={c.id}
              blip={c}
              all={all}
              typers={typers}
              editors={editors}
              myName={myName}
              onReply={onReply}
              onEdit={onEdit}
              setTyping={setTyping}
              setEditing={setEditing}
            />
          ))}
          {childTypers.map((t) => (
            <TypingBubble key={`typing-${blip.id}-${t.name}`} name={t.name} />
          ))}
        </ul>
      )}
    </li>
  );
}
