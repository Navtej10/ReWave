import { useState } from "react";

/** Shown when the URL names a valid wave id the user hasn't joined (share link flow,
 *  spec 07-share-links R4). Collects a name (prefilled) and joins on confirm. */
export function JoinScreen(props: {
  waveId: string;
  /** The wave's title if it could be loaded from its document, else null. */
  title: string | null;
  defaultName: string;
  onJoin: (name: string) => void;
  onCancel: () => void;
}) {
  const { title, defaultName, onJoin, onCancel } = props;
  const [name, setName] = useState(defaultName);
  const canJoin = name.trim().length > 0;

  function submit() {
    if (canJoin) onJoin(name.trim());
  }

  return (
    <div className="rw-join">
      <div className="rw-join-card">
        <div className="rw-join-mark" aria-hidden="true">
          〜
        </div>
        <h1 className="rw-join-title">
          {title ? `Join “${title}”` : "Join this wave"}
        </h1>
        <p className="rw-join-sub">
          You’ve been invited to a private wave. Add your name to join.
        </p>

        <label className="rw-join-label" htmlFor="rw-join-name">
          Your name
        </label>
        <input
          id="rw-join-name"
          className="rw-join-input"
          value={name}
          autoFocus
          placeholder="e.g. Asha"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />

        <div className="rw-join-actions">
          <button type="button" className="rw-join-btn" disabled={!canJoin} onClick={submit}>
            Join wave
          </button>
          <button type="button" className="rw-join-cancel" onClick={onCancel}>
            Back to my waves
          </button>
        </div>
      </div>
    </div>
  );
}
