import type { HTMLAttributes } from "react";
import { cx } from "./cx";
import { SparkleCluster } from "./Sparkle";
import type { SketchShape } from "./Button";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Selected: paper-selected fill, double outline and sparkle doodles. */
  selected?: boolean;
  /** Hover feedback (double outline) for clickable cards. */
  interactive?: boolean;
  shape?: SketchShape;
}

export function Card({ selected = false, interactive = false, shape, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "sketch",
        shape ? `sketch-${shape}` : "sketch-auto",
        "sketch-double",
        "ink-card",
        interactive && "ink-card--interactive",
        selected && "is-selected",
        className,
      )}
      aria-current={selected ? "true" : undefined}
      {...rest}
    >
      {children}
      {selected ? <SparkleCluster /> : null}
    </div>
  );
}
