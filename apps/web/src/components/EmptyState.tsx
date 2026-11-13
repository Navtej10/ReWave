import { WaveIllustration } from "../pages/WavePage/WaveIllustration";
import { DashedPanel } from "./ui/index";

/** Shown when the wave has no blips and no one is typing. */
export function EmptyState() {
  return (
    <DashedPanel className="rw-empty">
      <WaveIllustration className="rw-empty-art" />
      <h2 className="rw-empty-title">This wave is empty</h2>
      <p className="rw-empty-text">
        Post the first blip to start the thread. Mention{" "}
        <span className="ink-chip rw-mention">@scribe</span> ,{" "}
        <span className="ink-chip rw-mention">@skeptic</span> , or{" "}
        <span className="ink-chip rw-mention">@researcher</span> to bring an agent in.
      </p>
    </DashedPanel>
  );
}
