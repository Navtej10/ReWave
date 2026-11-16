/** One message recovered from pasted text. */
export interface ImportedMessage {
  author: string;
  text: string;
}

export const IMPORT_AUTHOR = "imported";
export const IMPORT_MAX_MESSAGES = 100;
export const IMPORT_MAX_CHARS = 2000;

const EMAIL_HEADER = /^(to|cc|bcc|date|sent|subject|reply-to):/i;
const FROM_LINE = /^from:\s*(.+)$/i;
// "Asha: text", "[10:42] Asha: text", "10:42 Asha: text"
const CHAT_LINE = /^(?:\[?\d{1,2}:\d{2}(?:\s?[AaPp][Mm])?\]?\s+)?([A-Za-z][\w .'-]{0,29}?):\s+(\S.*)$/;
// Slack copy: "Asha  10:42 AM" on its own line, message on the following lines.
const SLACK_HEADER = /^(.{1,40}?)\s+\[?\d{1,2}:\d{2}(?:\s?[AaPp][Mm])?\]?$/;

function nameOnly(from: string): string {
  // "Asha Rao <asha@x.com>" -> "Asha Rao"
  return from.replace(/<[^>]*>/g, "").replace(/["']/g, "").trim() || IMPORT_AUTHOR;
}

function finish(messages: ImportedMessage[]): ImportedMessage[] {
  return messages
    .map((m) => ({ author: m.author, text: m.text.trim().slice(0, IMPORT_MAX_CHARS) }))
    .filter((m) => m.text)
    .slice(0, IMPORT_MAX_MESSAGES);
}

function parseEmail(lines: string[]): ImportedMessage[] {
  const out: ImportedMessage[] = [];
  let cur: { author: string; body: string[] } | null = null;
  let inHeader = false;
  for (const line of lines) {
    const from = FROM_LINE.exec(line.trim());
    if (from) {
      if (cur) out.push({ author: cur.author, text: cur.body.join("\n") });
      cur = { author: nameOnly(from[1]), body: [] };
      inHeader = true;
      continue;
    }
    if (!cur) continue;
    if (inHeader && (EMAIL_HEADER.test(line.trim()) || line.trim() === "")) {
      if (line.trim() === "" && cur.body.length === 0) inHeader = false;
      continue;
    }
    inHeader = false;
    if (/^>/.test(line)) continue; // quoted reply text
    cur.body.push(line);
  }
  if (cur) out.push({ author: cur.author, text: cur.body.join("\n") });
  return finish(out);
}

function parseSlack(lines: string[]): ImportedMessage[] | null {
  const headers = lines.filter((l) => SLACK_HEADER.test(l.trim()) && !CHAT_LINE.test(l.trim())).length;
  if (headers < 2) return null;
  const out: ImportedMessage[] = [];
  let cur: { author: string; body: string[] } | null = null;
  for (const line of lines) {
    const h = SLACK_HEADER.exec(line.trim());
    if (h && !CHAT_LINE.test(line.trim())) {
      if (cur) out.push({ author: cur.author, text: cur.body.join("\n") });
      cur = { author: h[1].trim(), body: [] };
    } else if (cur) cur.body.push(line);
  }
  if (cur) out.push({ author: cur.author, text: cur.body.join("\n") });
  return finish(out);
}

function parseChat(lines: string[]): ImportedMessage[] | null {
  const matches = lines.filter((l) => CHAT_LINE.test(l.trim())).length;
  if (matches < 2) return null;
  const out: ImportedMessage[] = [];
  let cur: { author: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = CHAT_LINE.exec(line.trim());
    if (m) {
      if (cur) out.push({ author: cur.author, text: cur.body.join("\n") });
      cur = { author: m[1].trim(), body: [m[2]] };
    } else if (cur) cur.body.push(line);
  }
  if (cur) out.push({ author: cur.author, text: cur.body.join("\n") });
  return finish(out);
}

/**
 * Split pasted email / Slack / chat text into messages. Falls back to one message per blank-line-
 * separated paragraph, authored "imported". Capped at 100 messages of 2000 characters each.
 */
export function parseThread(raw: string): ImportedMessage[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  if (lines.some((l) => FROM_LINE.test(l.trim()))) {
    const email = parseEmail(lines);
    if (email.length > 0) return email;
  }
  const slack = parseSlack(lines);
  if (slack && slack.length > 0) return slack;
  const chat = parseChat(lines);
  if (chat && chat.length > 0) return chat;
  return finish(
    raw
      .replace(/\r\n?/g, "\n")
      .split(/\n\s*\n/)
      .map((p) => ({ author: IMPORT_AUTHOR, text: p })),
  );
}
