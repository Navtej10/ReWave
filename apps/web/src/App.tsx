import { useCallback, useEffect, useMemo, useState } from "react";
import { useWaveIndex } from "./wave/useWaveIndex";
import { deriveTitle } from "./wave/waveIndex";
import { Header } from "./components/Header";
import { WaveList } from "./components/WaveList";
import { WavePanel } from "./components/WavePanel";

/** Parse the hash into a wave id. Supports the legacy "#<wave>/<name>" form (spec 01):
 *  the part before the first "/" is the wave id; a trailing name is honored once below. */
function parseHash(): { waveId: string | null; nameFromHash: string } {
  const [rawWave, rawName] = (location.hash.replace(/^#/, "") || "").split("/");
  const waveId = (rawWave || "").replace(/[^a-z0-9-]/gi, "");
  return { waveId: waveId || null, nameFromHash: (rawName ?? "").trim() };
}

/** Resolve the current user's name: ?name= query, then legacy hash name, then saved, then
 *  a prompt. A single app-wide name (not per-wave) now that the inbox spans many waves. */
function resolveName(nameFromHash: string): string {
  const fromQuery = new URLSearchParams(location.search).get("name")?.trim();
  const chosen = fromQuery || nameFromHash;
  if (chosen) {
    localStorage.setItem("rewave:name", chosen);
    return chosen;
  }
  const saved = localStorage.getItem("rewave:name");
  if (saved) return saved;
  const asked = (window.prompt("Your name?") ?? "").trim();
  const name = asked || `guest-${Math.random().toString(36).slice(2, 6)}`;
  localStorage.setItem("rewave:name", name);
  return name;
}

export function App() {
  const initial = useMemo(parseHash, []);
  const me = useMemo(() => ({ name: resolveName(initial.nameFromHash) }), [initial.nameFromHash]);

  const [waveId, setWaveId] = useState<string | null>(initial.waveId);

  // Hash is the source of truth for the open wave; keep state in sync with Back/Forward.
  useEffect(() => {
    const onHash = () => setWaveId(parseHash().waveId);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const {
    waves,
    presence,
    websocket,
    createWave,
    renameWave,
    recordBlip,
    markSeenMine,
    markRead,
    unreadOf,
  } = useWaveIndex(me, waveId);

  const openWave = useCallback(
    (id: string) => {
      if (location.hash.replace(/^#/, "") !== id) location.hash = id; // pushes history (Back works)
      setWaveId(id);
      markRead(id);
    },
    [markRead],
  );

  const backToList = useCallback(() => {
    // Clear the hash; this is a history entry so browser Back/Forward behaves (R9.3).
    if (location.hash) location.hash = "";
    setWaveId(null);
  }, []);

  const onNewWave = useCallback(() => {
    const id = createWave();
    openWave(id);
  }, [createWave, openWave]);

  // Mark a freshly opened wave read once its summary is known (covers deep-links).
  useEffect(() => {
    if (waveId) markRead(waveId);
  }, [waveId, markRead]);

  const current = waveId ? waves.find((w) => w.id === waveId) : undefined;
  const displayTitle = current ? deriveTitle(current) : "Untitled wave";
  const rawTitle = current?.title ?? "";

  return (
    <div className="rw-app">
      <Header />

      <div className="rw-inbox" data-view={waveId ? "wave" : "list"}>
        <WaveList
          waves={waves}
          selectedId={waveId}
          presence={presence}
          unreadOf={unreadOf}
          onOpen={openWave}
          onNewWave={onNewWave}
        />

        <div className="rw-inbox-main">
          {waveId ? (
            <WavePanel
              key={waveId}
              waveId={waveId}
              me={me}
              websocket={websocket}
              title={displayTitle}
              rawTitle={rawTitle}
              onRename={(t) => renameWave(waveId, t)}
              onBlipAdded={(blip) => {
                recordBlip(waveId, blip);
                markSeenMine(waveId); // my own blips never count as unread (R5.3)
              }}
              onBack={backToList}
            />
          ) : (
            <div className="rw-inbox-blank">
              <div className="rw-inbox-blank-mark" aria-hidden="true">
                〜
              </div>
              <p className="rw-inbox-blank-text">
                Select a wave on the left, or start a new one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
