import { AgentNameChip, agentOf } from "./AgentCards";
import { PencilIcon } from "./rich/richIcons";
import type { BlipView } from "../wave/types";

/**
 * Edit marker for a blip header.
 * - Only the author edited: "(edited)", with the timestamp on hover.
 * - Someone else edited: "(edited by Maya)" / "(edited by Maya +1)" with a terracotta pencil;
 *   an agent editor shows the agent chip instead of a name.
 */
export function EditedIndicator({ blip, myName }: { blip: BlipView; myName: string }) {
  const { editedAt, editedBy } = blip;
  if (!editedAt && editedBy.length === 0) return null;

  const when = editedAt ? `Edited ${new Date(editedAt).toLocaleString()}` : undefined;

  if (editedBy.length === 0) {
    return (
      <span className="rc-edited" title={when}>
        (edited)
      </span>
    );
  }

  const [first, ...rest] = editedBy;
  const agent = agentOf(first);
  const label = first === myName ? "you" : first;
  const everyone = editedBy.map((n) => (n === myName ? "you" : n)).join(", ");

  return (
    <span className="rc-edited rc-edited--other" title={`${when ? `${when} · ` : ""}Edited by ${everyone}`}>
      <PencilIcon size={12} className="rc-edited__icon" />
      <span>(edited by</span>
      {agent ? <AgentNameChip agent={agent} /> : <span>{label}</span>}
      {rest.length > 0 ? <span>+{rest.length}</span> : null}
      <span aria-hidden="true">)</span>
    </span>
  );
}
