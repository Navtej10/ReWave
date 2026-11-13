import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { cx } from "../ui/index";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  label: string;
  onClose: () => void;
  /** Class for the dialog panel. */
  className?: string;
  /** Extra class for the scrim. */
  scrimClassName?: string;
  /** CSS selector inside the panel to focus first. Defaults to the first focusable element. */
  initialFocus?: string;
  children: ReactNode;
}

/**
 * Dialog shell: warm scrim, focus trap, Esc to close, focus restored to the opener on unmount.
 * Rendered in place (not a portal) so it inherits the rc- scope.
 */
export function Modal({ label, onClose, className, scrimClassName, initialFocus, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target =
      (initialFocus ? panel?.querySelector<HTMLElement>(initialFocus) : null) ??
      panel?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    target?.focus();
    return () => opener?.focus?.();
    // Only on mount / unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (nodes.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onScrimDown(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className={cx("rc-modal", scrimClassName)} onKeyDown={onKeyDown} onMouseDown={onScrimDown}>
      <div ref={panelRef} className={className} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
