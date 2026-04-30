import { Router, type Request, type Response } from "express";
import { supabase } from "../db.js";
import { syncAllMacroFactor, syncMacroFactorForUser } from "../sync/macrofactor.js";
import { syncAllHevy, syncHevyForUser } from "../sync/hevy.js";
import { syncAllStrava, syncStravaForUser } from "../sync/strava.js";
import { syncAllGarmin, syncGarminForUser } from "../sync/garmin.js";
import { logger } from "../utils/logger.js";

const VALID_PROVIDERS = ["macrofactor", "hevy", "strava", "garmin"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

const syncAllFns: Record<Provider, () => Promise<void>> = {
  macrofactor: syncAllMacroFactor,
  hevy: syncAllHevy,
  strava: syncAllStrava,
  garmin: syncAllGarmin,
};

export function createSyncRouter(): Router {
  const router = Router();

  router.post("/trigger", async (req: Request, res: Response) => {
    const { provider, userId } = req.body as { provider?: string; userId?: string };

    if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` });
      return;
    }

    try {
      if (userId) {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", userId)
          .eq("provider", provider)
          .single();

        if (!integration) {
          res.status(404).json({ error: "Integration not found" });
          return;
        }

        logger.info("Triggering sync for user", { provider, userId });
        triggerUserSync(provider as Provider, integration).catch((err) =>
          logger.error("Triggered sync failed", { provider, userId, error: String(err) }),
        );
        res.json({ status: "triggered", provider, userId });
      } else {
        logger.info("Triggering sync for all users", { provider });
        syncAllFns[provider as Provider]().catch((err) =>
          logger.error("Triggered sync-all failed", { provider, error: String(err) }),
        );
        res.json({ status: "triggered", provider, scope: "all" });
      }
    } catch (err) {
      logger.error("Sync trigger failed", { error: String(err) });
      res.status(500).json({ error: "Sync trigger failed" });
    }
  });

  router.post("/backfill", async (req: Request, res: Response) => {
    const { provider, userId, since } = req.body as { provider?: string; userId?: string; since?: string };

    if (!provider || !userId || !since) {
      res.status(400).json({ error: "provider, userId, and since are required" });
      return;
    }

    if (!VALID_PROVIDERS.includes(provider as Provider)) {
      res.status(400).json({ error: `Invalid provider` });
      return;
    }

    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .single();

    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    logger.info("Starting backfill", { provider, userId, since });
    triggerUserSync(provider as Provider, integration, since).catch((err) =>
      logger.error("Backfill failed", { provider, userId, error: String(err) }),
    );

    res.json({ status: "backfill_started", provider, userId, since });
  });

  return router;
}

async function triggerUserSync(provider: Provider, integration: Record<string, unknown>, since?: string): Promise<void> {
  const userId = integration.user_id as string;
  switch (provider) {
    case "macrofactor":
      await syncMacroFactorForUser(userId, integration.credentials as { email: string; password: string }, since);
      break;
    case "hevy":
      await syncHevyForUser(userId, integration.access_token as string, since);
      break;
    case "strava": {
      const sinceEpoch = since ? Math.floor(new Date(since).getTime() / 1000) : undefined;
      await syncStravaForUser(userId, sinceEpoch);
      break;
    }
    case "garmin":
      await syncGarminForUser(userId, integration.credentials as { email: string; password: string }, since);
      break;
  }
}
