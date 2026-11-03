import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { applyDiff } from "./applyDiff";
import type { BlipKind, BlipView } from "./types";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? "ws://127.0.0.1:1234";

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

export function useWave(waveId: string, me: { name: string }) {
  const ydoc = useMemo(() => new Y.Doc(), [waveId]);
  const blipsArr = useMemo(() => ydoc.getArray<Y.Map<unknown>>("blips"), [ydoc]);
  const [blips, setBlips] = useState<BlipView[]>([]);
  const [peers, setPeers] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("connecting");

  useEffect(() => {
    const provider = new HocuspocusProvider({ url: COLLAB_URL, name: waveId, document: ydoc });
    provider.on("status", ({ status }: { status: string }) => setStatus(status));
    provider.setAwarenessField("user", { name: me.name });

    const refresh = () => setBlips(readBlips(blipsArr));
    blipsArr.observeDeep(refresh);
    refresh();

    const awareness = provider.awareness;
    const refreshPeers = () => {
      if (!awareness) return;
      const names = Array.from(awareness.getStates().values())
        .map((s) => (s as { user?: { name?: string } }).user?.name)
        .filter((n): n is string => Boolean(n));
      setPeers(names);
    };
    awareness?.on("change", refreshPeers);
    refreshPeers();

    return () => {
      blipsArr.unobserveDeep(refresh);
      awareness?.off("change", refreshPeers);
      provider.destroy();
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

  return { blips, peers, status, addBlip, editBlip };
}
