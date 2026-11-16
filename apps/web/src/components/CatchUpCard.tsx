import { useState } from "react";
import { plural } from "../wave/format";
import type { BlipView } from "../wave/types";
import { Button, Card } from "./ui/index";

/** "What changed since you last looked", offered when a wave is reopened (spec 04 R2). */
export function CatchUpCard(props: {
  fresh: BlipView[];
  busy: boolean;
  onDigest: () => void;
  onJumpFirst: () => void;
}) {
  const { fresh, busy, onDigest, onJumpFirst } = props;
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || fresh.length === 0) return null;
  const who = [...new Set(fresh.map((b) => b.author))];
  const shown = who.slice(0, 3).join(", ") + (who.length > 3 ? ` and ${who.length - 3} more` : "");
  return (
    <Card className="rw-decisions rc-catchup" shape="c" role="region" aria-label="Catch up">
      <p className="rc-catchup__text" aria-live="polite">
        <strong>{plural(fresh.length, "new blip")}</strong> since you were last here, from {shown}.
      </p>
      <div className="rc-decisions-tools">
        <Button variant="primary" onClick={onDigest} disabled={busy}>
          {busy ? "@scribe is reading\u2026" : "Ask @scribe for a digest"}
        </Button>
        <Button variant="secondary" onClick={onJumpFirst}>
          Jump to first new
        </Button>
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
