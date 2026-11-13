import { cx } from "./ui/index";
import { StanceIcon } from "./rich/richIcons";
import { stanceCounts, stanceSummaryText } from "../wave/polls";
import type { BlipView, Stance } from "../wave/types";

export const STANCES: readonly Stance[] = ["agree", "disagree", "unsure"];
const LABEL: Record<Stance, string> = { agree: "Agree", disagree: "Disagree", unsure: "Unsure" };

/**
 * Tag a blip Agree / Disagree / Unsure. Each person has one stance per blip; pressing your
 * active one clears it. Counts show everyone's stances. Text + icon, never color alone.
 */
export function StanceChips(props: {
  stances: Record<string, Stance>;
  myName: string;
  onChange: (next: Stance | null) => void;
}) {
  const { stances, myName, onChange } = props;
  const mine = stances[myName];
  const count = (s: Stance) => Object.values(stances).filter((v) => v === s).length;
  return (
    <div className="rc-stances" role="group" aria-label="Your stance on this blip">
      {STANCES.map((s) => {
        const n = count(s);
        return (
          <button
            key={s}
            type="button"
            className={cx("ink-chip rc-stance", `rc-stance--${s}`, mine === s && "is-on")}
            aria-pressed={mine === s}
            aria-label={`${LABEL[s]}${n > 0 ? `, ${n} ${n === 1 ? "person" : "people"}` : ""}`}
            onClick={() => onChange(mine === s ? null : s)}
          >
            <StanceIcon stance={s} />
            {LABEL[s]}
            {n > 0 ? <span className="rc-stance__n">{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Strip on the thread header: "3 agree, 1 disagree, 2 unsure". The scribe receives the same text. */
export function StanceSummary({ blips }: { blips: readonly BlipView[] }) {
  const counts = stanceCounts(blips);
  const text = stanceSummaryText(counts);
  return (
    <div className="sketch sketch-c rc-stancesum" role="group" aria-label={`Stance summary: ${text}`}>
      <span className="rc-stancesum__label">Stances</span>
      {STANCES.map((s) => (
        <span key={s} className={cx("ink-chip rc-stance", `rc-stance--${s}`, counts[s] > 0 && "is-on")}>
          <StanceIcon stance={s} />
          {counts[s]} {s}
        </span>
      ))}
    </div>
  );
}
