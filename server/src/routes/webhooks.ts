import { Router, type Request, type Response } from "express";
import { supabase } from "../db.js";
import { config } from "../config.js";
import { syncStravaActivity } from "../sync/strava.js";
import { logger } from "../utils/logger.js";

export function verifyStravaWebhook(
  mode: string,
  challenge: string,
  verifyToken: string,
  expectedToken: string,
): { "hub.challenge": string } | null {
  if (mode === "subscribe" && verifyToken === expectedToken) {
    return { "hub.challenge": challenge };
  }
  return null;
}

export function createWebhookRouter(): Router {
  const router = Router();

  router.get("/strava", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string;
    const challenge = req.query["hub.challenge"] as string;
    const verifyToken = req.query["hub.verify_token"] as string;

    const result = verifyStravaWebhook(mode, challenge, verifyToken, config.stravaWebhookVerifyToken);
    if (result) {
      res.json(result);
    } else {
      res.status(403).json({ error: "Verification failed" });
    }
  });

  router.post("/strava", async (req: Request, res: Response) => {
    const { object_type, object_id, aspect_type, owner_id } = req.body as {
      object_type: string;
      object_id: number;
      aspect_type: string;
      owner_id: number;
    };

    res.status(200).json({ received: true });

    if (object_type !== "activity") return;

    try {
      const { data: integration } = await supabase
        .from("integrations")
        .select("user_id")
        .eq("provider", "strava")
        .eq("provider_user_id", String(owner_id))
        .single();

      if (!integration) {
        logger.warn("Strava webhook: no user found for athlete", { owner_id });
        return;
      }

      if (aspect_type === "create" || aspect_type === "update") {
        await syncStravaActivity(integration.user_id, object_id);
        logger.info("Strava webhook: synced activity", { userId: integration.user_id, activityId: object_id });
      } else if (aspect_type === "delete") {
        await supabase
          .from("cardio_logs")
          .delete()
          .eq("user_id", integration.user_id)
          .eq("activity_id", String(object_id));
        logger.info("Strava webhook: deleted activity", { userId: integration.user_id, activityId: object_id });
      }
    } catch (err) {
      logger.error("Strava webhook processing failed", { error: String(err), object_id });
    }
  });

  return router;
}
