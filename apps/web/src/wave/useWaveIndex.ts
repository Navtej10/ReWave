import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import {
  applyBlipToMeta,
  sortWaves,
  unreadCount,
  type BlipMetaInput,
  type WaveMeta,
  type WaveSummary,
} from "./waveIndex";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? "ws://127.0.0.1:1234";

/** localStorage key for the per-wave last-seen blip count (unread baseline, R5.4). */
const seenKey = (waveId: string) => `rewave:seen:${waveId}`;

function readSeen(waveId: string): number {
  const raw = localStorage.getItem(seenKey(waveId));
  const n = raw == null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function writeSeen(waveId: string, count: number): void {
  localStorage.setItem(seenKey(waveId), String(Math.max(0, count)));
}

/** Read a wave entry's plain metadata out of its Y.Map. */
function readMeta(entry: Y.Map<unknown>): WaveMeta {
  return {
    title: (entry.get("title") as string | undefined) ?? "",
    createdAt: (entry.get("createdAt") as number | undefined) ?? 0,
    lastActivity: (entry.get("lastActivity") as number | undefined) ?? 0,
    blipCount: (entry.get("blipCount") as number | undefined) ?? 0,
    lastSnippet: (entry.get("lastSnippet") as string | undefined) ?? "",
    lastAuthor: (entry.get("lastAuthor") as string | undefined) ?? "",
    participants: [...((entry.get("participants") as string[] | undefined) ?? [])],
  };
}

/** Write a plain metadata record into a wave entry Y.Map (whole-record, last-writer-wins). */
function writeMeta(entry: Y.Map<unknown>, meta: WaveMeta): void {
  entry.set("title", meta.title);
  entry.set("createdAt", meta.createdAt);
  entry.set("lastActivity", meta.lastActivity);
  entry.set("blipCount", meta.blipCount);
  entry.set("lastSnippet", meta.lastSnippet);
  entry.set("lastAuthor", meta.lastAuthor);
  entry.set("participants", meta.participants);
}

interface IndexPresenceState {
  openWave?: string | null;
}

/**
 * The shared inbox: a single "index" document listing every wave's summary, plus awareness
 * telling us who is currently inside which wave. Returns the shared websocket so the open
 * wave can reuse one connection (see .kiro/specs/06-multi-wave/design.md, R2/R6).
 */
export function useWaveIndex(me: { name: string }, openWaveId: string | null) {
  // One socket for the app's lifetime, shared by the index and the open wave (R2).
  const websocket = useMemo(() => new HocuspocusProviderWebsocket({ url: COLLAB_URL }), []);
  const ydoc = useMemo(() => new Y.Doc(), []);
  const wavesMap = useMemo(() => ydoc.getMap<Y.Map<unknown>>("waves"), [ydoc]);

  const [waves, setWaves] = useState<WaveSummary[]>([]);
  const [presence, setPresence] = useState<Set<string>>(new Set());
  // Bump to recompute unread (localStorage is not reactive on its own).
  const [seenTick, setSeenTick] = useState(0);

  const providerRef = useRef<HocuspocusProvider | null>(null);

  useEffect(() => {
    const provider = new HocuspocusProvider({
      websocketProvider: websocket,
      name: "index",
      document: ydoc,
    });
    providerRef.current = provider;
    provider.setAwarenessField("user", { name: me.name });

    const refresh = () => {
      const summaries: WaveSummary[] = [];
      wavesMap.forEach((entry, id) => summaries.push({ id, ...readMeta(entry) }));
      setWaves(sortWaves(summaries));
    };
    wavesMap.observeDeep(refresh);
    refresh();

    const awareness = provider.awareness;
    const myId = awareness?.clientID;
    const refreshPresence = () => {
      if (!awareness) return;
      const states = Array.from(awareness.getStates().entries()) as Array<
        [number, IndexPresenceState]
      >;
      const here = new Set<string>();
      for (const [id, s] of states) {
        if (id === myId) continue; // don't count myself (R6.4)
        if (s.openWave) here.add(s.openWave);
      }
      setPresence(here);
    };
    awareness?.on("change", refreshPresence);
    refreshPresence();

    return () => {
      wavesMap.unobserveDeep(refresh);
      awareness?.off("change", refreshPresence);
      provider.destroy();
      providerRef.current = null;
    };
  }, [ydoc, wavesMap, websocket, me.name]);

  // Publish which wave I currently have open, over index awareness (R6.2).
  useEffect(() => {
    providerRef.current?.setAwarenessField("openWave", openWaveId ?? null);
  }, [openWaveId]);

  const createWave = useCallback(
    (title?: string): string => {
      const id = crypto.randomUUID().slice(0, 8);
      const now = Date.now();
      ydoc.transact(() => {
        const entry = new Y.Map<unknown>();
        wavesMap.set(id, entry);
        writeMeta(entry, {
          title: title?.trim() ?? "",
          createdAt: now,
          lastActivity: now,
          blipCount: 0,
          lastSnippet: "",
          lastAuthor: "",
          participants: [],
        });
      });
      return id;
    },
    [ydoc, wavesMap],
  );

  const renameWave = useCallback(
    (id: string, title: string): void => {
      const entry = wavesMap.get(id);
      if (entry) entry.set("title", title.trim());
    },
    [wavesMap],
  );

  /** Fold a newly added blip into the wave's index summary (R1.3/R1.4). */
  const recordBlip = useCallback(
    (waveId: string, blip: BlipMetaInput): void => {
      ydoc.transact(() => {
        let entry = wavesMap.get(waveId);
        if (!entry) {
          entry = new Y.Map<unknown>();
          wavesMap.set(waveId, entry);
        }
        const next = applyBlipToMeta(entry.has("blipCount") ? readMeta(entry) : undefined, blip);
        writeMeta(entry, next);
      });
    },
    [ydoc, wavesMap],
  );

  /** Advance last-seen because *I* posted, so my own blips never show as unread (R5.3). */
  const markSeenMine = useCallback(
    (waveId: string): void => {
      const entry = wavesMap.get(waveId);
      const count = entry ? ((entry.get("blipCount") as number | undefined) ?? 0) : 0;
      writeSeen(waveId, count);
      setSeenTick((t) => t + 1);
    },
    [wavesMap],
  );

  /** Mark a wave fully read: last-seen catches up to the current blip count (R5.2). */
  const markRead = useCallback(
    (waveId: string): void => {
      const entry = wavesMap.get(waveId);
      const count = entry ? ((entry.get("blipCount") as number | undefined) ?? 0) : 0;
      writeSeen(waveId, count);
      setSeenTick((t) => t + 1);
    },
    [wavesMap],
  );

  const unreadOf = useCallback(
    (waveId: string): number => {
      // seenTick is read so this recomputes when last-seen changes.
      void seenTick;
      const summary = waves.find((w) => w.id === waveId);
      if (!summary) return 0;
      return unreadCount(summary.blipCount, readSeen(waveId));
    },
    [waves, seenTick],
  );

  return {
    waves,
    presence,
    websocket,
    createWave,
    renameWave,
    recordBlip,
    markSeenMine,
    markRead,
    unreadOf,
  };
}
