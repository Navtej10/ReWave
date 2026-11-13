import { useEffect, useMemo, useRef, useState } from "react";
import { Chip } from "../ui/index";
import { CheckIcon, CopyIcon } from "./richIcons";
import type { CodeSnippet } from "../../wave/types";

type TokenKind = "kw" | "str" | "com" | "num";
interface Token {
  text: string;
  kind?: TokenKind;
}

const KEYWORDS = new Set(
  (
    "const let var function return if else for while do switch case break continue new class extends import export from default " +
    "async await try catch finally throw typeof instanceof in of this null true false undefined void type interface enum " +
    "def lambda pass None True False and or not is elif with as yield self fn pub use mut impl struct match go func package " +
    "select insert update delete where join group order by limit create table into values set"
  ).split(" "),
);

const HASH_COMMENT = /^(py|python|sh|bash|shell|zsh|yaml|yml|ruby|rb|toml|r)$/i;
const DASH_COMMENT = /^(sql|lua|hs|haskell)$/i;

function commentSource(language: string): string {
  if (HASH_COMMENT.test(language)) return "#.*";
  if (DASH_COMMENT.test(language)) return "--.*";
  return "\\/\\/.*|\\/\\*.*?\\*\\/";
}

/** Small per-line tokenizer. Multi-line comments and strings are not tracked; that is fine for snippets. */
export function tokenizeLine(line: string, language: string): Token[] {
  const re = new RegExp(
    `(${commentSource(language)})|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b[A-Za-z_$][\\w$]*\\b)`,
    "g",
  );
  const out: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ text: line.slice(last, idx) });
    if (m[1]) out.push({ text: m[0], kind: "com" });
    else if (m[2]) out.push({ text: m[0], kind: "str" });
    else if (m[3]) out.push({ text: m[0], kind: "num" });
    else if (KEYWORDS.has(m[0])) out.push({ text: m[0], kind: "kw" });
    else out.push({ text: m[0] });
    last = idx + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

export function CodeBlip({ snippet }: { snippet: CodeSnippet }) {
  const [copied, setCopied] = useState(false);
  const [numbers, setNumbers] = useState(Boolean(snippet.lineNumbers));
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lines = useMemo(
    () => snippet.code.split("\n").map((l) => tokenizeLine(l, snippet.language)),
    [snippet.code, snippet.language],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: nothing useful to do */
    }
  }

  return (
    <div className="sketch sketch-a rc-code">
      <div className="rc-code__bar">
        <Chip className="rc-code__lang">{snippet.language || "text"}</Chip>
        <span className="rc-code__tools">
          <button type="button" className="rc-linkbtn" aria-pressed={numbers} onClick={() => setNumbers((v) => !v)}>
            Line numbers
          </button>
          <button type="button" className="sketch sketch-b rc-code__copy" onClick={copy}>
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </div>
      <span className="rc-sr-only" role="status">
        {copied ? "Code copied to clipboard" : ""}
      </span>
      <pre className="rc-code__pre" tabIndex={0} aria-label={`${snippet.language || "text"} code`}>
        <code>
          {lines.map((tokens, i) => (
            <span key={i} className="rc-code__line">
              {numbers ? (
                <span className="rc-code__ln" aria-hidden="true">
                  {i + 1}
                </span>
              ) : null}
              {tokens.map((t, j) =>
                t.kind ? (
                  <span key={j} className={`tok-${t.kind}`}>
                    {t.text}
                  </span>
                ) : (
                  t.text
                ),
              )}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
