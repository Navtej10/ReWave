import { DashedPanel } from "../../components/ui/index";
import { Mention } from "./Mention";
import { WaveIllustration } from "./WaveIllustration";

export function EmptyWave() {
  return (
    <DashedPanel className="wp-empty">
      <WaveIllustration className="wp-empty__art" />
      <h3 className="wp-empty__title">This wave is empty</h3>
      <p className="wp-empty__text">
        Post the first blip to start the thread. Mention <Mention name="scribe" />, <Mention name="skeptic" />, or{" "}
        <Mention name="researcher" /> to bring an agent in.
      </p>
    </DashedPanel>
  );
}
