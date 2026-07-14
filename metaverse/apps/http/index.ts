import express from "express";
import { router } from "./routes/v1";

const app = express();

app.use(express.json());
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", service: "http" });
});
app.use("/api/v1", router);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`HTTP server listening on ${port}`);
});
