/** Shown when the URL hash is present but is not a valid wave id (spec 07-share-links R5). */
export function InvalidLink(props: { onBack: () => void }) {
  return (
    <div className="rw-join">
      <div className="rw-join-card">
        <div className="rw-join-mark rw-join-mark--bad" aria-hidden="true">
          ⚠
        </div>
        <h1 className="rw-join-title">This invite link isn’t valid</h1>
        <p className="rw-join-sub">
          The link may be broken or incomplete. Ask whoever shared it to send it again.
        </p>
        <div className="rw-join-actions">
          <button type="button" className="rw-join-btn" onClick={props.onBack}>
            Back to my waves
          </button>
        </div>
      </div>
    </div>
  );
}
