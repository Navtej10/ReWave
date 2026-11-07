import { useEffect, useState } from "react";
import { PencilIcon } from "./icons";

/** Editable wave title at the top of the open wave (R8.2). Commits on blur or Enter.
 *  `title` is the derived display title; `rawTitle` is the stored title (empty allowed) so
 *  editing starts from what's actually saved rather than the fallback. */
export function WaveTitle(props: {
  title: string;
  rawTitle: string;
  onRename: (title: string) => void;
}) {
  const { title, rawTitle, onRename } = props;
  const [draft, setDraft] = useState(rawTitle);
  const [editing, setEditing] = useState(false);

  // Sync external changes in when not actively editing.
  useEffect(() => {
    if (!editing) setDraft(rawTitle);
  }, [rawTitle, editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() !== rawTitle.trim()) onRename(draft.trim());
  }

  return (
    <div className="rw-wavetitle">
      <input
        className="rw-wavetitle-input"
        aria-label="Wave title"
        value={editing ? draft : title}
        placeholder="Untitled wave"
        onFocus={() => {
          setEditing(true);
          setDraft(rawTitle);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(rawTitle);
            setEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
      <PencilIcon className="rw-wavetitle-pencil" />
    </div>
  );
}
