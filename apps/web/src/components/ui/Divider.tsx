import { cx } from "./cx";

const D =
  "M0 3 Q12 1.2 24 3 T48 3.4 T72 2.5 T96 3.3 T120 2.6 T144 3.2 T168 2.7 T192 3.1 T200 3";

/** 1px ink line with a slight hand-drawn wobble. */
export function Divider({ className }: { className?: string }) {
  return (
    <div className={cx("ink-divider", className)} role="separator">
      <svg viewBox="0 0 200 6" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={D} />
      </svg>
    </div>
  );
}
