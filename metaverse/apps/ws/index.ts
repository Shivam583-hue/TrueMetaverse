import { WebSocketServer, WebSocket } from "ws";
import { User } from "./User";
import { createHeartbeat } from "./heartbeat";

const port = Number(process.env.PORT ?? 3001);
const wss = new WebSocketServer({ port });

console.log(`WebSocket server listening on ${port}`);

const heartbeat = createHeartbeat(wss);

wss.on("connection", function connection(ws: WebSocket) {
  console.log("user connected");
  let user = new User(ws);
  heartbeat.markAlive(ws);
  ws.on("error", console.error);
  ws.on("pong", () => heartbeat.markAlive(ws));

  ws.on("close", () => {
    user?.destroy();
  });
});

wss.on("close", () => heartbeat.stop());
