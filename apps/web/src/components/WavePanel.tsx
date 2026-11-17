import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { useWave, type AddedBlip, type SharedConn } from "../wave/useWave";
import { askAgent, mentionedAgents } from "../wave/agents";
import { loadLastVisit, newSince, saveLastVisit } from "../wave/catchUp";
import { IMPORT_AUTHOR, type ImportedMessage } from "../wave/importThread";
import { buildInviteLink } from "../wave/waveId";
import { deriveTitle } from "../wave/waveIndex";
import {
  createAttachment,
  deriveKind,
  nameScreenshot,
  planAttachments,
  probeMedia,
  revokeIfBlob,
  type AddFilesOptions,
} from "../wave/attachments";
import { uid } from "../wave/format";
import { stanceCounts, stanceSummaryText } from "../wave/polls";
import { UploadQueue, createHttpUploadService, type UploadService, type UploadUpdate } from "../wave/uploadService";
import type { AgentName, Attachment, BlipView, CodeSnippet, LinkPreview, Poll } from "../wave/types";
import { ConnectionStatus } from "./ConnectionStatus";
import { PeopleMenu } from "./PeopleMenu";
import { DecisionLog, PinnedPanel } from "./DecisionLog";
import { DisconnectedBanner } from "./DisconnectedBanner";
import { AgentFailures, AgentThinking, type AgentFailure, type PendingAgent } from "./AgentStatus";
import { CatchUpCard } from "./CatchUpCard";
import { ImportThread } from "./ImportThread";
import { ReplayView } from "./ReplayView";
import { SpecExportView } from "./SpecExportView";
import { BlipNode } from "./BlipNode";
import type { BlipActions } from "./BlipCard";
import { TypingBubble } from "./TypingBubble";
import { EmptyState } from "./EmptyState";
import { Composer } from "./Composer";
import { WaveTitle } from "./WaveTitle";
import { StanceSummary } from "./StanceChips";
import { MediaTab, PANEL_ID, PollsTab, WaveTabs, tabId, type WaveTab } from "./MediaTab";
import { DropOverlay, useFileDrop } from "./rich/DropOverlay";
import { Lightbox } from "./rich/Lightbox";
import { SketchPad } from "./rich/SketchPad";
import { extractFencedCode } from "./rich/markdownLite";
import { BackIcon } from "./icons";
import { Button } from "./ui/index";

/** Long threads render the newest N top-level blips; "Show earlier" reveals more. */
const PAGE_SIZE = 40;

/** One upload service for the app. Swap here for S3 / another backend. */
const UPLOADS: UploadService = createHttpUploadService("/api/uploads");

/** A file this browser is uploading (or has uploaded) for this wave. */
interface LocalUpload {
  attachment: Attachment;
  /** blob: URL for instant previews; revoked when the item leaves the tray unsent. */
  blobUrl: string;
}

/** A minimal human BlipView, for snapshots sent to agents before the synced copy arrives. */
function plainBlip(id: string, author: string, text: string): BlipView {
  return {
    id,
    parentId: null,
    author,
    kind: "human",
    text,
    createdAt: Date.now(),
    sources: [],
    contentKind: "text",
    attachments: [],
    reactions: {},
    stances: {},
    pinned: false,
    editedBy: [],
    deleted: false,
  };
}

/** The open wave (right panel). One instance per wave id — remounted via `key` on switch,
 *  so its provider, typing and edit-lock state are fully fresh (multi-wave R9.5). The title
 *  is read from and written to the wave's own `meta` map. */
export function WavePanel(props: {
  waveId: string;
  me: { name: string };
  websocket: HocuspocusProviderWebsocket;
  getConn: (waveId: string) => SharedConn | null;
  onBlipAdded: (blip: AddedBlip) => void;
  onBack: () => void;
  onLeave: () => void;
}) {
  const { waveId, me, websocket, getConn, onBlipAdded, onBack, onLeave } = props;
  const wave = useWave(waveId, me, { websocket, getConn, onBlipAdded });
  const { blips, decisions, replays, saveReplay, people, status, typers, editors, meta, addBlip, setTyping, renameMeta } = wave;

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingAgent[]>([]);
  const [failures, setFailures] = useState<AgentFailure[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [replayDecisionId, setReplayDecisionId] = useState<string | null>(null);
  const [exportDecisionId, setExportDecisionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<WaveTab>("thread");
  const [uploads, setUploads] = useState<Record<string, LocalUpload>>({});
  const [trayIds, setTrayIds] = useState<string[]>([]);
  const [link, setLink] = useState<LinkPreview | null>(null);
  const [pollDraft, setPollDraft] = useState<Poll | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [sketch, setSketch] = useState<{ background?: Attachment; replyToId?: string } | null>(null);
  const [lightbox, setLightbox] = useState<{ items: Attachment[]; index: number } | null>(null);
  const [jump, setJump] = useState<{ id: string; n: number } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [shownRoots, setShownRoots] = useState(PAGE_SIZE);

  const online = status === "connected";

  /* ---------- Uploads ---------- */

  // Latest values for callbacks that outlive a render (upload events, unmount).
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;
  const trayRef = useRef(trayIds);
  trayRef.current = trayIds;
  const updateAttachmentRef = useRef(wave.updateAttachment);
  updateAttachmentRef.current = wave.updateAttachment;
  /** attachment id -> blip id, once the attachment has been sent. */
  const sentRef = useRef(new Map<string, string>());
  /** Last status written to the doc, so progress ticks never hit the network. */
  const syncedStatus = useRef(new Map<string, string>());

  const queueRef = useRef<UploadQueue | null>(null);
  if (queueRef.current === null) {
    queueRef.current = new UploadQueue(UPLOADS, (u: UploadUpdate) => {
      setUploads((prev) => {
        const cur = prev[u.id];
        if (!cur) return prev;
        const attachment: Attachment = { ...cur.attachment, status: u.status, progress: u.progress, url: u.url ?? cur.attachment.url };
        return { ...prev, [u.id]: { ...cur, attachment } };
      });
      if (u.status === "failed") {
        const name = uploadsRef.current[u.id]?.attachment.name ?? "a file";
        setNotice(`Couldn\u2019t upload ${name}${u.error ? `: ${u.error}` : ""}. Use Retry to try again.`);
      }
      const blipId = sentRef.current.get(u.id);
      if (blipId && u.status !== "queued" && syncedStatus.current.get(u.id) !== u.status) {
        syncedStatus.current.set(u.id, u.status);
        updateAttachmentRef.current(blipId, u.id, { status: u.status, url: u.url ?? "" });
      }
    });
  }

  // Queued uploads start the moment the wave is connected.
  useEffect(() => {
    queueRef.current?.setOnline(online);
  }, [online]);

  // On leaving the wave, drop unsent tray items. Uploads already sent keep going: they patch the
  // wave's doc, which the inbox's background connection keeps alive.
  useEffect(
    () => () => {
      for (const id of trayRef.current) {
        queueRef.current?.cancel(id);
        revokeIfBlob(uploadsRef.current[id]?.blobUrl);
      }
    },
    [],
  );

  const patchLocal = useCallback((id: string, patch: Partial<Attachment>) => {
    setUploads((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], attachment: { ...prev[id].attachment, ...patch } } } : prev));
    const blipId = sentRef.current.get(id);
    if (blipId) updateAttachmentRef.current(blipId, id, patch);
  }, []);

  const addFiles = useCallback(
    (files: File[], options?: AddFilesOptions) => {
      const plan = planAttachments(trayRef.current.length, files, options?.kind);
      if (plan.errors.length > 0) setNotice(plan.errors.join(" "));
      if (plan.accepted.length === 0) return;
      const created = plan.accepted.map(({ file, kind }) => {
        const f = kind === "screenshot" ? nameScreenshot(file) : file;
        return { file: f, attachment: createAttachment(uid("att"), f, kind, options?.durationSec) };
      });
      setUploads((prev) => {
        const next = { ...prev };
        for (const c of created) next[c.attachment.id] = { attachment: c.attachment, blobUrl: c.attachment.url };
        return next;
      });
      setTrayIds((prev) => [...prev, ...created.map((c) => c.attachment.id)]);
      for (const { file, attachment } of created) {
        queueRef.current?.enqueue(attachment.id, file);
        void probeMedia(attachment.kind, attachment.url).then((m) => {
          const patch: Partial<Attachment> = {};
          if (m.width) patch.width = m.width;
          if (m.height) patch.height = m.height;
          if (m.durationSec && !attachment.durationSec) patch.durationSec = m.durationSec;
          if (Object.keys(patch).length > 0) patchLocal(attachment.id, patch);
        });
      }
    },
    [patchLocal],
  );

  const removeFromTray = useCallback((id: string) => {
    queueRef.current?.cancel(id);
    revokeIfBlob(uploadsRef.current[id]?.blobUrl);
    setTrayIds((prev) => prev.filter((x) => x !== id));
    setUploads((prev) => {
      const { [id]: _gone, ...rest } = prev;
      return rest;
    });
  }, []);

  const retryUpload = useCallback((id: string) => {
    setNotice(null);
    queueRef.current?.retry(id);
  }, []);

  const drop = useFileDrop(addFiles);

  /* ---------- Derived thread ---------- */

  // Overlay this browser's live upload state (progress, local preview) on the synced blips.
  const viewBlips = useMemo(
    () =>
      blips.map((b) =>
        b.attachments.some((a) => uploads[a.id])
          ? {
              ...b,
              attachments: b.attachments.map((a) => {
                const local = uploads[a.id]?.attachment;
                return local ? { ...a, status: local.status, progress: local.progress, url: a.url || local.url } : a;
              }),
            }
          : b,
      ),
    [blips, uploads],
  );

  const byId = useMemo(() => new Map(viewBlips.map((b) => [b.id, b])), [viewBlips]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, BlipView[]>();
    for (const b of viewBlips) {
      if (!b.parentId) continue;
      const list = map.get(b.parentId);
      if (list) list.push(b);
      else map.set(b.parentId, [b]);
    }
    return map;
  }, [viewBlips]);
  const decidedIds = useMemo(() => new Set(decisions.map((d) => d.sourceBlipId)), [decisions]);
  const pinned = useMemo(() => viewBlips.filter((b) => b.pinned && !b.deleted), [viewBlips]);
  const liveBlips = useMemo(() => viewBlips.filter((b) => !b.deleted), [viewBlips]);
  // Closes by itself if the open decision is removed (here or by someone else).
  const replayDecision = replayDecisionId ? (decisions.find((d) => d.id === replayDecisionId) ?? null) : null;
  const exportDecision = exportDecisionId ? (decisions.find((d) => d.id === exportDecisionId) ?? null) : null;

  const firstText = liveBlips.find((b) => b.text.trim())?.text ?? liveBlips[0]?.poll?.question ?? "";
  const title = deriveTitle({ title: meta.title, lastSnippet: firstText });
  const rawTitle = meta.title;

  const roots = viewBlips.filter((b) => b.parentId === null && (!b.deleted || childrenOf.has(b.id)));
  const visibleRoots = roots.length > shownRoots ? roots.slice(roots.length - shownRoots) : roots;
  const hiddenRoots = roots.length - visibleRoots.length;
  const rootTypers = typers.filter((t) => t.target === "root");
  const replyTo = replyToId ? (byId.get(replyToId) ?? null) : null;
  const trayAttachments = trayIds.map((id) => uploads[id]?.attachment).filter((a): a is Attachment => Boolean(a));

  /* ---------- Jump to a blip ---------- */

  const jumpTo = useCallback((blipId: string) => {
    setTab("thread");
    setShownRoots(Number.MAX_SAFE_INTEGER); // the target may sit in the collapsed "earlier" part
    setJump((j) => ({ id: blipId, n: (j?.n ?? 0) + 1 }));
  }, []);

  /** Blip to scroll to once it shows up in the thread (e.g. a summary the user just asked for). */
  const [revealId, setRevealId] = useState<string | null>(null);
  useEffect(() => {
    if (revealId && liveBlips.some((b) => b.id === revealId)) {
      setRevealId(null);
      jumpTo(revealId);
    }
  }, [revealId, liveBlips, jumpTo]);
  useEffect(() => {
    if (!jump) return;
    const li = document.getElementById(`b-${jump.id}`);
    const card = li?.querySelector<HTMLElement>(":scope > .rw-blip-card, :scope > .rc-acard") ?? li;
    if (!card) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    card.focus({ preventScroll: true });
    setHighlightId(jump.id);
    const t = window.setTimeout(() => setHighlightId((cur) => (cur === jump.id ? null : cur)), 1800);
    return () => window.clearTimeout(t);
  }, [jump]);

  /* ---------- Posting ---------- */

  /** Latest thread for callbacks that run after an await (agent retry, digest). */
  const liveRef = useRef(liveBlips);
  liveRef.current = liveBlips;

  /**
   * Ask one agent about `snapshot` and post its answer under `parentId`. Only ever called from a
   * human action (a mention, a button, an import). Failures never remove the human's blip.
   */
  const runAgent = useCallback(
    async (agent: AgentName, parentId: string | null, snapshot: BlipView[], revealResult = false) => {
      const key = uid("run");
      setFailures((prev) => prev.filter((f) => !(f.agent === agent && f.parentId === parentId)));
      setPending((prev) => [...prev, { key, agent, parentId }]);
      try {
        const out = await askAgent(agent, snapshot, stanceSummaryText(stanceCounts(snapshot)), {
          onStatus: (status) => setPending((prev) => prev.map((p) => (p.key === key ? { ...p, status } : p))),
        });
        if (!out.text.trim() && !out.card) throw new Error(`@${agent} had nothing to add. Try again.`);
        const newId = actionsRef.current.addBlip({
          parentId,
          text: out.text,
          author: `@${agent}`,
          kind: "agent",
          sources: out.sources,
          card: out.card,
        });
        if (revealResult && newId) setRevealId(newId);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setFailures((prev) => [...prev, { key, agent, parentId, message }]);
      } finally {
        setPending((prev) => prev.filter((p) => p.key !== key));
      }
    },
    [],
  );

  function runAgents(blipId: string, text: string, posted: BlipView) {
    const snapshot = [...liveBlips, posted];
    for (const agent of mentionedAgents(text)) void runAgent(agent, blipId, snapshot);
  }

  const retryAgent = useCallback(
    (f: AgentFailure) => {
      setFailures((prev) => prev.filter((x) => x.key !== f.key));
      void runAgent(f.agent, f.parentId, liveRef.current);
    },
    [runAgent],
  );

  const scribeBusy = pending.some((p) => p.agent === "scribe");

  /* ---------- Catch-up digest (spec 04 R2) ---------- */
  // When this browser last looked at the wave. Read once; saved again when the panel closes.
  const [lastVisit] = useState(() => loadLastVisit(localStorage, waveId));
  const [openedAt] = useState(() => Date.now());
  useEffect(() => {
    const save = () => saveLastVisit(localStorage, waveId, Date.now());
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [waveId]);
  // Only blips that existed when the panel opened: blips arriving live are not "missed".
  const missed = useMemo(
    () => newSince(liveBlips, lastVisit, me.name).filter((b) => b.createdAt <= openedAt),
    [liveBlips, lastVisit, me.name, openedAt],
  );

  /* ---------- Import a pasted thread (spec 04 R3) ---------- */
  function importThread(messages: ImportedMessage[]) {
    setImportOpen(false);
    const snapshot: BlipView[] = [];
    for (const m of messages) {
      // Imported speakers are labelled so nobody can be impersonated by a paste.
      const author = m.author === IMPORT_AUTHOR ? IMPORT_AUTHOR : `${m.author} (imported)`;
      const id = addBlip({ parentId: null, text: m.text, author });
      if (!id) {
        setNotice("Still connecting to the wave. Try the import again in a moment.");
        return;
      }
      snapshot.push(plainBlip(id, author, m.text));
    }
    const last = snapshot[snapshot.length - 1];
    if (last) void runAgent("scribe", last.id, snapshot);
  }
  function send() {
    const { text, code } = extractFencedCode(draft.trim());
    const attachments = trayAttachments;
    if (!text && !code && attachments.length === 0 && !pollDraft) return;
    const parentId = replyTo?.id ?? null;
    const content: { attachments: Attachment[]; poll?: Poll; link?: LinkPreview; code?: CodeSnippet } = {
      attachments,
      poll: pollDraft ?? undefined,
      link: link ?? undefined,
      code,
    };
    const id = addBlip({ parentId, text, author: me.name, ...content });
    if (!id) {
      setNotice("Still connecting to the wave. Try again in a moment.");
      return;
    }
    for (const a of attachments) {
      sentRef.current.set(a.id, id);
      syncedStatus.current.set(a.id, a.status === "queued" ? "uploading" : a.status);
    }
    const posted: BlipView = {
      id,
      parentId,
      author: me.name,
      kind: "human",
      text,
      createdAt: Date.now(),
      sources: [],
      contentKind: deriveKind(content),
      ...content,
      attachments,
      reactions: {},
      stances: {},
      pinned: false,
      editedBy: [],
      deleted: false,
    };
    runAgents(id, text, posted);
    setDraft("");
    setTrayIds([]);
    setLink(null);
    setPollDraft(null);
    setReplyToId(null);
    setTyping(null);
    setTab("thread");
  }

  /* ---------- Blip actions (stable) ---------- */

  const actionsRef = useRef(wave);
  actionsRef.current = wave;
  const actions = useMemo<BlipActions>(
    () => ({
      onReact: (id, key) => actionsRef.current.toggleReaction(id, key),
      onStance: (id, stance) => actionsRef.current.setStance(id, stance),
      onReply: (blip) => setReplyToId(blip.id),
      onTogglePin: (id) => actionsRef.current.togglePin(id),
      onDelete: (id) => actionsRef.current.deleteBlip(id),
      onEdit: (id, text) => actionsRef.current.editBlip(id, text),
      setEditing: (id) => actionsRef.current.setEditing(id),
      onVote: (id, optionId) => actionsRef.current.vote(id, optionId),
      onClosePoll: (id) => actionsRef.current.closePoll(id),
      onAddDecisions: (id, texts, label) =>
        actionsRef.current.addDecisions(texts.map((text) => ({ text, sourceBlipId: id, sourceLabel: label }))),
      onOpenMedia: (items, index) => setLightbox({ items, index }),
      onAnnotate: (id, attachment) => setSketch({ background: attachment, replyToId: id }),
      onJump: jumpTo,
      onAltChange: (id, attachmentId, alt) => actionsRef.current.updateAttachment(id, attachmentId, { alt: alt || undefined }),
      onRetryAttachment: retryUpload,
      canRetry: (attachmentId) => Boolean(uploadsRef.current[attachmentId]),
    }),
    [jumpTo, retryUpload],
  );

  const threadEmpty = roots.length === 0 && rootTypers.length === 0;

  return (
    <section className="rw-wavepanel rc-dropzone" aria-label={`Wave ${title}`} {...drop.bind}>
      <div className="rw-wavepanel-bar">
        <button type="button" className="rw-back" onClick={onBack}>
          <BackIcon className="rw-back-icon" />
          <span>Waves</span>
        </button>
        <WaveTitle title={title} rawTitle={rawTitle} onRename={renameMeta} />
        <div className="rw-wavepanel-meta">
          <ConnectionStatus status={status} />
          <PeopleMenu people={people} />
          <WaveActions waveId={waveId} onLeave={onLeave} onImport={() => setImportOpen(true)} />
        </div>
      </div>

      <div className="rw-wavepanel-scroll">
        <div className="rw-column">
          <DisconnectedBanner status={status} />
          <CatchUpCard
            fresh={missed}
            busy={scribeBusy}
            onDigest={() => void runAgent("scribe", null, missed)}
            onJumpFirst={() => missed[0] && jumpTo(missed[0].id)}
          />
          <DecisionLog
            decisions={decisions}
            blips={blips}
            myName={me.name}
            onJump={jumpTo}
            onAdd={(text) => wave.addDecisions([{ text }])}
            onRemove={wave.removeDecision}
            onReplay={(d) => setReplayDecisionId(d.id)}
            onExportSpec={(d) => setExportDecisionId(d.id)}
            onAskScribe={() => void runAgent("scribe", null, liveRef.current, true)}
            scribeBusy={scribeBusy}
            scribeDisabled={scribeBusy || liveBlips.length === 0 || !online}
          />
          <PinnedPanel pinned={pinned} onJump={jumpTo} onUnpin={(id) => wave.togglePin(id)} />

          <AgentFailures
            failures={failures}
            onRetry={retryAgent}
            onDismiss={(key) => setFailures((prev) => prev.filter((f) => f.key !== key))}
          />

          <WaveTabs tab={tab} onChange={setTab} />

          <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(tab)} className="rc-panel">
            {tab === "thread" ? (
              threadEmpty ? (
                <EmptyState />
              ) : (
                <>
                  <StanceSummary blips={viewBlips} />
                  {hiddenRoots > 0 ? (
                    <Button variant="ghost" className="rc-earlier" onClick={() => setShownRoots((n) => n + PAGE_SIZE)}>
                      Show {Math.min(hiddenRoots, PAGE_SIZE)} earlier of {hiddenRoots}
                    </Button>
                  ) : null}
                  <ul className="rw-thread">
                    {visibleRoots.map((b) => (
                      <BlipNode
                        key={b.id}
                        blip={b}
                        childrenOf={childrenOf}
                        byId={byId}
                        typers={typers}
                        editors={editors}
                        myName={me.name}
                        highlightId={highlightId}
                        decidedIds={decidedIds}
                        pending={pending}
                        actions={actions}
                      />
                    ))}
                    {pending
                      .filter((p) => p.parentId === null)
                      .map((p) => (
                        <AgentThinking key={p.key} agent={p.agent} status={p.status} />
                      ))}
                    {rootTypers.map((t) => (
                      <TypingBubble key={`typing-root-${t.name}`} name={t.name} />
                    ))}
                  </ul>
                </>
              )
            ) : null}
            {tab === "media" ? <MediaTab blips={viewBlips} onOpenMedia={actions.onOpenMedia} onJump={jumpTo} /> : null}
            {tab === "polls" ? <PollsTab blips={viewBlips} onJump={jumpTo} /> : null}
          </div>
        </div>
      </div>

      <div className="rw-composer-dock">
        <div className="rw-column">
          <Composer
            value={draft}
            onChange={(v) => {
              setDraft(v);
              setTyping(v.trim() ? (replyToId ?? "root") : null);
            }}
            onSend={send}
            placeholder="Start a thread. Mention @scribe, @skeptic or @researcher to bring an agent in."
            online={online}
            attachments={trayAttachments}
            onAddFiles={addFiles}
            onRemoveAttachment={removeFromTray}
            onRetryAttachment={retryUpload}
            link={link}
            onLinkChange={setLink}
            poll={pollDraft}
            onPollChange={setPollDraft}
            replyTo={replyTo}
            onCancelReply={() => setReplyToId(null)}
            notice={notice}
            onNotice={setNotice}
            onOpenSketch={() => setSketch({})}
          />
        </div>
      </div>

      {importOpen ? <ImportThread onCancel={() => setImportOpen(false)} onImport={importThread} /> : null}
      {replayDecision ? (
        <ReplayView
          key={replayDecision.id}
          decision={replayDecision}
          blips={viewBlips}
          cached={replays[replayDecision.id]}
          onSaveCaptions={saveReplay}
          onClose={() => setReplayDecisionId(null)}
        />
      ) : null}
      {exportDecision ? (
        <SpecExportView
          key={exportDecision.id}
          decision={exportDecision}
          blips={viewBlips}
          waveId={waveId}
          onClose={() => setExportDecisionId(null)}
        />
      ) : null}
      <DropOverlay visible={drop.dragging} />

      {lightbox ? (
        <Lightbox
          items={lightbox.items}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      {sketch ? (
        <SketchPad
          title={sketch.background ? "Annotate screenshot" : "Sketch"}
          backgroundUrl={sketch.background?.url}
          onCancel={() => setSketch(null)}
          onSave={(file) => {
            const annotated = sketch.background
              ? new File([file], `annotated-${sketch.background.name.replace(/\.\w+$/, "")}.png`, { type: "image/png" })
              : file;
            addFiles([annotated], sketch.background ? { kind: "screenshot" } : undefined);
            if (sketch.replyToId) setReplyToId(sketch.replyToId);
            setSketch(null);
          }}
        />
      ) : null}
    </section>
  );
}

/** Copy-invite-link button + an overflow menu with "Leave wave" (spec 07-share-links R6). */
function WaveActions(props: { waveId: string; onLeave: () => void; onImport: () => void }) {
  const { waveId, onLeave, onImport } = props;
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function copyLink() {
    const link = buildInviteLink(waveId);
    try {
      await navigator.clipboard?.writeText(link);
    } catch {
      // Clipboard unavailable (e.g. insecure context): fail gracefully, no crash.
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rw-waveactions" ref={wrapRef}>
      <Button
        variant="ghost"
        shape="b"
        className="rw-copylink"
        onClick={copyLink}
        aria-label="Copy invite link"
      >
        {copied ? "Copied" : "Copy invite link"}
      </Button>

      <Button
        variant="ghost"
        shape="c"
        className="rw-wavemenu-btn"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Wave options"
        onClick={() => setMenuOpen((o) => !o)}
      >
        ···
      </Button>

      {menuOpen && (
        <ul className="rw-wavemenu" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="rw-wavemenu-item"
              onClick={() => {
                setMenuOpen(false);
                onImport();
              }}
            >
              Import a thread
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="rw-wavemenu-item rw-wavemenu-danger"
              onClick={() => {
                setMenuOpen(false);
                onLeave();
              }}
            >
              Leave wave
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
