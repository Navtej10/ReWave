import { useMemo, useState } from "react";
import { useWave } from "./wave/useWave";
import { askAgent, mentionedAgents } from "./wave/agents";
import { Header } from "./components/Header";
import { DecisionLog } from "./components/DecisionLog";
import { DisconnectedBanner } from "./components/DisconnectedBanner";
import { BlipNode } from "./components/BlipNode";
import { TypingBubble } from "./components/TypingBubble";
import { EmptyState } from "./components/EmptyState";
import { Composer } from "./components/Composer";

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

  function send() {
    if (!draft.trim()) return;
    void post(null, draft.trim());
    setDraft("");
    setTyping(null);
  }

  const threadEmpty = roots.length === 0 && rootTypers.length === 0;

  return (
    <div className="rw-app">
      <Header waveId={waveId} status={status} peers={peers} />

      <main className="rw-main">
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
      </main>

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
    </div>
  );
}
