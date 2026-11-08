import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider, type HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { applyDiff } from "./applyDiff";
import { resolveLocks, type EditClaim } from "./resolveLocks";
import type { BlipKind, BlipView, TypingTarget, TyperView } from "./types";

/** Reported to the index layer whenever this client adds a blip (multi-wave, R1.3/R5.3). */
export interface AddedBlip {
  author: string;
  text: string;
  at: number;
}

/** A live background connection the inbox already holds for a joined wave. */
export interface SharedConn {
  provider: HocuspocusProvider;
  doc: Y.Doc;
}

export interface UseWaveOptions {
  /**
   * Share one socket across the index and the open wave (multi-wave R2). When given, the
   * provider attaches to this socket instead of opening its own connection to COLLAB_URL.
   */
  websocket?: HocuspocusProviderWebsocket;
  /**
   * Reuse the inbox's existing background connection for this wave instead of attaching a
   * second provider with the same document name to the shared socket. The shared socket
   * keys its providerMap by document name (one provider per name), so a second provider for
   * an already-joined wave collides with the background one and never syncs. Returns null
   * until the inbox's reconcile effect has created the connection (a tick after join), so
   * useWave retries briefly. See useMyWaves.getConn.
   */
  getConn?: (waveId: string) => SharedConn | null;
  /** Called after this client adds a blip, so App can update the shared wave index. */
  onBlipAdded?: (blip: AddedBlip) => void;
}

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? "ws://127.0.0.1:1234";

// Keep presence light: at most one awareness broadcast per this interval while typing.
const TYPING_THROTTLE_MS = 400;
// Auto-clear a typing indicator after this long without a keystroke.
const TYPING_IDLE_MS = 4000;
// Auto-release an edit lock after this long without a keystroke.
const EDIT_IDLE_MS = 10000;

function readBlips(arr: Y.Array<Y.Map<unknown>>): BlipView[] {
  return arr.toArray().map((m) => ({
    id: m.get("id") as string,
    parentId: (m.get("parentId") as string | null) ?? null,
    author: m.get("author") as string,
    kind: m.get("kind") as BlipKind,
    text: (m.get("text") as Y.Text | undefined)?.toString() ?? "",
    createdAt: m.get("createdAt") as number,
    sources: (m.get("sources") as string[] | undefined) ?? [],
  }));
}

/** Shape of the fields we put on our own awareness state. */
interface PresenceState {
  user?: { name?: string };
  typing?: TypingTarget | null;
  editing?: string | null;
}

export function useWave(waveId: string, me: { name: string }, options: UseWaveOptions = {}) {
  const { websocket, getConn, onBlipAdded } = options;

  // The active connection for this wave. Prefer the inbox's existing background connection
  // (getConn) so we don't attach a second provider with the same document name to the shared
  // socket — that collision was leaving a just-joined wave stuck on "connecting". The
  // connection may not exist on the first render after join (the inbox creates it a tick
  // later), so we resolve it in an effect with a brief retry and hold it in state. Without a
  // getConn (e.g. tests, single-wave use) we own a provider on the shared socket or our own
  // URL connection, exactly as before.
  const [conn, setConn] = useState<{ provider: HocuspocusProvider; doc: Y.Doc } | null>(null);
  // getConn is read inside an effect; keep the latest without re-subscribing the effect.
  const getConnRef = useRef(getConn);
  getConnRef.current = getConn;

  const ydoc = conn?.doc ?? null;
  const blipsArr = useMemo(() => ydoc?.getArray<Y.Map<unknown>>("blips") ?? null, [ydoc]);
  // Per-wave metadata lives inside the wave's own doc (multi-wave R2): title + createdAt.
  const metaMap = useMemo(() => ydoc?.getMap<unknown>("meta") ?? null, [ydoc]);
  const [blips, setBlips] = useState<BlipView[]>([]);
  const [peers, setPeers] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("connecting");
  const [typers, setTypers] = useState<TyperView[]>([]);
  const [editors, setEditors] = useState<Map<string, string>>(new Map());
  const [meta, setMeta] = useState<{ title: string; createdAt: number }>({
    title: "",
    createdAt: 0,
  });

  // Live handle to the provider so the setTyping/setEditing callbacks can reach awareness.
  const providerRef = useRef<HocuspocusProvider | null>(null);
  // Keep the latest onBlipAdded reachable from the stable addBlip callback.
  const onBlipAddedRef = useRef(onBlipAdded);
  onBlipAddedRef.current = onBlipAdded;
  // Throttle + idle bookkeeping for typing.
  const lastTypingTarget = useRef<TypingTarget | null>(null);
  const typingThrottleUntil = useRef(0);
  const typingIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the connection for this wave. If getConn is supplied, reuse the inbox's
  // background provider+doc (retrying briefly until it exists); otherwise create our own.
  useEffect(() => {
    let cancelled = false;
    let owned: { provider: HocuspocusProvider; doc: Y.Doc } | null = null;

    const resolve = getConnRef.current;
    if (resolve) {
      let attempts = 0;
      const tryResolve = () => {
        if (cancelled) return;
        const shared = resolve(waveId);
        if (shared) {
          setConn(shared);
          return;
        }
        if (attempts++ < 40) queueMicrotask(tryResolve);
      };
      tryResolve();
    } else {
      // No shared connection available: own one (shared socket if given, else our own URL).
      const doc = new Y.Doc();
      const provider = websocket
        ? new HocuspocusProvider({ websocketProvider: websocket, name: waveId, document: doc })
        : new HocuspocusProvider({ url: COLLAB_URL, name: waveId, document: doc });
      owned = { provider, doc };
      setConn(owned);
    }

    return () => {
      cancelled = true;
      setConn(null);
      // Only tear down a connection WE created. A reused background connection is owned by
      // the inbox (useMyWaves) and must outlive this panel.
      if (owned) {
        owned.provider.destroy();
        owned.doc.destroy();
      }
    };
  }, [waveId, websocket]);

  useEffect(() => {
    if (!conn || !blipsArr || !metaMap) return;
    const provider = conn.provider;
    providerRef.current = provider;
    const onStatus = ({ status }: { status: string }) => setStatus(status);
    provider.on("status", onStatus);
    // A reused background provider may already be synced; seed status from it.
    setStatus((provider as unknown as { status?: string }).status ?? "connecting");
    provider.setAwarenessField("user", { name: me.name });

    const refresh = () => setBlips(readBlips(blipsArr));
    blipsArr.observeDeep(refresh);
    refresh();

    const refreshMeta = () =>
      setMeta({
        title: (metaMap.get("title") as string | undefined) ?? "",
        createdAt: (metaMap.get("createdAt") as number | undefined) ?? 0,
      });
    metaMap.observe(refreshMeta);
    refreshMeta();

    const awareness = provider.awareness;
    const myId = awareness?.clientID;

    const refreshPresence = () => {
      if (!awareness) return;
      const states = Array.from(awareness.getStates().entries()) as Array<[number, PresenceState]>;

      // Peers: everyone with a name.
      setPeers(
        states
          .map(([, s]) => s.user?.name)
          .filter((n): n is string => Boolean(n)),
      );

      // Typers: everyone except me who has a typing target set.
      setTypers(
        states
          .filter(([id, s]) => id !== myId && s.typing != null && s.user?.name)
          .map(([, s]) => ({ target: s.typing as TypingTarget, name: s.user!.name as string })),
      );

      // Editors: resolve lock claims deterministically, then drop my own id so I never
      // see my own box as locked.
      const claims: EditClaim[] = states
        .filter(([, s]) => s.editing != null && s.user?.name)
        .map(([id, s]) => ({ clientID: id, blipId: s.editing as string, name: s.user!.name as string }));
      const holders = resolveLocks(claims);
      const visible = new Map<string, string>();
      for (const [blipId, holder] of holders) {
        if (holder.clientID !== myId) visible.set(blipId, holder.name);
      }
      setEditors(visible);
    };
    awareness?.on("change", refreshPresence);
    refreshPresence();

    return () => {
      blipsArr.unobserveDeep(refresh);
      metaMap.unobserve(refreshMeta);
      awareness?.off("change", refreshPresence);
      provider.off("status", onStatus);
      // Clear only awareness fields WE set, so a reused background connection is left clean
      // (it keeps publishing just `user`; typing/editing must not linger after we unmount).
      awareness?.setLocalStateField("typing", null);
      awareness?.setLocalStateField("editing", null);
      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
      if (editIdleTimer.current) clearTimeout(editIdleTimer.current);
      providerRef.current = null;
    };
  }, [conn, blipsArr, metaMap, me.name]);

  /** Rename the wave by editing its own `meta.title` (multi-wave R2.3). */
  const renameMeta = useCallback(
    (title: string) => {
      metaMap?.set("title", title.trim());
    },
    [metaMap],
  );

  const addBlip = useCallback(
    (opts: { parentId: string | null; text: string; author: string; kind?: BlipKind; sources?: string[] }) => {
      if (!ydoc || !blipsArr) return "";
      const id = crypto.randomUUID().slice(0, 8);
      const blip = new Y.Map<unknown>();
      ydoc.transact(() => {
        blipsArr.push([blip]);
        blip.set("id", id);
        blip.set("parentId", opts.parentId);
        blip.set("author", opts.author);
        blip.set("kind", opts.kind ?? "human");
        blip.set("createdAt", Date.now());
        blip.set("sources", opts.sources ?? []);
        blip.set("text", new Y.Text(opts.text));
      });
      onBlipAddedRef.current?.({ author: opts.author, text: opts.text, at: Date.now() });
      return id;
    },
    [ydoc, blipsArr],
  );

  const editBlip = useCallback(
    (id: string, text: string) => {
      if (!blipsArr) return;
      const m = blipsArr.toArray().find((b) => b.get("id") === id);
      const t = m?.get("text") as Y.Text | undefined;
      if (t) applyDiff(t, text);
    },
    [blipsArr],
  );

  /**
   * Broadcast where (if anywhere) I am composing. Pass a parent blip id, "root" for a
   * new top-level blip, or null to clear. Updates are throttled and auto-clear after
   * ~4s of inactivity; sending, emptying, or blurring should call this with null.
   */
  const setTyping = useCallback((target: TypingTarget | null) => {
    const awareness = providerRef.current?.awareness;
    if (!awareness) return;

    if (typingIdleTimer.current) {
      clearTimeout(typingIdleTimer.current);
      typingIdleTimer.current = null;
    }

    if (target == null) {
      lastTypingTarget.current = null;
      typingThrottleUntil.current = 0;
      awareness.setLocalStateField("typing", null);
      return;
    }

    // Throttle: skip a broadcast if the target is unchanged and we broadcast recently.
    const now = Date.now();
    const changed = target !== lastTypingTarget.current;
    if (changed || now >= typingThrottleUntil.current) {
      lastTypingTarget.current = target;
      typingThrottleUntil.current = now + TYPING_THROTTLE_MS;
      awareness.setLocalStateField("typing", target);
    }

    // Reset the idle timer on every keystroke.
    typingIdleTimer.current = setTimeout(() => {
      lastTypingTarget.current = null;
      typingThrottleUntil.current = 0;
      providerRef.current?.awareness?.setLocalStateField("typing", null);
    }, TYPING_IDLE_MS);
  }, []);

  /**
   * Claim or release an edit lock on a blip. Pass a blip id to claim, null to release.
   * The lock auto-releases after ~10s without a keystroke. Call again (with the same id)
   * on each keystroke to keep it alive.
   */
  const setEditing = useCallback((blipId: string | null) => {
    const awareness = providerRef.current?.awareness;
    if (!awareness) return;

    if (editIdleTimer.current) {
      clearTimeout(editIdleTimer.current);
      editIdleTimer.current = null;
    }

    awareness.setLocalStateField("editing", blipId);
    if (blipId == null) return;

    editIdleTimer.current = setTimeout(() => {
      providerRef.current?.awareness?.setLocalStateField("editing", null);
    }, EDIT_IDLE_MS);
  }, []);

  return {
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
  };
}
