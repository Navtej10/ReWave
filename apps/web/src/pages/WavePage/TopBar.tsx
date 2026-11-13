/** Full-width banner: inked wordmark on the left, notched ribbon tag on the right. */
export function TopBar() {
  return (
    <header className="wp-topbar">
      <div className="wp-logo">Rewave</div>
      <div className="wp-tag">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M0 0 L100 0 L95 50 L100 100 L0 100 Z" />
        </svg>
        <span className="wp-tag__text">Turn a debate into a decision</span>
      </div>
    </header>
  );
}
