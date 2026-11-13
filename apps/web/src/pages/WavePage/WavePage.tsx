import { useCallback, useEffect, useState } from "react";
import { Card, Ribbon } from "../../components/ui/index";
import "./wave-page.css";
import { Composer } from "./Composer";
import { DecisionLog } from "./DecisionLog";
import { EmptyWave } from "./EmptyWave";
import { MOCK_SELECTED_ID, MOCK_STATUS, MOCK_USER, MOCK_WAVES } from "./mockData";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { WaveHeader } from "./WaveHeader";
import { UNTITLED, initialsOf, waveTitle, type Blip, type ConnectionStatus, type CurrentUser, type Wave } from "./types";

export interface WavePageProps {
  initialWaves?: Wave[];
  initialSelectedId?: string;
  initialStatus?: ConnectionStatus;
  currentUser?: CurrentUser;
}

const RIBBON_TEXT: Record<Exclude<ConnectionStatus, "online">, string> = {
  connecting: "Connecting to the wave \u2014 you can keep typing, changes will sync when you\u2019re back online.",
  offline: "You\u2019re offline \u2014 you can keep typing, changes will sync when you\u2019re back online.",
};

let nextId = 0;
function newId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId}`;
}

export function WavePage({
  initialWaves = MOCK_WAVES,
  initialSelectedId = MOCK_SELECTED_ID,
  initialStatus = MOCK_STATUS,
  currentUser = MOCK_USER,
}: WavePageProps) {
  const [waves, setWaves] = useState<Wave[]>(initialWaves);
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId);
  const [logOpen, setLogOpen] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus);
  const [draft, setDraft] = useState("");

  useEffect(() => setStatus(initialStatus), [initialStatus]);

  const selected = waves.find((w) => w.id === selectedId) ?? waves[0];

  const handleNewWave = useCallback(() => {
    const wave: Wave = { id: newId("wave"), title: "", blips: [] };
    setWaves((prev) => [wave, ...prev]);
    setSelectedId(wave.id);
    setDraft("");
  }, []);

  const handleJoinWave = useCallback(() => {
    // Joining by link is handled by the share-link flow (JoinScreen); nothing to do in the mock.
  }, []);

  const handleCopyInvite = useCallback(() => {
    void navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
  }, []);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || !selected) return;
    const blip: Blip = {
      id: newId("blip"),
      authorName: currentUser.name,
      text,
      createdAt: Date.now(),
      parentId: null,
    };
    setWaves((prev) => prev.map((w) => (w.id === selected.id ? { ...w, blips: [...w.blips, blip] } : w)));
    setDraft("");
  }, [draft, selected, currentUser.name]);

  return (
    <div className="wp-root">
      <svg className="wp-bg-spark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" />
      </svg>

      <TopBar />

      <div className="wp-shell">
        <Sidebar
          waves={waves}
          selectedId={selected?.id ?? ""}
          onSelect={setSelectedId}
          onNewWave={handleNewWave}
          onJoinWave={handleJoinWave}
        />

        <main className="wp-main">
          <WaveHeader
            title={selected ? waveTitle(selected) : UNTITLED}
            status={status}
            userInitials={initialsOf(currentUser.name)}
            onCopyInvite={handleCopyInvite}
            onMore={() => undefined}
          />

          <div className="wp-body">
            <div className="wp-col">
              {status !== "online" ? (
                <Ribbon role="status" className="wp-ribbon">
                  {RIBBON_TEXT[status]}
                </Ribbon>
              ) : null}

              <DecisionLog open={logOpen} onToggle={() => setLogOpen((v) => !v)} />

              {selected && selected.blips.length > 0 ? (
                <ol className="wp-blips" aria-label="Thread">
                  {selected.blips.map((b) => (
                    <li key={b.id}>
                      <Card className="wp-blip">
                        <strong className="wp-blip__author">{b.authorName}</strong>
                        <p className="wp-blip__text">{b.text}</p>
                      </Card>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyWave />
              )}

              <div className="wp-spacer" aria-hidden="true" />

              <Composer value={draft} onChange={setDraft} onSend={handleSend} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
