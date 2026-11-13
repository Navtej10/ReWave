import { useId } from "react";
import { Card, cx } from "../../components/ui/index";
import { ChevronDownIcon } from "./icons";
import { Mention } from "./Mention";

export interface DecisionLogProps {
  open: boolean;
  onToggle: () => void;
}

/** Collapsible placeholder card. No decision logic yet. */
export function DecisionLog({ open, onToggle }: DecisionLogProps) {
  const bodyId = useId();
  return (
    <Card className="wp-log">
      <h2 className="wp-log__heading">
        <button type="button" className="wp-log__toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <span>Decision log</span>
          <ChevronDownIcon className={cx("wp-log__chevron", !open && "is-closed")} />
        </button>
      </h2>
      <p id={bodyId} className="wp-log__body" hidden={!open}>
        No decisions yet. Ask <Mention name="scribe" /> to summarize.
      </p>
    </Card>
  );
}
