import type { KeyboardEvent } from "react";
import { cx } from "../ui/index";
import { REACTION_LABEL, ReactionIcon, SmileIcon } from "./richIcons";
import { REACTION_KEYS, type ReactionKey } from "../../wave/types";

export interface ReactionBarProps {
  reactions?: Record<string, string[]>;
  /** Key of the current user in the reaction lists. */
  me: string;
  /** Picker visibility. Hover / focus also reveal it through CSS; long-press and the button set this. */
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onToggle: (key: ReactionKey) => void;
}

/** Counts under the blip (click to toggle yours) plus the 6-doodle picker. */
export function ReactionBar({ reactions = {}, me, pickerOpen, onPickerOpenChange, onToggle }: ReactionBarProps) {
  const active = REACTION_KEYS.filter((k) => (reactions[k]?.length ?? 0) > 0);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && pickerOpen) {
      e.stopPropagation();
      onPickerOpenChange(false);
    }
  }

  return (
    <div className="rc-reactions" onKeyDown={onKeyDown}>
      {active.length > 0 ? (
        <ul className="rc-reactions__chips" aria-label="Reactions">
          {active.map((k) => {
            const n = reactions[k].length;
            const mine = reactions[k].includes(me);
            return (
              <li key={k}>
                <button
                  type="button"
                  className={cx("ink-chip rc-rchip", mine && "is-mine")}
                  aria-pressed={mine}
                  aria-label={`${REACTION_LABEL[k]}, ${n}. ${mine ? "Remove your reaction" : "Add your reaction"}`}
                  onClick={() => onToggle(k)}
                >
                  <ReactionIcon name={k} size={14} />
                  {n}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="rc-react-wrap">
        <button
          type="button"
          className="sketch sketch-b rc-react-add"
          aria-label="Add reaction"
          aria-expanded={pickerOpen}
          aria-haspopup="true"
          onClick={() => onPickerOpenChange(!pickerOpen)}
        >
          <SmileIcon size={16} />
        </button>
        <div
          className={cx("sketch sketch-a rc-react-picker", pickerOpen && "is-open")}
          role="group"
          aria-label="Pick a reaction"
        >
          {REACTION_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className="rc-react-pick"
              aria-label={REACTION_LABEL[k]}
              aria-pressed={reactions[k]?.includes(me) ?? false}
              onClick={() => {
                onToggle(k);
                onPickerOpenChange(false);
              }}
            >
              <ReactionIcon name={k} size={20} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
