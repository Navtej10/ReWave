import type { HTMLAttributes } from "react";
import { cx } from "./cx";

/** Wavy top/bottom outline, built once. Stretches to the element via viewBox. */
const WAVES = 20;
const STEP = 100 / WAVES;

function wave(y: number, dir: 1 | -1, amp: number): string {
  const ts = Array.from({ length: WAVES - 1 }, (_, i) => `T${(dir === 1 ? (i + 2) : WAVES - i - 2) * STEP} ${y}`);
  const startX = dir === 1 ? 0 : 100;
  return `Q${startX + dir * (STEP / 2)} ${y - amp} ${startX + dir * STEP} ${y} ${ts.join(" ")}`;
}

const PATH = `M0 6 ${wave(6, 1, 5)} L100 94 ${wave(94, -1, -5)} Z`;

export interface RibbonProps extends HTMLAttributes<HTMLDivElement> {}

/** Yellow notice banner with wavy, inked top and bottom edges. */
export function Ribbon({ className, children, role = "note", ...rest }: RibbonProps) {
  return (
    <div className={cx("ink-ribbon", className)} role={role} {...rest}>
      <svg className="ink-ribbon__bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={PATH} />
      </svg>
      <div className="ink-ribbon__body">{children}</div>
    </div>
  );
}
