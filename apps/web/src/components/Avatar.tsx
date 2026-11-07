import { avatarColor, initials } from "./ui";

/** Circular avatar with hashed-color initials. `color`/`label` override the defaults
 *  (used for the "+N" overflow avatar). */
export function Avatar(props: {
  name: string;
  size?: "sm" | "md";
  color?: string;
  label?: string;
  title?: string;
}) {
  const { name, size = "md", color, label, title } = props;
  const text = label ?? initials(name);
  return (
    <span
      className={`rw-avatar rw-avatar--${size}`}
      style={{ background: color ?? avatarColor(name) }}
      title={title ?? name}
      aria-hidden={title ? undefined : true}
    >
      {text}
    </span>
  );
}
