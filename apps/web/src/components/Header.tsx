/** App header: the wordmark and a one-line tagline. Per-wave connection status and
 *  presence now live in the open wave's panel bar (see WavePanel). */
export function Header() {
  return (
    <header className="rw-header">
      <div className="rw-header-left">
        <span className="rw-wordmark">Rewave</span>
      </div>
      <div className="rw-header-right">
        <span className="rw-header-tagline">Turn a debate into a decision</span>
      </div>
    </header>
  );
}
