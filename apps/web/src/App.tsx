import { useCallback, useEffect, useMemo, useState } from "react";
import { useMyWaves } from "./wave/useMyWaves";
import { isValidWaveId, parseWaveIdFromHash, parseWaveIdFromInput } from "./wave/waveId";
import { isMember } from "./wave/myWaves";
import { Header } from "./components/Header";
import { WaveList } from "./components/WaveList";
import { WavePanel } from "./components/WavePanel";
import { JoinScreen } from "./components/JoinScreen";
import { InvalidLink } from "./components/InvalidLink";

/** Parse the hash into a target wave id (supports the legacy "#<wave>/<name>" form). */
function parseHash(): { target: string | null; nameFromHash: string } {
  const [, rawName] = (location.hash.replace(/^#/, "") || "").split("/");
  return { target: parseWaveIdFromHash(location.hash), nameFromHash: (rawName ?? "").trim() };
}

/** The ?name= query, if present. When set we skip the name prompt and auto-join (demo). */
function nameFromQuery(): string {
  return new URLSearchParams(location.search).get("name")?.trim() ?? "";
}

/** Resolve the current user's name: ?name=, then legacy hash name, then saved, then prompt. */
function resolveName(nameFromHash: string): string {
  const chosen = nameFromQuery() || nameFromHash;
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

  const [target, setTarget] = useState<string | null>(initial.target);

  // Hash is the source of truth for the target wave; keep state in sync with Back/Forward.
  useEffect(() => {
    const onHash = () => setTarget(parseHash().target);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const {
    waves,
    presence,
    websocket,
    memberships,
    create,
    join,
    leave,
    markRead,
    markSeenMine,
    unreadOf,
    getMeta,
    getConn,
  } = useMyWaves(me, target);

  const member = target != null && isMember(memberships, target);
  const valid = target != null && isValidWaveId(target);

  const openWave = useCallback(
    (id: string) => {
      if (location.hash.replace(/^#/, "") !== id) location.hash = id; // pushes history (Back works)
      setTarget(id);
      markRead(id);
    },
    [markRead],
  );

  const backToList = useCallback(() => {
    if (location.hash) location.hash = "";
    setTarget(null);
  }, []);

  const onNewWave = useCallback(() => {
    const id = create();
    openWave(id);
  }, [create, openWave]);

  // Join a wave created by someone else: paste its share link (or bare id). Route to the id
  // so the normal flow takes over — the Join screen collects a name for a not-yet-joined
  // wave, and an already-joined wave opens straight away.
  const onJoinWave = useCallback(() => {
    const pasted = window.prompt("Paste the wave link to join:");
    if (pasted == null) return; // user cancelled
    const id = parseWaveIdFromInput(pasted);
    if (!id || !isValidWaveId(id)) {
      window.alert("That doesn't look like a valid wave link.");
      return;
    }
    if (location.hash.replace(/^#/, "") !== id) location.hash = id;
    setTarget(id);
  }, []);

  const doJoin = useCallback(
    (id: string, name: string) => {
      if (name) localStorage.setItem("rewave:name", name);
      join(id);
      openWave(id);
    },
    [join, openWave],
  );

  // ?name= present on an invite link: auto-join a valid, not-yet-joined target (demo, R4.4).
  useEffect(() => {
    if (valid && !member && target && nameFromQuery()) {
      join(target);
    }
  }, [valid, member, target, join]);

  // Mark an open wave read once its summary is known (covers deep-links and late blips).
  useEffect(() => {
    if (member && target) markRead(target);
  }, [member, target, markRead, waves]);

  const onLeave = useCallback(() => {
    if (target) leave(target);
    backToList();
  }, [target, leave, backToList]);

  // ---- Routing decision (spec 07-share-links): invalid -> error, non-member -> join. ----
  if (target != null && !valid) {
    return (
      <div className="rw-app">
        <Header />
        <InvalidLink onBack={backToList} />
      </div>
    );
  }

  if (valid && target != null && !member) {
    const loaded = getMeta(target);
    const title = loaded && loaded.title ? loaded.title : null;
    return (
      <div className="rw-app">
        <Header />
        <JoinScreen
          waveId={target}
          title={title}
          defaultName={me.name}
          onJoin={(name) => doJoin(target, name)}
          onCancel={backToList}
        />
      </div>
    );
  }

  const openId = member ? target : null;

  return (
    <div className="rw-app">
      <Header />

      <div className="rw-inbox" data-view={openId ? "wave" : "list"}>
        <WaveList
          waves={waves}
          selectedId={openId}
          presence={presence}
          unreadOf={unreadOf}
          onOpen={openWave}
          onNewWave={onNewWave}
          onJoinWave={onJoinWave}
        />

        <div className="rw-inbox-main">
          {openId ? (
            <WavePanel
              key={openId}
              waveId={openId}
              me={me}
              websocket={websocket}
              getConn={getConn}
              onBlipAdded={() => {
                markSeenMine(openId); // my own blips never count as unread (R6.3)
              }}
              onBack={backToList}
              onLeave={onLeave}
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
