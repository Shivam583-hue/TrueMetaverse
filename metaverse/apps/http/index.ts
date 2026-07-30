import express from "express";
import helmet from "helmet";
import { installLifecycle } from "@repo/lifecycle";
import { disconnect } from "@repo/db/client";
import { router } from "./routes/v1";
import { apiLimiter } from "./middleware/rateLimit";
import { requestContext } from "./middleware/requestContext";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./logger";

const app = express();

app.set("trust proxy", 1);
app.use(requestContext);
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", service: "http" });
});
app.use("/api/v1", apiLimiter, router);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => {
  logger.info({ port }, "http server listening");
});

installLifecycle({
  logger,
  steps: [
    {
      name: "http-server",
      run: () =>
        new Promise<void>((resolve) => {
          server.closeIdleConnections?.();
          server.close(() => resolve());
        }),
    },
    { name: "database", run: () => disconnect() },
  ],
});
