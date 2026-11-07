import { ConnectionStatus } from "./ConnectionStatus";
import { PresenceBar } from "./PresenceBar";

/** App header: wordmark, wave id chip, connection status, presence avatars. */
export function Header({
  waveId,
  status,
  peers,
}: {
  waveId: string;
  status: string;
  peers: string[];
}) {
  return (
    <header className="rw-header">
      <div className="rw-header-left">
        <span className="rw-wordmark">Rewave</span>
        <span className="rw-wave-chip" title={`Wave ${waveId}`}>
          #{waveId}
        </span>
      </div>
      <div className="rw-header-right">
        <ConnectionStatus status={status} />
        <PresenceBar names={peers} />
      </div>
    </header>
  );
}
