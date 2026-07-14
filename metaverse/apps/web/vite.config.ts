import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function collisionWriter(): Plugin {
  return {
    name: "space-collision-writer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/^\/__space-tools\/collision\/([\w-]+)$/);
        if (!match || req.method !== "PUT") return next();
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const rows: unknown = JSON.parse(body);
            const valid =
              Array.isArray(rows) &&
              rows.length > 0 &&
              rows.every(
                (row) =>
                  Array.isArray(row) &&
                  row.every((cell) => cell === 0 || cell === 1),
              );
            if (!valid) throw new Error("not a 2D 0/1 array");
            const dir = path.resolve(
              __dirname,
              "public/assets/spaces",
              match[1]!,
            );
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(
              path.join(dir, "collision.json"),
              JSON.stringify(rows),
            );
            res.statusCode = 204;
            res.end();
          } catch {
            res.statusCode = 400;
            res.end("invalid collision grid");
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), collisionWriter()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
      "/socket": {
        target: process.env.VITE_WS_PROXY_TARGET ?? "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
