import { Avatar } from "./Avatar";

/** Row of presence avatars with a "+N" overflow avatar when the list is long. */
export function PresenceBar({ names, max = 4 }: { names: string[]; max?: number }) {
  if (names.length === 0) {
    return <span className="rw-presence-empty">just you</span>;
  }
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;
  return (
    <span className="rw-presence" aria-label={`Here now: ${names.join(", ")}`}>
      {shown.map((name) => (
        <Avatar key={name} name={name} size="sm" title={name} />
      ))}
      {overflow > 0 && (
        <Avatar
          name="overflow"
          size="sm"
          color="var(--rw-surface-2)"
          label={`+${overflow}`}
          title={`${overflow} more: ${names.slice(max).join(", ")}`}
        />
      )}
    </span>
  );
}
