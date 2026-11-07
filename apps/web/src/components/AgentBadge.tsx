import { SparkleIcon } from "./icons";

/** Small pill marking a blip as agent-authored. */
export function AgentBadge() {
  return (
    <span className="rw-agent-badge">
      <SparkleIcon className="rw-agent-badge-icon" />
      agent
    </span>
  );
}
