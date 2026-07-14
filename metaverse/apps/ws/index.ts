import { WebSocketServer, WebSocket } from "ws";
import { User } from "./User";

const port = Number(process.env.PORT ?? 3001);
const wss = new WebSocketServer({ port });

console.log(`WebSocket server listening on ${port}`);

wss.on("connection", function connection(ws: WebSocket) {
  console.log("user connected");
  let user = new User(ws);
  ws.on("error", console.error);

  ws.on("close", () => {
    user?.destroy();
  });
});
