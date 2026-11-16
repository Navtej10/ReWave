import { AgentNameChip } from "./AgentCards";
import { Button } from "./ui/index";
import type { AgentName } from "../wave/types";

/** An agent call in flight. Local to this browser; never synced. */
export interface PendingAgent {
  key: string;
  agent: AgentName;
  /** Blip the agent is replying under, or null for a top-level reply. */
  parentId: string | null;
  /** Latest progress text from the server, e.g. "Reading example.com...". */
  status?: string;
}

/** An agent call that failed. The human blip that summoned it is already posted. */
export interface AgentFailure extends Omit<PendingAgent, "status"> {
  message: string;
}

/** "@scribe is reading the thread..." row, shown where the agent's reply will appear. */
export function AgentThinking({ agent, status }: { agent: AgentName; status?: string }) {
  return (
    <li className="rw-typing-row rc-agent-thinking" aria-live="polite">
      <div className="rw-typing" role="status">
        <span className="rw-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <AgentNameChip agent={agent} />
        <span className="rw-typing-name">{status ?? "is reading the thread\u2026"}</span>
      </div>
    </li>
  );
}

/** Plain-language failure with Retry. Agents never retry on their own (they only speak when asked). */
export function AgentFailures(props: {
  failures: AgentFailure[];
  onRetry: (failure: AgentFailure) => void;
  onDismiss: (key: string) => void;
}) {
  const { failures, onRetry, onDismiss } = props;
  if (failures.length === 0) return null;
  return (
    <div className="rc-agent-failures">
      {failures.map((f) => (
        <p key={f.key} className="rw-error rc-agent-failure" role="alert">
          <span className="rc-agent-failure__text">{f.message}</span>
          <span className="rc-agent-failure__actions">
            <Button variant="secondary" onClick={() => onRetry(f)}>
              Try again
            </Button>
            <Button variant="ghost" onClick={() => onDismiss(f.key)} aria-label={`Dismiss @${f.agent} error`}>
              Dismiss
            </Button>
          </span>
        </p>
      ))}
    </div>
  );
}
