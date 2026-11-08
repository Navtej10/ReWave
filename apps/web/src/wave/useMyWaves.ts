import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import {
  applyBlipToMeta,
  sortWaves,
  unreadCount,
  type WaveMeta,
  type WaveSummary,
} from "./waveIndex";
import {
  joinMembership,
  lastSeenOf,
  leaveMembership,
  markReadMembership,
  MY_WAVES_KEY,
  parseMemberships,
  serializeMemberships,
  type Membership,
} from "./myWaves";
import { generateWaveId } from "./waveId";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? "ws://127.0.0.1:1234";

/** Persisted name, used for background presence on each joined wave. */
function readMemberships(): Membership[] {
  return parseMemberships(localStorage.getItem(MY_WAVES_KEY));
}

function writeMemberships(list: Membership[]): void {
  localStorage.setItem(MY_WAVES_KEY, serializeMemberships(list));
}

/** Fields we place on a background connection's awareness (presence dot only). */
interface BgPresence {
  user?: { name?: string };
}

/**
 * A lightweight background connection to one joined wave. Reads blips + meta to build the
 * list row, and observes awareness for the "someone's here" dot. It publishes ONLY a `user`
 * name on awareness — never typing or edit-lock state (multi-wave R3.2).
 */
interface BgConn {
  provider: HocuspocusProvider;
  doc: Y.Doc;
  blips: Y.Array<Y.Map<unknown>>;
  meta: Y.Map<unknown>;
  dispose: () => void;
}

/** Derive a wave's row summary from its live document (blips + meta). */
function summarize(id: string, blips: Y.Array<Y.Map<unknown>>, meta: Y.Map<unknown>): WaveSummary {
  // Start from an empty record and fold every blip in order, so blipCount / participants /
  // last* are exact derivations of the wave's own content (no shared index).
  let acc: WaveMeta = {
    title: "",
    createdAt: (meta.get("createdAt") as number | undefined) ?? 0,
    lastActivity: 0,
    blipCount: 0,
    lastSnippet: "",
    lastAuthor: "",
    participants: [],
  };
  blips.forEach((m) => {
    acc = applyBlipToMeta(acc, {
      author: (m.get("author") as string | undefined) ?? "",
      text: (m.get("text") as Y.Text | undefined)?.toString() ?? "",
      at: (m.get("createdAt") as number | undefined) ?? 0,
    });
  });
  return {
    id,
    ...acc,
    title: (meta.get("title") as string | undefined) ?? "",
    createdAt: (meta.get("createdAt") as number | undefined) ?? acc.createdAt,
  };
}

/**
 * The private inbox. Driven by the per-user membership list in localStorage — there is NO
 * shared index document and NO server-side list of waves or users. For each joined wave we
 * open a lightweight background connection (summary + presence) over one shared socket, and
 * the open wave reuses that same socket. See .kiro/specs/06-multi-wave/design.md.
 */
export function useMyWaves(me: { name: string }, openWaveId: string | null) {
  // One socket for the whole app lifetime, shared by every background conn and the open wave.
  const websocket = useMemo(() => new HocuspocusProviderWebsocket({ url: COLLAB_URL }), []);

  const [memberships, setMemberships] = useState<Membership[]>(() => readMemberships());
  const [summaries, setSummaries] = useState<Record<string, WaveSummary>>({});
  const [presence, setPresence] = useState<Set<string>>(new Set());

  // Live background connections, keyed by wave id. Not state — React effects manage them.
  const conns = useRef<Map<string, BgConn>>(new Map());

  // Apply a membership transform against the LATEST list and persist it. Using the functional
  // state updater (rather than membershipsRef) means several mutations fired in one tick —
  // e.g. join() then markRead() inside the same click handler — each see the previous one's
  // result instead of a stale snapshot, so the later write can't clobber the earlier join.
  const persist = useCallback((update: (prev: Membership[]) => Membership[]) => {
    setMemberships((prev) => {
      const next = update(prev);
      if (next === prev) return prev;
      writeMemberships(next);
      return next;
    });
  }, []);

  // Reconcile background connections to the current membership set.
  useEffect(() => {
    const want = new Set(memberships.map((m) => m.id));

    // Tear down connections for waves we left.
    for (const [id, conn] of conns.current) {
      if (!want.has(id)) {
        conn.dispose();
        conns.current.delete(id);
        setSummaries((prev) => {
          const { [id]: _drop, ...rest } = prev;
          return rest;
        });
        setPresence((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }

    // Open connections for newly joined waves.
    for (const id of want) {
      if (conns.current.has(id)) continue;
      const doc = new Y.Doc();
      const blips = doc.getArray<Y.Map<unknown>>("blips");
      const meta = doc.getMap<unknown>("meta");
      const provider = new HocuspocusProvider({ websocketProvider: websocket, name: id, document: doc });
      provider.setAwarenessField("user", { name: me.name });

      const refresh = () => setSummaries((prev) => ({ ...prev, [id]: summarize(id, blips, meta) }));
      blips.observeDeep(refresh);
      meta.observe(refresh);
      refresh();

      const awareness = provider.awareness;
      const myId = awareness?.clientID;
      const refreshPresence = () => {
        if (!awareness) return;
        const states = Array.from(awareness.getStates().entries()) as Array<[number, BgPresence]>;
        // Someone else is here if any client other than me has state on this wave (R7).
        const othersHere = states.some(([cid]) => cid !== myId);
        setPresence((prev) => {
          const has = prev.has(id);
          if (othersHere === has) return prev;
          const next = new Set(prev);
          if (othersHere) next.add(id);
          else next.delete(id);
          return next;
        });
      };
      awareness?.on("change", refreshPresence);
      refreshPresence();

      conns.current.set(id, {
        provider,
        doc,
        blips,
        meta,
        dispose: () => {
          blips.unobserveDeep(refresh);
          meta.unobserve(refresh);
          awareness?.off("change", refreshPresence);
          provider.destroy();
          doc.destroy();
        },
      });
    }
  }, [memberships, websocket, me.name]);

  // Dispose everything on unmount (and the shared socket).
  useEffect(() => {
    const live = conns.current;
    return () => {
      for (const [, conn] of live) conn.dispose();
      live.clear();
      websocket.destroy();
    };
  }, [websocket]);

  // Build the sorted row list from the live summaries, one row per joined wave.
  const waves = useMemo(() => {
    const rows = memberships.map(
      (m) =>
        summaries[m.id] ?? {
          id: m.id,
          title: "",
          createdAt: 0,
          lastActivity: 0,
          blipCount: 0,
          lastSnippet: "",
          lastAuthor: "",
          participants: [],
        },
    );
    return sortWaves(rows);
  }, [memberships, summaries]);

  const create = useCallback(
    (title?: string): string => {
      const id = generateWaveId();
      const now = Date.now();
      persist((prev) => joinMembership(prev, id, now));

      // Seed an optimistic summary so the new wave appears in the list instantly with a
      // sensible createdAt (it sorts to the top) instead of flashing a blank/epoch row while
      // the background connection spins up.
      setSummaries((prev) => ({
        ...prev,
        [id]: {
          id,
          title: title?.trim() ?? "",
          createdAt: now,
          lastActivity: now,
          blipCount: 0,
          lastSnippet: "",
          lastAuthor: "",
          participants: [],
        },
      }));

      // Write meta.createdAt/title into the wave's own doc once its background connection
      // exists. The reconcile effect creates it on the next render, which may land after the
      // first microtask, so retry briefly until the connection is ready.
      let attempts = 0;
      const writeMeta = () => {
        const conn = conns.current.get(id);
        if (conn) {
          conn.doc.transact(() => {
            if (conn.meta.get("createdAt") == null) conn.meta.set("createdAt", now);
            if (title && conn.meta.get("title") == null) conn.meta.set("title", title.trim());
          });
          return;
        }
        if (attempts++ < 20) queueMicrotask(writeMeta);
      };
      queueMicrotask(writeMeta);
      return id;
    },
    [persist],
  );

  const join = useCallback(
    (id: string): void => {
      persist((prev) => joinMembership(prev, id, Date.now()));
    },
    [persist],
  );

  const leave = useCallback(
    (id: string): void => {
      persist((prev) => leaveMembership(prev, id));
    },
    [persist],
  );

  const rename = useCallback((id: string, title: string): void => {
    const conn = conns.current.get(id);
    if (conn) conn.meta.set("title", title.trim());
  }, []);

  const blipCountOf = useCallback((id: string): number => {
    const conn = conns.current.get(id);
    return conn ? conn.blips.length : 0;
  }, []);

  const markRead = useCallback(
    (id: string): void => {
      persist((prev) => markReadMembership(prev, id, blipCountOf(id)));
    },
    [persist, blipCountOf],
  );

  // Advancing last-seen when I post means my own blips never count as unread (R6.3).
  const markSeenMine = useCallback(
    (id: string): void => {
      persist((prev) => markReadMembership(prev, id, blipCountOf(id)));
    },
    [persist, blipCountOf],
  );

  const unreadOf = useCallback(
    (id: string): number => {
      const summary = summaries[id];
      if (!summary) return 0;
      return unreadCount(summary.blipCount, lastSeenOf(memberships, id));
    },
    [summaries, memberships],
  );

  // Best-effort title for the Join screen: readable only if a background conn already exists
  // (i.e. the user is already a member). For a pure non-member we return null and the Join
  // screen falls back to a generic label; the title fills in after joining.
  const getMeta = useCallback(
    (id: string): { title: string; createdAt: number } | null => {
      const conn = conns.current.get(id);
      if (!conn) return null;
      return {
        title: (conn.meta.get("title") as string | undefined) ?? "",
        createdAt: (conn.meta.get("createdAt") as number | undefined) ?? 0,
      };
    },
    [],
  );

  // The live provider + doc for a joined wave's background connection, so the open wave can
  // REUSE it instead of attaching a second provider with the same document name to the
  // shared socket. HocuspocusProviderWebsocket keys its providerMap by document name (one
  // provider per name), so two providers sharing a name clobber each other's message routing
  // — which left a freshly-joined wave stuck on "connecting" until an unrelated membership
  // change reshuffled the map. Reusing the one background provider removes the collision.
  const getConn = useCallback((id: string): { provider: HocuspocusProvider; doc: Y.Doc } | null => {
    const conn = conns.current.get(id);
    return conn ? { provider: conn.provider, doc: conn.doc } : null;
  }, []);

  // openWaveId is accepted for API parity with the old hook and future use (e.g. prefetch);
  // presence already covers "who's inside" per wave, so nothing is published globally.
  void openWaveId;

  return {
    waves,
    presence,
    websocket,
    memberships,
    create,
    join,
    leave,
    rename,
    unreadOf,
    markRead,
    markSeenMine,
    getMeta,
    getConn,
  };
}
