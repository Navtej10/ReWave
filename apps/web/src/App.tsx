import { useMemo, useState } from "react";
import { useWave } from "./wave/useWave";
import { askAgent, mentionedAgents } from "./wave/agents";
import type { BlipView, TyperView } from "./wave/types";

// Hash is "#<wave>/<name>", e.g. "#demo/Navtej". Both windows share the wave id
// but carry their own name, which is what the two-window demo needs.
const [rawWave, rawName] = (location.hash.replace("#", "") || "demo").split("/");
const waveId = (rawWave || "demo").replace(/[^a-z0-9-]/gi, "");

function resolveName(): string {
  const fromHash = (rawName ?? "").trim();
  if (fromHash) {
    localStorage.setItem(`rewave:name:${waveId}`, fromHash);
    return fromHash;
  }
  const saved = localStorage.getItem(`rewave:name:${waveId}`);
  if (saved) return saved;
  const asked = (window.prompt("Your name for this wave?") ?? "").trim();
  const name = asked || `guest-${Math.random().toString(36).slice(2, 6)}`;
  localStorage.setItem(`rewave:name:${waveId}`, name);
  return name;
}

/** Empty bubble with three dots, labeled with the typist's name. */
function TypingBubble({ name }: { name: string }) {
  return (
    <li className="blip typing" aria-live="polite">
      <div className="blip-head">
        <strong>{name}</strong>
      </div>
      <p className="typing-bubble" aria-label={`${name} is typing`}>
        <span className="dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="typing-label">is typing...</span>
      </p>
    </li>
  );
}

function BlipNode(props: {
  blip: BlipView;
  all: BlipView[];
  typers: TyperView[];
  editors: Map<string, string>;
  onReply: (parentId: string, text: string) => void;
  onEdit: (id: string, text: string) => void;
  setTyping: (target: string | null) => void;
  setEditing: (blipId: string | null) => void;
}) {
  const { blip, all, typers, editors, onReply, onEdit, setTyping, setEditing } = props;
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const children = all.filter((b) => b.parentId === blip.id);

  // Any human blip is editable; agent blips never are. A lock held by someone else
  // makes it temporarily read-only.
  const lockedBy = editors.get(blip.id);
  const editable = blip.kind === "human" && !lockedBy;
  const childTypers = typers.filter((t) => t.target === blip.id);

  return (
    <li className={`blip ${blip.kind}`} id={`b-${blip.id}`}>
      <div className="blip-head">
        <strong>{blip.author}</strong>
        {blip.kind === "agent" && <span className="tag">agent</span>}
        {lockedBy && <span className="lock">{lockedBy} is editing...</span>}
      </div>
      {editable ? (
        <textarea
          value={blip.text}
          onChange={(e) => {
            onEdit(blip.id, e.target.value);
            setEditing(blip.id); // keep the lock alive on each keystroke
          }}
          onFocus={() => setEditing(blip.id)}
          onBlur={() => setEditing(null)}
          rows={2}
        />
      ) : (
        <p>{blip.text}</p>
      )}
      {blip.sources.length > 0 && (
        <p className="sources">
          From:{" "}
          {blip.sources.map((s) => (
            <a key={s} href={`#b-${s}`}>
              {s}
            </a>
          ))}
        </p>
      )}
      <button className="link" onClick={() => setReplying((v) => !v)}>
        Reply
      </button>
      {replying && (
        <div className="reply">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setTyping(e.target.value.trim() ? blip.id : null);
            }}
            onFocus={() => {
              if (draft.trim()) setTyping(blip.id);
            }}
            onBlur={() => setTyping(null)}
            placeholder="Reply under this blip"
          />
          <button
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
      {(children.length > 0 || childTypers.length > 0) && (
        <ul>
          {children.map((c) => (
            <BlipNode
              key={c.id}
              blip={c}
              all={all}
              typers={typers}
              editors={editors}
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

export function App() {
  const me = useMemo(() => ({ name: resolveName() }), []);
  const { blips, peers, status, typers, editors, addBlip, editBlip, setTyping, setEditing } = useWave(waveId, me);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const roots = blips.filter((b) => b.parentId === null);
  const rootTypers = typers.filter((t) => t.target === "root");

  async function post(parentId: string | null, text: string) {
    setError(null);
    const id = addBlip({ parentId, text, author: me.name });
    const asked = mentionedAgents(text);
    for (const agent of asked) {
      try {
        const snapshot = [...blips, { id, parentId, author: me.name, kind: "human" as const, text, createdAt: Date.now(), sources: [] }];
        const out = await askAgent(agent, snapshot);
        addBlip({ parentId: id, text: out.text, author: `@${agent}`, kind: "agent", sources: out.sources });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  return (
    <main>
      <header>
        <h1>Rewave</h1>
        <p>
          wave <code>#{waveId}</code> · {status} · here now: {peers.join(", ") || "just you"}
        </p>
      </header>

      <div className="compose">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setTyping(e.target.value.trim() ? "root" : null);
          }}
          onFocus={() => {
            if (draft.trim()) setTyping("root");
          }}
          onBlur={() => setTyping(null)}
          placeholder="Start a thread. Mention @scribe, @skeptic or @researcher to bring an agent in."
          rows={3}
        />
        <button
          onClick={() => {
            if (!draft.trim()) return;
            void post(null, draft.trim());
            setDraft("");
            setTyping(null);
          }}
        >
          Post blip
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {roots.length === 0 && rootTypers.length === 0 ? (
        <p className="empty">This wave is empty. Post the first blip.</p>
      ) : (
        <ul className="thread">
          {roots.map((b) => (
            <BlipNode
              key={b.id}
              blip={b}
              all={blips}
              typers={typers}
              editors={editors}
              onReply={(p, t) => void post(p, t)}
              onEdit={editBlip}
              setTyping={setTyping}
              setEditing={setEditing}
            />
          ))}
          {rootTypers.map((t) => (
            <TypingBubble key={`typing-root-${t.name}`} name={t.name} />
          ))}
        </ul>
      )}
    </main>
  );
}
