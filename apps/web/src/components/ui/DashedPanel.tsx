import type { HTMLAttributes } from "react";
import { cx } from "./cx";

/** Transparent dashed container for empty states. */
export function DashedPanel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ink-dashed", className)} {...rest} />;
}
