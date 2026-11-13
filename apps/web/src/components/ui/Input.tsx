import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "./cx";
import type { SketchShape } from "./Button";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  shape?: SketchShape;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { shape, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx("sketch", shape ? `sketch-${shape}` : "sketch-auto", "ink-input", className)}
      {...rest}
    />
  );
});
