import { Server } from "@hocuspocus/server";

const port = Number(process.env.COLLAB_PORT ?? 1234);

// Live sync for every wave. Each wave id is a Yjs document room.
// Persistence is in-memory for now (see .kiro/specs/01-live-wave-sync, task 5).
const server = Server.configure({
  port,
  async onConnect({ documentName }) {
    console.log(`[collab] client connected to wave "${documentName}"`);
  },
});

server.listen();
console.log(`[collab] sync server listening on ws://127.0.0.1:${port}`);
