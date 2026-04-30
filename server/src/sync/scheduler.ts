import cron from "node-cron";
import { syncAllMacroFactor } from "./macrofactor.js";
import { syncAllHevy } from "./hevy.js";
import { syncAllStrava } from "./strava.js";
import { syncAllGarmin } from "./garmin.js";
import { logger } from "../utils/logger.js";

export function startScheduler(): void {
  cron.schedule("0 */6 * * *", () => {
    logger.info("Cron: starting MacroFactor sync");
    syncAllMacroFactor().catch((err) => logger.error("Cron: MacroFactor sync failed", { error: String(err) }));
  });

  cron.schedule("0 1,7,13,19 * * *", () => {
    logger.info("Cron: starting Hevy sync");
    syncAllHevy().catch((err) => logger.error("Cron: Hevy sync failed", { error: String(err) }));
  });

  cron.schedule("0 3 * * *", () => {
    logger.info("Cron: starting Strava fallback sync");
    syncAllStrava().catch((err) => logger.error("Cron: Strava sync failed", { error: String(err) }));
  });

  cron.schedule("0 2,14 * * *", () => {
    logger.info("Cron: starting Garmin sync");
    syncAllGarmin().catch((err) => logger.error("Cron: Garmin sync failed", { error: String(err) }));
  });

  logger.info("Sync scheduler started");
}
