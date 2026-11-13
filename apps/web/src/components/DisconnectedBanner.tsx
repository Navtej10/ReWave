import { normalizeStatus } from "./ConnectionStatus";
import { Ribbon } from "./ui/index";

/** Non-blocking banner surfaced while the connection is not healthy. Does not gate input.
 *  Drawn as a torn yellow paper ribbon. */
export function DisconnectedBanner({ status }: { status: string }) {
  const state = normalizeStatus(status);
  if (state === "connected") return null;
  const message =
    state === "connecting"
      ? "Connecting to the wave — you can keep typing, changes will sync when you're back online."
      : "You're offline. You can keep typing; changes will sync once the connection returns.";
  return (
    <Ribbon className="rw-banner" role="status" aria-live="polite">
      {message}
    </Ribbon>
  );
}
