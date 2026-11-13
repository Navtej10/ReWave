import { Chip } from "../../components/ui/index";
import type { AgentName } from "./types";

/** Inline @agent chip used inside running text. */
export function Mention({ name }: { name: AgentName }) {
  return <Chip className="wp-mention">@{name}</Chip>;
}
