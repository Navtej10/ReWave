import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { applyDiff } from "./applyDiff";
import { resolveLocks, type EditClaim } from "./resolveLocks";
import type { BlipKind, BlipView, TypingTarget, TyperView } from "./types";

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

export function useWave(waveId: string, me: { name: string }) {
  const ydoc = useMemo(() => new Y.Doc(), [waveId]);
  const blipsArr = useMemo(() => ydoc.getArray<Y.Map<unknown>>("blips"), [ydoc]);
  const [blips, setBlips] = useState<BlipView[]>([]);
  const [peers, setPeers] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("connecting");
  const [typers, setTypers] = useState<TyperView[]>([]);
  const [editors, setEditors] = useState<Map<string, string>>(new Map());

  // Live handle to the provider so the setTyping/setEditing callbacks can reach awareness.
  const providerRef = useRef<HocuspocusProvider | null>(null);
  // Throttle + idle bookkeeping for typing.
  const lastTypingTarget = useRef<TypingTarget | null>(null);
  const typingThrottleUntil = useRef(0);
  const typingIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const provider = new HocuspocusProvider({ url: COLLAB_URL, name: waveId, document: ydoc });
    providerRef.current = provider;
    provider.on("status", ({ status }: { status: string }) => setStatus(status));
    provider.setAwarenessField("user", { name: me.name });

    const refresh = () => setBlips(readBlips(blipsArr));
    blipsArr.observeDeep(refresh);
    refresh();

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
      awareness?.off("change", refreshPresence);
      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
      if (editIdleTimer.current) clearTimeout(editIdleTimer.current);
      provider.destroy();
      providerRef.current = null;
    };
  }, [waveId, ydoc, blipsArr, me.name]);

  const addBlip = useCallback(
    (opts: { parentId: string | null; text: string; author: string; kind?: BlipKind; sources?: string[] }) => {
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
      return id;
    },
    [ydoc, blipsArr],
  );

  const editBlip = useCallback(
    (id: string, text: string) => {
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

  return { blips, peers, status, typers, editors, addBlip, editBlip, setTyping, setEditing };
}
