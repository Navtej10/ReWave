import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type SketchShape = "a" | "b" | "c";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Pin a specific hand-drawn corner shape. Omit to rotate among siblings. */
  shape?: SketchShape;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", shape, type = "button", className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("sketch", shape ? `sketch-${shape}` : "sketch-auto", "ink-btn", `ink-btn--${variant}`, className)}
      {...rest}
    />
  );
});
