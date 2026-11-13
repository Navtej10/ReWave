import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, Input, cx } from "../ui/index";
import { uid } from "../../wave/format";
import { Modal } from "./Modal";
import { PollBlip } from "./PollBlip";
import {
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  resolveCloseTime,
  validatePoll,
  type ClosePreset,
} from "../../wave/polls";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, PlusIcon } from "./richIcons";
import type { Poll } from "../../wave/types";

export interface PollComposerProps {
  /** Editing a poll already attached to the draft. */
  initial?: Poll | null;
  /** Text typed after "/poll ". */
  initialQuestion?: string;
  onCancel: () => void;
  onSubmit: (poll: Poll) => void;
}

interface OptionDraft {
  key: string;
  label: string;
}

const PRESETS: { id: ClosePreset; label: string }[] = [
  { id: "never", label: "Never" },
  { id: "1h", label: "1 hour" },
  { id: "24h", label: "24 hours" },
  { id: "custom", label: "Custom" },
];

function blankOption(): OptionDraft {
  return { key: uid("opt"), label: "" };
}

export function PollComposer({ initial, initialQuestion = "", onCancel, onSubmit }: PollComposerProps) {
  const [question, setQuestion] = useState(initial?.question ?? initialQuestion);
  const [options, setOptions] = useState<OptionDraft[]>(
    () => initial?.options.map((o) => ({ key: o.id, label: o.label })) ?? [blankOption(), blankOption()],
  );
  const [multiSelect, setMulti] = useState(initial?.multiSelect ?? false);
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false);
  const [hideResults, setHideResults] = useState(initial?.hideResultsUntilVoted ?? false);
  const [preset, setPreset] = useState<ClosePreset>(initial?.closesAt ? "custom" : "never");
  const [custom, setCustom] = useState(() => (initial?.closesAt ? toLocalInput(initial.closesAt) : ""));
  const [attempted, setAttempted] = useState(false);

  const optionRefs = useRef(new Map<string, HTMLInputElement>());
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  // Move focus after the DOM reflects an add / reorder.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    (optionRefs.current.get(target) ?? buttonRefs.current.get(target))?.focus();
  }, [options]);

  const validation = validatePoll(question, options.map((o) => o.label));
  const close = resolveCloseTime(preset, Date.now(), custom);
  const showErrors = attempted;

  function setLabel(key: string, label: string) {
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, label } : o)));
  }

  function addAfter(index: number) {
    if (options.length >= POLL_MAX_OPTIONS) return;
    const fresh = blankOption();
    pendingFocus.current = fresh.key;
    setOptions((prev) => [...prev.slice(0, index + 1), fresh, ...prev.slice(index + 1)]);
  }

  function remove(key: string) {
    if (options.length <= POLL_MIN_OPTIONS) return;
    const i = options.findIndex((o) => o.key === key);
    const neighbor = options[i + 1] ?? options[i - 1];
    pendingFocus.current = neighbor?.key ?? null;
    setOptions((prev) => prev.filter((o) => o.key !== key));
  }

  function move(key: string, delta: -1 | 1) {
    const i = options.findIndex((o) => o.key === key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= options.length) return;
    // Keep focus on the button the user pressed; if it hit an end, focus its opposite.
    const atEnd = j === 0 || j === options.length - 1;
    pendingFocus.current = `${key}:${atEnd ? (delta === -1 ? "down" : "up") : delta === -1 ? "up" : "down"}`;
    setOptions((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function onOptionKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (index < options.length - 1) optionRefs.current.get(options[index + 1].key)?.focus();
    else if (options[index].label.trim()) addAfter(index);
  }

  function submit() {
    setAttempted(true);
    if (!validation.valid || close.error) return;
    onSubmit({
      id: initial?.id ?? uid("poll"),
      question: question.trim(),
      options: options.map((o) => ({ id: o.key, label: o.label.trim(), votes: [] })),
      multiSelect,
      anonymous,
      closesAt: close.closesAt,
      closed: false,
      hideResultsUntilVoted: hideResults,
    });
  }

  // Live preview uses whatever is filled in so far.
  const previewPoll: Poll = {
    id: "preview",
    question: question.trim() || "Your question",
    options: options.map((o, i) => ({ id: o.key, label: o.label.trim() || `Option ${i + 1}`, votes: [] })),
    multiSelect,
    anonymous,
    closed: false,
    hideResultsUntilVoted: false,
  };

  const qErrorId = "rc-pc-q-err";

  return (
    <Modal label="Create a poll" onClose={onCancel} className="sketch sketch-a ink-card rc-pcomp" initialFocus="#rc-pc-question">
      <div className="rc-pcomp__head">
        <h2 className="rc-pcomp__title">New poll</h2>
        <button type="button" className="sketch sketch-b rc-iconbtn" aria-label="Close poll composer" onClick={onCancel}>
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="rc-pcomp__grid">
        <form
          className="rc-pcomp__form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="rc-field" htmlFor="rc-pc-question">
            Question
          </label>
          <Input
            id="rc-pc-question"
            shape="c"
            value={question}
            maxLength={200}
            placeholder="What are we deciding?"
            aria-required="true"
            aria-invalid={showErrors && Boolean(validation.question)}
            aria-describedby={showErrors && validation.question ? qErrorId : undefined}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {showErrors && validation.question ? (
            <p id={qErrorId} className="rc-error" role="alert">
              {validation.question}
            </p>
          ) : null}

          <span className="rc-field" id="rc-pc-opts-label">
            Options ({options.length} of {POLL_MAX_OPTIONS})
          </span>
          <ol className="rc-pcomp__opts" aria-labelledby="rc-pc-opts-label">
            {options.map((o, i) => {
              const err = showErrors ? validation.options[i] : undefined;
              const errId = `rc-pc-err-${o.key}`;
              return (
                <li key={o.key} className="rc-pcomp__opt">
                  <Input
                    ref={(el) => {
                      if (el) optionRefs.current.set(o.key, el);
                      else optionRefs.current.delete(o.key);
                    }}
                    shape={i % 2 ? "b" : "a"}
                    value={o.label}
                    maxLength={100}
                    placeholder={`Option ${i + 1}`}
                    aria-label={`Option ${i + 1}`}
                    aria-invalid={Boolean(err)}
                    aria-describedby={err ? errId : undefined}
                    onChange={(e) => setLabel(o.key, e.target.value)}
                    onKeyDown={(e) => onOptionKeyDown(e, i)}
                  />
                  <span className="rc-pcomp__optbtns">
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) buttonRefs.current.set(`${o.key}:up`, el);
                        else buttonRefs.current.delete(`${o.key}:up`);
                      }}
                      className="sketch sketch-b rc-iconbtn"
                      aria-label={`Move option ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => move(o.key, -1)}
                    >
                      <ArrowUpIcon size={14} />
                    </button>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) buttonRefs.current.set(`${o.key}:down`, el);
                        else buttonRefs.current.delete(`${o.key}:down`);
                      }}
                      className="sketch sketch-b rc-iconbtn"
                      aria-label={`Move option ${i + 1} down`}
                      disabled={i === options.length - 1}
                      onClick={() => move(o.key, 1)}
                    >
                      <ArrowDownIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="sketch sketch-b rc-iconbtn"
                      aria-label={`Remove option ${i + 1}`}
                      disabled={options.length <= POLL_MIN_OPTIONS}
                      onClick={() => remove(o.key)}
                    >
                      <CloseIcon size={14} />
                    </button>
                  </span>
                  {err ? (
                    <p id={errId} className="rc-error" role="alert">
                      {err}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {showErrors && validation.general ? (
            <p className="rc-error" role="alert">
              {validation.general}
            </p>
          ) : null}
          <Button
            variant="ghost"
            className="rc-pcomp__add"
            disabled={options.length >= POLL_MAX_OPTIONS}
            onClick={() => addAfter(options.length - 1)}
          >
            <PlusIcon size={14} />
            Add option
          </Button>

          <fieldset className="rc-pcomp__set">
            <legend className="rc-field">Settings</legend>
            <label className="rc-check">
              <input type="checkbox" checked={multiSelect} onChange={(e) => setMulti(e.target.checked)} />
              Allow multiple choices
            </label>
            <label className="rc-check">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              Anonymous votes
            </label>
            <label className="rc-check">
              <input type="checkbox" checked={hideResults} onChange={(e) => setHideResults(e.target.checked)} />
              Hide results until someone votes
            </label>
          </fieldset>

          <fieldset className="rc-pcomp__set">
            <legend className="rc-field">Closes</legend>
            <div className="rc-pcomp__presets">
              {PRESETS.map((p) => (
                <label key={p.id} className={cx("sketch sketch-auto rc-radiochip", preset === p.id && "is-on")}>
                  <input
                    type="radio"
                    name="rc-close"
                    value={p.id}
                    checked={preset === p.id}
                    onChange={() => setPreset(p.id)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            {preset === "custom" ? (
              <>
                <label className="rc-field" htmlFor="rc-pc-custom">
                  Close at
                </label>
                <Input
                  id="rc-pc-custom"
                  type="datetime-local"
                  shape="b"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  aria-invalid={showErrors && Boolean(close.error)}
                />
                {showErrors && close.error ? (
                  <p className="rc-error" role="alert">
                    {close.error}
                  </p>
                ) : null}
              </>
            ) : null}
          </fieldset>

          <div className="rc-pcomp__foot">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {initial ? "Update poll" : "Add poll to message"}
            </Button>
          </div>
        </form>

        <aside className="rc-pcomp__preview" aria-label="Poll preview">
          <span className="rc-field">Preview</span>
          <PollBlip poll={previewPoll} currentUserName="" isOwner={false} decided={false} preview />
        </aside>
      </div>
    </Modal>
  );
}

/** ISO -> value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
