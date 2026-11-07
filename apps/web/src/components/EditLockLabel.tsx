import { PencilIcon } from "./icons";

/** "<name> is editing" label shown when someone else holds the edit lock. */
export function EditLockLabel({ name }: { name: string }) {
  return (
    <span className="rw-lock" aria-live="polite">
      <PencilIcon className="rw-lock-icon" />
      {name} is editing
    </span>
  );
}
