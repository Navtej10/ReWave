import type { CSSProperties } from "react";
import { cx } from "./cx";

export interface SparkleProps {
  size?: number;
  /** Degrees. */
  rotate?: number;
  className?: string;
}

/** Small 4-point star doodle, ink outline with cream fill. Decorative. */
export function Sparkle({ size = 18, rotate = 0, className }: SparkleProps) {
  const style = { "--rot": `${rotate}deg` } as CSSProperties;
  return (
    <svg
      className={cx("ink-sparkle", className)}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 1.5 C13 8 16 11 22.5 12 C16 13 13 16 12 22.5 C11 16 8 13 1.5 12 C8 11 11 8 12 1.5 Z" />
    </svg>
  );
}

/** Three sparkles placed around the nearest positioned, selected parent. */
export function SparkleCluster() {
  return (
    <span className="ink-sparkles" aria-hidden="true">
      <Sparkle size={20} rotate={8} />
      <Sparkle size={14} rotate={-12} />
      <Sparkle size={12} rotate={20} />
    </span>
  );
}
