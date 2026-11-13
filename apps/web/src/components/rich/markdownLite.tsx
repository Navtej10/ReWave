import type { ReactNode } from "react";
import { Chip } from "../ui/index";
import { AGENT_NAMES } from "../../wave/agents";
import type { AgentName, CodeSnippet } from "../../wave/types";

/** Pull the first ```lang fenced block out of a draft so it can become a code blip. */
export function extractFencedCode(text: string): { text: string; code?: CodeSnippet } {
  const m = /```([\w+#-]*)[ \t]*\n([\s\S]*?)\n?```/.exec(text);
  if (!m || !m[2].trim()) return { text };
  const rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  return { text: rest, code: { language: m[1] || "text", code: m[2].replace(/\s+$/, "") } };
}

export interface RichTextProps {
  text: string;
  currentUserName: string;
  /** Called when a [b:<id>] citation is clicked. */
  onJump?: (blipId: string) => void;
}

const INLINE =
  /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(https?:\/\/[^\s<]+)|(\[b:[A-Za-z0-9_-]+\])|(@[A-Za-z][\w-]*)/g;

function isAgent(name: string): name is AgentName {
  return (AGENT_NAMES as readonly string[]).includes(name);
}

function inline(line: string, props: RichTextProps, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  const push = (node: ReactNode) => out.push(node);
  for (const m of line.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    const token = m[0];
    if (idx > last) push(line.slice(last, idx));
    const key = `${keyBase}-${n++}`;
    if (m[1]) push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (m[2]) push(<em key={key}>{token.slice(1, -1)}</em>);
    else if (m[3]) push(<code key={key} className="rc-inline-code">{token.slice(1, -1)}</code>);
    else if (m[4]) {
      const href = token.replace(/[.,;:!?)\]]+$/, "");
      push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer">
          {href}
        </a>,
      );
      last = idx + href.length;
      continue;
    } else if (m[5]) {
      const id = token.slice(3, -1);
      push(
        <button key={key} type="button" className="rc-cite" aria-label="Jump to source blip" onClick={() => props.onJump?.(id)}>
          source
        </button>,
      );
    } else if (m[6]) {
      const before = idx > 0 ? line[idx - 1] : "";
      if (/\w/.test(before)) {
        push(token); // part of an email address, not a mention
      } else {
        const name = token.slice(1);
        const lower = name.toLowerCase();
        const me = lower === props.currentUserName.trim().toLowerCase();
        push(
          <Chip key={key} className={me ? "rc-mention is-me" : isAgent(lower) ? "rc-mention" : "rc-mention is-person"}>
            @{isAgent(lower) ? lower : name}
            {me ? <span className="rc-sr-only"> (you)</span> : null}
          </Chip>,
        );
      }
    }
    last = idx + token.length;
  }
  if (last < line.length) push(line.slice(last));
  return out;
}

type Block = { type: "p"; lines: string[] } | { type: "ul" | "ol"; items: string[] };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const tail = blocks[blocks.length - 1];
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      const item = (ul ?? ol)![1];
      if (tail && tail.type === type) tail.items.push(item);
      else blocks.push({ type, items: [item] });
    } else if (line.trim() === "") {
      blocks.push({ type: "p", lines: [] }); // paragraph break
    } else if (tail && tail.type === "p") {
      tail.lines.push(line); // continues the paragraph (or starts one after a blank-line break)
    } else {
      blocks.push({ type: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => b.type !== "p" || b.lines.length > 0);
}

/** **bold**, *italic*, `code`, lists, links, @mentions and [b:id] citations. No raw HTML is ever produced. */
export function RichText(props: RichTextProps) {
  const blocks = toBlocks(props.text);
  return (
    <div className="rc-rich">
      {blocks.map((b, i) => {
        if (b.type === "p") {
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <span key={j}>
                  {j > 0 ? <br /> : null}
                  {inline(l, props, `p${i}-${j}`)}
                </span>
              ))}
            </p>
          );
        }
        const Tag = b.type;
        return (
          <Tag key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, props, `l${i}-${j}`)}</li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
