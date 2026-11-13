import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "../ui/index";
import {
  CodeIcon,
  ImageIcon,
  MicIcon,
  PaperclipIcon,
  PlusIcon,
  PollIcon,
  ScreenshotIcon,
  ScribbleIcon,
  type IconProps,
} from "./richIcons";

export interface AttachToolbarProps {
  recording: boolean;
  onAttachFile: () => void;
  onAttachMedia: () => void;
  onScreenshot: () => void;
  onPoll: () => void;
  onVoice: () => void;
  onSketch: () => void;
  onCode: () => void;
}

interface Tool {
  id: string;
  label: string;
  Icon: (p: IconProps) => JSX.Element;
  run: () => void;
  pressed?: boolean;
}

/**
 * Icon row between the "Bring in" chips and the input. Below 560px it collapses to a
 * single "+" button that opens a paper-card menu (CSS swaps which one is visible).
 */
export function AttachToolbar(props: AttachToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const tools: Tool[] = [
    { id: "file", label: "Attach file", Icon: PaperclipIcon, run: props.onAttachFile },
    { id: "media", label: "Image or video", Icon: ImageIcon, run: props.onAttachMedia },
    { id: "shot", label: "Screenshot", Icon: ScreenshotIcon, run: props.onScreenshot },
    { id: "poll", label: "Poll", Icon: PollIcon, run: props.onPoll },
    {
      id: "voice",
      label: props.recording ? "Stop recording" : "Voice note",
      Icon: MicIcon,
      run: props.onVoice,
      pressed: props.recording,
    },
    { id: "sketch", label: "Sketch", Icon: ScribbleIcon, run: props.onSketch },
    { id: "code", label: "Code", Icon: CodeIcon, run: props.onCode },
  ];

  // Close the menu on outside pointer press.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // Focus the first item on open.
  useEffect(() => {
    if (menuOpen) wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  function closeMenu(restoreFocus: boolean) {
    setMenuOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      closeMenu(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      setMenuOpen(false);
    }
  }

  return (
    <div className="rc-tools" ref={wrapRef}>
      <div className="rc-tools__row" role="toolbar" aria-label="Add to your blip">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cx("sketch sketch-b rc-tool", t.pressed && "is-on")}
            aria-label={t.label}
            aria-pressed={t.pressed}
            data-tip={t.label}
            onClick={t.run}
          >
            <t.Icon />
          </button>
        ))}
      </div>

      <button
        ref={toggleRef}
        type="button"
        className="sketch sketch-b rc-tool rc-tools__more"
        aria-label="Add to your blip"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <PlusIcon />
      </button>

      {menuOpen ? (
        <div className="sketch sketch-a rc-toolmenu" role="menu" aria-label="Add to your blip" onKeyDown={onMenuKeyDown}>
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              className="rc-toolmenu__item"
              onClick={() => {
                closeMenu(false);
                t.run();
              }}
            >
              <t.Icon />
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
