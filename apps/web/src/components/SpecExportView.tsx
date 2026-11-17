import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  buildSpecRequest,
  redact,
  renderSpecFiles,
  requestSpec,
  REVIEW_NOTE,
  slugFor,
  specPaths,
  SPEC_FILES,
  SpecExportError,
  type SpecFileName,
} from "../wave/specExport";
import type { BlipView, Decision } from "../wave/types";
import { makeZip } from "../wave/zip";
import { Modal } from "./rich/Modal";
import { Button } from "./ui/index";

type Phase =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; notice: string | null };

export interface SpecExportViewProps {
  decision: Decision;
  /** All blips of the open wave. */
  blips: readonly BlipView[];
  /** Used only to keep the wave's capability out of the export; never written anywhere. */
  waveId: string;
  onClose: () => void;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Preview and export of one decision as a Kiro spec folder. Text is editable before it leaves the app. */
export function SpecExportView({ decision, blips, waveId, onClose }: SpecExportViewProps) {
  const redaction = useMemo(() => ({ waveId, origin: typeof location === "undefined" ? "" : location.origin }), [waveId]);
  const slug = useMemo(() => slugFor(decision.text.replace(/\[b:[^\]]*\]/g, " "), redaction), [decision.text, redaction]);
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const [files, setFiles] = useState<Record<SpecFileName, string>>({ "requirements.md": "", "design.md": "", "tasks.md": "" });
  const [tab, setTab] = useState<SpecFileName>("requirements.md");
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  const tabRefs = useRef<Partial<Record<SpecFileName, HTMLButtonElement | null>>>({});
  // The blips are a snapshot taken when Export opens, so the draft does not shift while it is written.
  const snapshot = useRef({ decision, blips });

  const generate = useCallback(async () => {
    setPhase({ status: "loading" });
    setStatus("");
    try {
      const { decision: d, blips: b } = snapshot.current;
      const spec = await requestSpec(buildSpecRequest(d, b, redaction));
      if (!alive.current) return;
      setFiles(renderSpecFiles(spec, redaction));
      setPhase({ status: "ready", notice: spec.thin ? (spec.notice ?? "There was not enough discussion in this thread to derive requirements.") : null });
    } catch (e) {
      if (!alive.current) return;
      setPhase({ status: "failed", message: e instanceof SpecExportError ? e.message : "The spec couldn't be written." });
    }
  }, [redaction]);

  useEffect(() => {
    alive.current = true;
    void generate();
    return () => {
      alive.current = false;
    };
  }, [generate]);

  // What leaves the app is always redacted once more, in case an edit pasted the wave link.
  const outgoing = (name: SpecFileName) => redact(files[name], redaction);

  async function copy() {
    try {
      await navigator.clipboard.writeText(outgoing(tab));
      setStatus(`Copied ${tab}.`);
    } catch {
      setStatus("Copy was blocked by the browser. Select the text and copy it yourself.");
    }
  }
  function downloadOne() {
    saveBlob(new Blob([outgoing(tab)], { type: "text/markdown;charset=utf-8" }), tab);
    setStatus(`Downloaded ${tab}.`);
  }
  function downloadAll() {
    const paths = specPaths(slug);
    const zip = makeZip(Object.fromEntries(SPEC_FILES.map((name) => [paths[name], outgoing(name)])));
    saveBlob(new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }), `${slug}.zip`);
    setStatus(`Downloaded ${slug}.zip.`);
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? SPEC_FILES.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const name = SPEC_FILES[(next + SPEC_FILES.length) % SPEC_FILES.length];
    setTab(name);
    tabRefs.current[name]?.focus();
  }

  const ready = phase.status === "ready";
  return (
    <Modal label="Export to Kiro spec" onClose={onClose} className="sketch sketch-a ink-card rc-spec" initialFocus=".rc-spec__tab--on, .rc-spec__close">
      <header className="rc-spec__head">
        <h2 className="rc-dialog__title">Export to Kiro spec</h2>
        <Button variant="ghost" className="rc-spec__close" onClick={onClose}>
          Close
        </Button>
      </header>
      <p className="rc-spec__decision">{decision.text.replace(/\[b:[^\]]*\]/g, "").replace(/\s+/g, " ").trim()}</p>
      <p className="rc-spec__note">{REVIEW_NOTE}</p>

      {phase.status === "loading" ? (
        <p className="rc-spec__state" role="status">
          Writing the spec from the thread&hellip;
        </p>
      ) : null}
      {phase.status === "failed" ? (
        <div className="rc-spec__state rc-spec__state--error" role="alert">
          <p>{phase.message}</p>
          <Button variant="secondary" onClick={() => void generate()}>
            Retry
          </Button>
        </div>
      ) : null}

      {ready ? (
        <>
          {phase.notice ? (
            <p className="rc-spec__thin" role="status">
              {phase.notice}
            </p>
          ) : null}
          <div className="rc-spec__tabs" role="tablist" aria-label="Spec files">
            {SPEC_FILES.map((name, i) => (
              <button
                key={name}
                ref={(el) => {
                  tabRefs.current[name] = el;
                }}
                type="button"
                role="tab"
                id={`rc-spec-tab-${name}`}
                aria-selected={tab === name}
                aria-controls="rc-spec-panel"
                tabIndex={tab === name ? 0 : -1}
                className={`rc-spec__tab${tab === name ? " rc-spec__tab--on" : ""}`}
                onClick={() => setTab(name)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {name}
              </button>
            ))}
          </div>
          <div id="rc-spec-panel" role="tabpanel" aria-labelledby={`rc-spec-tab-${tab}`} className="rc-spec__panel">
            <textarea
              className="rc-spec__text"
              value={files[tab]}
              onChange={(e) => setFiles((f) => ({ ...f, [tab]: e.target.value }))}
              aria-label={`Contents of ${tab}`}
              spellCheck={false}
            />
          </div>
          <div className="rc-spec__actions">
            <Button variant="secondary" onClick={() => void copy()}>
              Copy current file
            </Button>
            <Button variant="secondary" onClick={downloadOne}>
              Download current file
            </Button>
            <Button variant="primary" onClick={downloadAll}>
              Download all as zip
            </Button>
          </div>
          <p className="rc-spec__path">
            The zip is laid out as <code>.kiro/specs/{slug}/</code>
          </p>
        </>
      ) : null}
      <p className="rc-spec__status" aria-live="polite">
        {status}
      </p>
    </Modal>
  );
}
