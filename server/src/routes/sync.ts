import { Router, type Request, type Response } from "express";
import { supabase } from "../db.js";
import { syncAllHevy, syncHevyForUser } from "../sync/hevy.js";
import { syncAllStrava, syncStravaForUser } from "../sync/strava.js";
import { syncAllGarmin, syncGarminForUser } from "../sync/garmin.js";
import { reconcileUserActivities } from "../sync/reconcile.js";
import { logger } from "../utils/logger.js";

const VALID_PROVIDERS = ["hevy", "strava", "garmin"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    return cause ? `${err.message} (cause: ${formatError(cause)})` : (err.stack || err.message);
  }
  if (err && typeof err === "object") {
    try { return JSON.stringify(err); } catch { return Object.prototype.toString.call(err); }
  }
  return String(err);
}

const syncAllFns: Record<Provider, () => Promise<void>> = {
  hevy: syncAllHevy,
  strava: syncAllStrava,
  garmin: syncAllGarmin,
};

export function createSyncRouter(): Router {
  const router = Router();

  router.post("/trigger", async (req: Request, res: Response) => {
    const { provider, userId, mfa_code } = req.body as {
      provider?: string;
      userId?: string;
      mfa_code?: string;
    };

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
        triggerUserSync(provider as Provider, integration, undefined, mfa_code).catch((err) =>
          logger.error("Triggered sync failed", { provider, userId, error: formatError(err) }),
        );
        res.json({ status: "triggered", provider, userId });
      } else {
        logger.info("Triggering sync for all users", { provider });
        syncAllFns[provider as Provider]().catch((err) =>
          logger.error("Triggered sync-all failed", { provider, error: formatError(err) }),
        );
        res.json({ status: "triggered", provider, scope: "all" });
      }
    } catch (err) {
      logger.error("Sync trigger failed", { error: formatError(err) });
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
      logger.error("Backfill failed", { provider, userId, error: formatError(err) }),
    );

    res.json({ status: "backfill_started", provider, userId, since });
  });

  // Recompute provider-priority suppression across cardio_logs + workout_logs
  // for one user. Called after a provider is disconnected so previously-hidden
  // rows from lower-priority sources can re-surface.
  router.post("/reconcile", async (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    try {
      await reconcileUserActivities(userId);
      res.json({ status: "reconciled", userId });
    } catch (err) {
      logger.error("Reconcile failed", { userId, error: formatError(err) });
      res.status(500).json({ error: "Reconcile failed" });
    }
  });

  return router;
}

async function triggerUserSync(
  provider: Provider,
  integration: Record<string, unknown>,
  since?: string,
  mfaCode?: string,
): Promise<void> {
  const userId = integration.user_id as string;
  // Fall back to the integration's last successful sync so manual triggers
  // do an incremental pull rather than hitting the per-provider "last 24h"
  // floor — that floor caused users to see only one day of activities when
  // they hit Sync some time after the previous run.
  const effectiveSince = since ?? (integration.last_synced_at as string | null) ?? undefined;
  switch (provider) {
    case "hevy":
      await syncHevyForUser(userId, integration.access_token as string, effectiveSince);
      break;
    case "strava": {
      const sinceEpoch = effectiveSince ? Math.floor(new Date(effectiveSince).getTime() / 1000) : undefined;
      await syncStravaForUser(userId, sinceEpoch);
      break;
    }
    case "garmin":
      await syncGarminForUser(
        userId,
        integration.credentials as { email: string; password: string },
        effectiveSince,
        mfaCode,
      );
      break;
  }
}
