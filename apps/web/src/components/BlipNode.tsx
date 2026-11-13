import type { BlipView, TyperView } from "../wave/types";
import { AgentCard } from "./AgentCards";
import { BlipCard, type BlipActions } from "./BlipCard";
import { TypingBubble } from "./TypingBubble";
import { isOwnBlip } from "./ui";

/** Recursive thread item: one blip card (or agent card), then its replies and reply-typers. */
export function BlipNode(props: {
  blip: BlipView;
  /** Replies grouped by parent id. */
  childrenOf: Map<string, BlipView[]>;
  byId: Map<string, BlipView>;
  typers: TyperView[];
  editors: Map<string, string>;
  myName: string;
  highlightId: string | null;
  decidedIds: Set<string | undefined>;
  actions: BlipActions;
}) {
  const { blip, childrenOf, byId, typers, editors, myName, highlightId, decidedIds, actions } = props;
  const children = childrenOf.get(blip.id) ?? [];
  const childTypers = typers.filter((t) => t.target === blip.id);

  // A deleted blip with nothing under it disappears entirely.
  if (blip.deleted && children.length === 0 && childTypers.length === 0) return null;

  const lockedBy = editors.get(blip.id);
  const own = isOwnBlip(blip, myName);

  const classes = [
    "rw-blip",
    blip.kind === "agent" ? "rw-blip--agent" : "rw-blip--human",
    own ? "rw-blip--own" : "",
    lockedBy ? "rw-blip--locked" : "",
    blip.pinned ? "rc-is-pinned" : "",
    blip.card ? "rc-has-card" : "",
    highlightId === blip.id ? "rc-highlight" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={classes} id={`b-${blip.id}`}>
      {blip.card && !blip.deleted ? (
        <AgentCard
          blip={blip}
          myName={myName}
          decided={decidedIds.has(blip.id)}
          onAddDecisions={(texts) => actions.onAddDecisions(blip.id, texts, `${blip.card?.agent ?? "agent"} summary`)}
          onTogglePin={() => actions.onTogglePin(blip.id)}
          onDismiss={() => actions.onDelete(blip.id)}
          onJump={actions.onJump}
        />
      ) : (
        <BlipCard
          blip={blip}
          parent={blip.parentId ? byId.get(blip.parentId) : undefined}
          myName={myName}
          lockedBy={lockedBy}
          decided={decidedIds.has(blip.id)}
          actions={actions}
        />
      )}

      {(children.length > 0 || childTypers.length > 0) && (
        <ul className="rw-children">
          {children.map((c) => (
            <BlipNode key={c.id} {...props} blip={c} />
          ))}
          {childTypers.map((t) => (
            <TypingBubble key={`typing-${blip.id}-${t.name}`} name={t.name} />
          ))}
        </ul>
      )}
    </li>
  );
}
