/**
 * Custom server: Next.js + Socket.IO for realtime chat and collaborative editing.
 * Run with: npm run dev
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { registerCollabServer } from "./src/lib/collab/register-collab-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const publicUrl = process.env.NEXTAUTH_URL;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketServer(httpServer, {
    path: "/socket.io",
    cors: dev
      ? { origin: "*", credentials: true }
      : publicUrl
        ? { origin: publicUrl, credentials: true }
        : { origin: false, credentials: true },
  });

  registerCollabServer(io);

  io.on("connection", (socket) => {
    socket.on("join-project", (projectId: string) => {
      socket.join(`project:${projectId}`);
    });

    socket.on("join-channel", ({ projectId, channelId }: { projectId: string; channelId: string }) => {
      socket.join(`project:${projectId}:channel:${channelId}`);
    });

    socket.on("leave-channel", ({ projectId, channelId }: { projectId: string; channelId: string }) => {
      socket.leave(`project:${projectId}:channel:${channelId}`);
    });

    socket.on("chat-message", ({ projectId, message }) => {
      socket.to(`project:${projectId}`).emit("chat-message", message);
    });

    socket.on("channel-message", ({ projectId, channelId, message }) => {
      socket.to(`project:${projectId}:channel:${channelId}`).emit("channel-message", message);
    });
  });

  httpServer.listen(port, hostname, () => {
    const url = publicUrl || `http://localhost:${port}`;
    console.log(`> Manifold ready on ${url} (listening ${hostname}:${port})`);
  });
});
