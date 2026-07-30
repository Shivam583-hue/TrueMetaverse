import { WebSocketServer, WebSocket } from "ws";
import { User } from "./User";
import { createHeartbeat } from "./heartbeat";
import { logger } from "./logger";

const port = Number(process.env.PORT ?? 3001);
const wss = new WebSocketServer({ port });

logger.info({ port }, "websocket server listening");

const heartbeat = createHeartbeat(wss);

wss.on("connection", function connection(ws: WebSocket) {
  const user = new User(ws);
  const connectionLog = logger.child({ connectionId: user.id });
  connectionLog.debug("socket connected");
  heartbeat.markAlive(ws);
  ws.on("error", (err) => connectionLog.error({ err }, "socket error"));
  ws.on("pong", () => heartbeat.markAlive(ws));

  ws.on("close", (code) => {
    user.destroy();
    connectionLog.debug({ code }, "socket closed");
  });
});

wss.on("error", (err) => logger.error({ err }, "websocket server error"));
wss.on("close", () => heartbeat.stop());
