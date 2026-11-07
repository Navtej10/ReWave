import { useState } from "react";
import type { HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { useWave, type AddedBlip } from "../wave/useWave";
import { askAgent, mentionedAgents } from "../wave/agents";
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
 *  so its provider, typing and edit-lock state are fully fresh (R8.4). */
export function WavePanel(props: {
  waveId: string;
  me: { name: string };
  websocket: HocuspocusProviderWebsocket;
  title: string;
  rawTitle: string;
  onRename: (title: string) => void;
  onBlipAdded: (blip: AddedBlip) => void;
  onBack: () => void;
}) {
  const { waveId, me, websocket, title, rawTitle, onRename, onBlipAdded, onBack } = props;
  const { blips, peers, status, typers, editors, addBlip, editBlip, setTyping, setEditing } =
    useWave(waveId, me, { websocket, onBlipAdded });
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
        <WaveTitle title={title} rawTitle={rawTitle} onRename={onRename} />
        <div className="rw-wavepanel-meta">
          <ConnectionStatus status={status} />
          <PresenceBar names={peers} />
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
