function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  apiSecret: required("API_SECRET"),
  encryptionKey: required("ENCRYPTION_KEY"),
  garminServiceUrl: process.env.GARMIN_SERVICE_URL || "http://localhost:8000",
  stravaClientId: required("STRAVA_CLIENT_ID"),
  stravaClientSecret: required("STRAVA_CLIENT_SECRET"),
  stravaWebhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || "hybro-strava-verify",
  macrofactorFirebaseApiKey: required("MACROFACTOR_FIREBASE_API_KEY"),
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
} as const;
