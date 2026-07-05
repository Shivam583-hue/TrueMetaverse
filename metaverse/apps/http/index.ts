import express from "express"
import { router } from "./routes/v1"
import client from "@repo/db"

const app = express()

app.use("/api/v1", router)

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running at port 3000")
})
