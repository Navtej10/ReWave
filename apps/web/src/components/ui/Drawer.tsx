import { useEffect, type ReactNode } from "react";

export interface DrawerProps {
  /** Only meaningful below 900px; on desktop the sidebar is always visible. */
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}

/** Sidebar on desktop, slide-over drawer with scrim on mobile. */
export function Drawer({ open, onClose, label, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        className="ink-drawer-scrim"
        data-open={open}
        aria-label="Close sidebar"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside className="ink-drawer" data-open={open} aria-label={label}>
        {children}
      </aside>
    </>
  );
}
