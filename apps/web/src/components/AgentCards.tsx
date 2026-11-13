import { Button, Chip, cx } from "./ui/index";
import { RichText } from "./rich/markdownLite";
import { AgentGlyph, PinIcon } from "./rich/richIcons";
import { relativeTime } from "./ui";
import type { AgentName, BlipView } from "../wave/types";

const AGENTS: readonly AgentName[] = ["scribe", "skeptic", "researcher"];

/** "@scribe" -> "scribe" (or null for a non-agent author). */
export function agentOf(author: string): AgentName | null {
  const name = author.replace(/^@/, "").toLowerCase();
  return (AGENTS as readonly string[]).includes(name) ? (name as AgentName) : null;
}

/** Agent avatar: a chip with the @name and a small doodle glyph. */
export function AgentNameChip({ agent }: { agent: AgentName }) {
  return (
    <Chip className={cx("rc-agent-badge", `rc-agent-badge--${agent}`)}>
      <AgentGlyph agent={agent} />@{agent}
    </Chip>
  );
}

const TITLE = { scribe: "Summary", skeptic: "Counterpoint", researcher: "Sources" } as const;

/** Structured agent output. Scribe: summary + decisions. Skeptic: counterpoint. Researcher: sources. */
export function AgentCard(props: {
  blip: BlipView;
  myName: string;
  /** Decisions from this card are already in the log. */
  decided: boolean;
  onAddDecisions: (texts: string[]) => void;
  onTogglePin: () => void;
  onDismiss: () => void;
  onJump: (blipId: string) => void;
}) {
  const { blip, myName, decided, onAddDecisions, onTogglePin, onDismiss, onJump } = props;
  const card = blip.card;
  if (!card) return null;
  const agent = card.agent;

  return (
    <article
      className={cx("sketch sketch-b rc-acard", `rc-acard--${agent}`, blip.pinned && "is-pinned")}
      tabIndex={-1}
      aria-label={`${TITLE[agent]} from ${agent}`}
    >
      <header className="rc-acard__head">
        <AgentNameChip agent={agent} />
        <h3 className="rc-acard__title">{TITLE[agent]}</h3>
        <time className="rc-time" dateTime={new Date(blip.createdAt).toISOString()}>
          {relativeTime(blip.createdAt)}
        </time>
        {blip.pinned ? (
          <span className="rc-pinned-flag">
            <PinIcon size={12} />
            Pinned
          </span>
        ) : null}
      </header>

      {card.agent === "scribe" ? (
        <div className="rc-acard__body">
          <RichText text={card.summary} currentUserName={myName} onJump={onJump} />
          {card.decisions.length > 0 ? (
            <>
              <p className="rc-acard__sub">Decisions</p>
              <ul className="rc-acard__decisions">
                {card.decisions.map((d, i) => (
                  <li key={i}>
                    <RichText text={d} currentUserName={myName} onJump={onJump} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {card.agent === "skeptic" ? (
        <div className="rc-acard__body">
          <RichText text={card.counterpoint} currentUserName={myName} onJump={onJump} />
        </div>
      ) : null}

      {card.agent === "researcher" ? (
        <div className="rc-acard__body">
          {card.summary ? <RichText text={card.summary} currentUserName={myName} onJump={onJump} /> : null}
          {card.sources.length > 0 ? (
            <ol className="rc-sources">
              {card.sources.map((s) => (
                <li key={s.url} className="rc-source">
                  <div className="rc-source__row">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="rc-source__title">
                      {s.title}
                    </a>
                    <Chip className="rc-source__domain">{s.domain}</Chip>
                  </div>
                  {s.quote ? <blockquote className="rc-source__quote">{s.quote}</blockquote> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rc-acard__empty">No outside sources are linked in this wave yet.</p>
          )}
          {card.lookups && card.lookups.length > 0 ? (
            <>
              <p className="rc-acard__sub">Worth looking up</p>
              <ul className="rc-acard__decisions">
                {card.lookups.map((l, i) => (
                  <li key={i}>
                    <RichText text={l} currentUserName={myName} onJump={onJump} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <footer className="rc-acard__actions">
        {card.agent === "scribe" && card.decisions.length > 0 ? (
          decided ? (
            <Chip className="rc-poll__chip">In Decision log</Chip>
          ) : (
            <Button variant="primary" onClick={() => onAddDecisions(card.decisions)}>
              Add to Decision log
            </Button>
          )
        ) : null}
        <Button variant="ghost" aria-pressed={blip.pinned} onClick={onTogglePin}>
          <PinIcon size={13} />
          {blip.pinned ? "Unpin" : "Pin"}
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </footer>
    </article>
  );
}
