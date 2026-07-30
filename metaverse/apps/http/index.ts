import express from "express";
import helmet from "helmet";
import { router } from "./routes/v1";
import { apiLimiter } from "./middleware/rateLimit";
import { logger } from "./logger";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", service: "http" });
});
app.use("/api/v1", apiLimiter, router);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  logger.info({ port }, "http server listening");
});
