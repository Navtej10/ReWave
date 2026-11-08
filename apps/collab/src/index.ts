import { Server } from "@hocuspocus/server";

const port = Number(process.env.COLLAB_PORT ?? 1234);

// Access control for private waves. The wave id is the capability: only a well-formed,
// unguessable wave id names a real room. We refuse anything else (probes for "index",
// "admin", short strings, bad characters) so no one can open or create arbitrary rooms.
//
// SOURCE OF TRUTH for this rule is apps/web/src/wave/waveId.ts (`isValidWaveId`). It is
// duplicated here because apps/collab is a separate package and cannot import from the web
// app. A property test in apps/web (wave/waveId.property.test.ts) asserts the two copies
// agree so they cannot drift. Keep the regex and reserved set below in sync with that file.
const WAVE_ID_RE = /^[A-Za-z0-9_-]{22}$/;
const RESERVED_IDS = new Set(["index"]);

function isValidWaveId(name: string): boolean {
  if (typeof name !== "string") return false;
  if (RESERVED_IDS.has(name)) return false; // the shared "index" document no longer exists
  return WAVE_ID_RE.test(name);
}

// Live sync for every wave. Each wave id is a Yjs document room.
// Persistence is in-memory for now (see .kiro/specs/01-live-wave-sync, task 5).
const server = Server.configure({
  port,
  async onConnect({ documentName }) {
    // Throwing in onConnect rejects the Promise and terminates the connection before any
    // document is opened (Hocuspocus hook lifecycle). This is how we refuse non-wave rooms.
    if (!isValidWaveId(documentName)) {
      console.warn(`[collab] rejected connection to invalid document "${documentName}"`);
      throw new Error("invalid wave id");
    }
    console.log(`[collab] client connected to wave "${documentName}"`);
  },
});

server.listen();
console.log(`[collab] sync server listening on ws://127.0.0.1:${port}`);
