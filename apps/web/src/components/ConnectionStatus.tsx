/** Normalizes Hocuspocus status strings into one of three UI states. */
export type ConnState = "connected" | "connecting" | "disconnected";

export function normalizeStatus(status: string): ConnState {
  if (status === "connected") return "connected";
  if (status === "disconnected") return "disconnected";
  return "connecting";
}

const LABEL: Record<ConnState, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Disconnected",
};

/** Colored dot plus text label. Meaning is carried by text, not color alone. */
export function ConnectionStatus({ status }: { status: string }) {
  const state = normalizeStatus(status);
  return (
    <span className={`rw-conn rw-conn--${state}`}>
      <span className="rw-conn-dot" aria-hidden="true" />
      <span className="rw-conn-text">{LABEL[state]}</span>
    </span>
  );
}
