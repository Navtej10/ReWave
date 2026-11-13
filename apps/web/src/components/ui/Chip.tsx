import type { HTMLAttributes } from "react";
import { cx } from "./cx";

/** Pill used for @mentions. */
export function Chip({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("ink-chip", className)} {...rest} />;
}
