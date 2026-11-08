import { useEffect, useRef, useState } from "react";
import type { HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { useWave, type AddedBlip, type SharedConn } from "../wave/useWave";
import { askAgent, mentionedAgents } from "../wave/agents";
import { buildInviteLink } from "../wave/waveId";
import { deriveTitle } from "../wave/waveIndex";
import { ConnectionStatus } from "./ConnectionStatus";
import { PresenceBar } from "./PresenceBar";
import { DecisionLog } from "./DecisionLog";
import { DisconnectedBanner } from "./DisconnectedBanner";
import { BlipNode } from "./BlipNode";
import { TypingBubble } from "./TypingBubble";
import { EmptyState } from "./EmptyState";
import { Composer } from "./Composer";
import { WaveTitle } from "./WaveTitle";
import { BackIcon } from "./icons";

/** The open wave (right panel). One instance per wave id — remounted via `key` on switch,
 *  so its provider, typing and edit-lock state are fully fresh (multi-wave R9.5). The title
 *  is read from and written to the wave's own `meta` map. */
export function WavePanel(props: {
  waveId: string;
  me: { name: string };
  websocket: HocuspocusProviderWebsocket;
  getConn: (waveId: string) => SharedConn | null;
  onBlipAdded: (blip: AddedBlip) => void;
  onBack: () => void;
  onLeave: () => void;
}) {
  const { waveId, me, websocket, getConn, onBlipAdded, onBack, onLeave } = props;
  const {
    blips,
    peers,
    status,
    typers,
    editors,
    meta,
    addBlip,
    editBlip,
    setTyping,
    setEditing,
    renameMeta,
  } = useWave(waveId, me, { websocket, getConn, onBlipAdded });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const title = deriveTitle({ title: meta.title, lastSnippet: blips[0]?.text ?? "" });
  const rawTitle = meta.title;

  const roots = blips.filter((b) => b.parentId === null);
  const rootTypers = typers.filter((t) => t.target === "root");

  async function post(parentId: string | null, text: string) {
    setError(null);
    const id = addBlip({ parentId, text, author: me.name });
    const asked = mentionedAgents(text);
    for (const agent of asked) {
      try {
        const snapshot = [
          ...blips,
          {
            id,
            parentId,
            author: me.name,
            kind: "human" as const,
            text,
            createdAt: Date.now(),
            sources: [],
          },
        ];
        const out = await askAgent(agent, snapshot);
        addBlip({ parentId: id, text: out.text, author: `@${agent}`, kind: "agent", sources: out.sources });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  function send() {
    if (!draft.trim()) return;
    void post(null, draft.trim());
    setDraft("");
    setTyping(null);
  }

  const threadEmpty = roots.length === 0 && rootTypers.length === 0;

  return (
    <section className="rw-wavepanel" aria-label={`Wave ${title}`}>
      <div className="rw-wavepanel-bar">
        <button type="button" className="rw-back" onClick={onBack}>
          <BackIcon className="rw-back-icon" />
          <span>Waves</span>
        </button>
        <WaveTitle title={title} rawTitle={rawTitle} onRename={renameMeta} />
        <div className="rw-wavepanel-meta">
          <ConnectionStatus status={status} />
          <PresenceBar names={peers} />
          <WaveActions waveId={waveId} onLeave={onLeave} />
        </div>
      </div>

      <div className="rw-wavepanel-scroll">
        <div className="rw-column">
          <DisconnectedBanner status={status} />
          <DecisionLog />

          {error && (
            <p className="rw-error" role="alert">
              {error}
            </p>
          )}

          {threadEmpty ? (
            <EmptyState />
          ) : (
            <ul className="rw-thread">
              {roots.map((b) => (
                <BlipNode
                  key={b.id}
                  blip={b}
                  all={blips}
                  typers={typers}
                  editors={editors}
                  myName={me.name}
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
        </div>
      </div>

      <div className="rw-composer-dock">
        <div className="rw-column">
          <Composer
            value={draft}
            onChange={(v) => {
              setDraft(v);
              setTyping(v.trim() ? "root" : null);
            }}
            onSend={send}
            placeholder="Start a thread. Mention @scribe, @skeptic or @researcher to bring an agent in."
          />
        </div>
      </div>
    </section>
  );
}

/** Copy-invite-link button + an overflow menu with "Leave wave" (spec 07-share-links R6). */
function WaveActions(props: { waveId: string; onLeave: () => void }) {
  const { waveId, onLeave } = props;
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function copyLink() {
    const link = buildInviteLink(waveId);
    try {
      await navigator.clipboard?.writeText(link);
    } catch {
      // Clipboard unavailable (e.g. insecure context): fail gracefully, no crash.
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rw-waveactions" ref={wrapRef}>
      <button
        type="button"
        className="rw-copylink"
        onClick={copyLink}
        aria-label="Copy invite link"
      >
        {copied ? "Copied" : "Copy invite link"}
      </button>

      <button
        type="button"
        className="rw-wavemenu-btn"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Wave options"
        onClick={() => setMenuOpen((o) => !o)}
      >
        ⋯
      </button>

      {menuOpen && (
        <ul className="rw-wavemenu" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="rw-wavemenu-item rw-wavemenu-danger"
              onClick={() => {
                setMenuOpen(false);
                onLeave();
              }}
            >
              Leave wave
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
