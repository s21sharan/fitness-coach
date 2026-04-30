import express from "express";
import { config } from "./config.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { logger } from "./utils/logger.js";

const app = express();
app.use(express.json());

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Protected routes (added in later tasks)
// app.use("/sync", apiKeyAuth, syncRoutes);
// app.use("/webhooks", webhookRoutes);

app.listen(config.port, () => {
  logger.info("Server started", { port: config.port });
});

export { app };
