import express from "express";
import { config } from "./config.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { createSyncRouter } from "./routes/sync.js";
import { createWebhookRouter } from "./routes/webhooks.js";
import { createStripeWebhookRouter } from "./routes/stripe-webhooks.js";
import { startScheduler } from "./sync/scheduler.js";
import { logger } from "./utils/logger.js";

const app = express();

// Stripe webhook needs raw body — mount before express.json()
app.use("/webhooks", createStripeWebhookRouter());

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/sync", apiKeyAuth, createSyncRouter());
app.use("/webhooks", createWebhookRouter());

app.listen(config.port, () => {
  logger.info("Server started", { port: config.port });
  startScheduler();
});

export { app };
