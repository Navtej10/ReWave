import { describe, expect, it } from "vitest";
import { crc32, makeZip } from "./zip";

/** Read a stored-entry ZIP back through its central directory. */
function readZip(zip: Uint8Array): Record<string, string> {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const dec = new TextDecoder();
  const endAt = zip.length - 22;
  expect(dv.getUint32(endAt, true)).toBe(0x06054b50);
  const count = dv.getUint16(endAt + 10, true);
  let at = dv.getUint32(endAt + 16, true);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(at, true)).toBe(0x02014b50);
    const crc = dv.getUint32(at + 16, true);
    const size = dv.getUint32(at + 24, true);
    const nameLen = dv.getUint16(at + 28, true);
    const local = dv.getUint32(at + 42, true);
    const name = dec.decode(zip.subarray(at + 46, at + 46 + nameLen));
    expect(dv.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = zip.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out[name] = dec.decode(data);
    at += 46 + nameLen;
  }
  return out;
}

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("makeZip", () => {
  it("round-trips paths and text, including non-ASCII", () => {
    const files = {
      ".kiro/specs/ship/requirements.md": "# Requirements\n",
      ".kiro/specs/ship/design.md": "caf\u00e9 \u2713\n",
      ".kiro/specs/ship/tasks.md": "",
    };
    expect(readZip(makeZip(files))).toEqual(files);
  });

  it("is deterministic and handles an empty archive", () => {
    expect(makeZip({ "a.md": "x" })).toEqual(makeZip({ "a.md": "x" }));
    expect(readZip(makeZip({}))).toEqual({});
  });
});
