# Phase 3: Integrations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Hybro to MacroFactor, Hevy, Strava, and Garmin — syncing nutrition, workout, cardio, and recovery data into Supabase on a cron schedule. Build a Railway Express backend for sync workers, a Python FastAPI microservice for Garmin, and frontend UI for managing integrations.

**Architecture:** Split approach — Next.js API routes handle user-facing OAuth/connection flows, Railway Express backend runs cron-based sync workers, Python FastAPI microservice proxies Garmin's unofficial API. Supabase is the shared data layer.

**Tech Stack:** Express, node-cron, Supabase service-role client, Python FastAPI, garminconnect, Clerk auth, React, Tailwind, shadcn/ui, Vitest

**Design Spec:** `docs/superpowers/specs/2026-04-29-phase3-integrations-design.md`

---

## File Structure

```
# Infrastructure
src/lib/encryption.ts                                    # AES-256-GCM encrypt/decrypt
supabase/migrations/002_sync_logs.sql                    # sync_logs table

# Railway Express Backend
server/package.json
server/tsconfig.json
server/Dockerfile
server/.env.example
server/src/index.ts                                      # Express entry + cron setup
server/src/config.ts                                     # Env vars + constants
server/src/db.ts                                         # Supabase service-role client
server/src/middleware/auth.ts                             # X-API-Key middleware
server/src/utils/encryption.ts                           # Encryption (same as frontend)
server/src/utils/logger.ts                               # Structured logger
server/src/integrations/macrofactor-client.ts             # Firebase auth + Firestore
server/src/integrations/hevy-client.ts                   # Hevy REST API
server/src/integrations/strava-client.ts                 # Strava OAuth + Activities API
server/src/integrations/token-manager.ts                 # Generic token refresh
server/src/sync/base.ts                                  # Shared sync worker pattern
server/src/sync/macrofactor.ts                           # MF sync worker
server/src/sync/hevy.ts                                  # Hevy sync worker
server/src/sync/strava.ts                                # Strava sync worker
server/src/sync/garmin.ts                                # Garmin sync worker
server/src/sync/scheduler.ts                             # Cron orchestrator
server/src/routes/sync.ts                                # /sync/trigger, /sync/backfill
server/src/routes/webhooks.ts                            # /webhooks/strava

# Garmin Python Service
services/garmin/requirements.txt
services/garmin/Dockerfile
services/garmin/main.py                                  # FastAPI app
services/garmin/garmin_client.py                         # garminconnect wrapper
services/garmin/test_main.py                             # Tests

# Next.js API Routes
src/app/api/integrations/macrofactor/connect/route.ts
src/app/api/integrations/hevy/connect/route.ts
src/app/api/integrations/strava/authorize/route.ts
src/app/api/integrations/strava/callback/route.ts
src/app/api/integrations/garmin/connect/route.ts
src/app/api/integrations/[provider]/disconnect/route.ts
src/app/api/integrations/[provider]/sync/route.ts
src/app/api/integrations/status/route.ts

# Frontend Components
src/components/settings/integration-card.tsx
src/components/settings/credentials-modal.tsx
src/components/settings/api-key-modal.tsx
src/components/dashboard/sync-status.tsx

# Modified Files
src/app/dashboard/settings/page.tsx                      # Real integration management
src/app/dashboard/page.tsx                               # Add sync status section
src/components/onboarding/step-integrations.tsx           # Wire connect buttons

# Test Files
__tests__/lib/encryption.test.ts
server/__tests__/integrations/macrofactor-client.test.ts
server/__tests__/integrations/hevy-client.test.ts
server/__tests__/integrations/strava-client.test.ts
server/__tests__/sync/macrofactor.test.ts
server/__tests__/sync/hevy.test.ts
server/__tests__/sync/strava.test.ts
server/__tests__/sync/garmin.test.ts
server/__tests__/routes/sync.test.ts
server/__tests__/routes/webhooks.test.ts
__tests__/app/api/integrations/connect.test.ts
__tests__/app/api/integrations/status.test.ts
__tests__/components/settings/integration-card.test.tsx
```

---

## Task 1: Encryption Utilities + Database Migration

**Files:**
- Create: `src/lib/encryption.ts`
- Create: `server/src/utils/encryption.ts` (identical copy)
- Create: `supabase/migrations/002_sync_logs.sql`
- Test: `__tests__/lib/encryption.test.ts`

- [ ] **Step 1: Write encryption tests**

```typescript
// __tests__/lib/encryption.test.ts
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";

describe("encryption", () => {
  const key = "a".repeat(64); // 32 bytes hex-encoded

  it("encrypts and decrypts a string", () => {
    const plaintext = "my-secret-password";
    const encrypted = encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(":"); // iv:authTag:ciphertext format
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("test", key);
    const tampered = encrypted.slice(0, -2) + "ff";
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("encrypts and decrypts JSON objects", () => {
    const obj = { email: "user@test.com", password: "pass123" };
    const encrypted = encrypt(JSON.stringify(obj), key);
    const decrypted = JSON.parse(decrypt(encrypted, key));
    expect(decrypted).toEqual(obj);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/encryption.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement encryption module**

```typescript
// src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encryptedStr: string, hexKey: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encryptedStr.split(":");
  const key = Buffer.from(hexKey, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/lib/encryption.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Create database migration**

```sql
-- supabase/migrations/002_sync_logs.sql
create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('success', 'error')),
  records_synced integer default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.sync_logs enable row level security;

create policy "Users can view own sync logs" on public.sync_logs
  for select using (user_id = current_setting('app.current_user_id', true));

create index idx_sync_logs_user_provider on public.sync_logs(user_id, provider, started_at);
```

- [ ] **Step 6: Apply migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 7: Commit**

```bash
git add src/lib/encryption.ts __tests__/lib/encryption.test.ts supabase/migrations/002_sync_logs.sql
git commit -m "feat: add encryption utilities and sync_logs migration"
```

---

## Task 2: Railway Express Backend Scaffold

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/Dockerfile`, `server/.env.example`
- Create: `server/src/index.ts`, `server/src/config.ts`, `server/src/db.ts`
- Create: `server/src/middleware/auth.ts`, `server/src/utils/logger.ts`, `server/src/utils/encryption.ts`

- [ ] **Step 1: Initialize server package**

```json
// server/package.json
{
  "name": "hybro-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.104.1",
    "express": "^5.1.0",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/express": "^5.0.2",
    "@types/node": "^20",
    "tsx": "^4.19.0",
    "typescript": "^5",
    "vitest": "^4.1.5"
  }
}
```

```json
// server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 2: Create config and DB client**

```typescript
// server/src/config.ts
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
} as const;
```

```typescript
// server/src/db.ts
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
```

- [ ] **Step 3: Create auth middleware and logger**

```typescript
// server/src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== config.apiSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
```

```typescript
// server/src/utils/logger.ts
export const logger = {
  info: (msg: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: "info", msg, ...data, timestamp: new Date().toISOString() })),
  error: (msg: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: "error", msg, ...data, timestamp: new Date().toISOString() })),
  warn: (msg: string, data?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: "warn", msg, ...data, timestamp: new Date().toISOString() })),
};
```

- [ ] **Step 4: Copy encryption utility to server**

Copy `src/lib/encryption.ts` to `server/src/utils/encryption.ts` — identical code. Update the import path references if needed (none in this case since it's self-contained).

- [ ] **Step 5: Create Express entry point**

```typescript
// server/src/index.ts
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
```

- [ ] **Step 6: Create Dockerfile and .env.example**

```dockerfile
# server/Dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

```bash
# server/.env.example
SUPABASE_URL=https://anjthenupycxzkvihzyf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=
API_SECRET=
GARMIN_SERVICE_URL=http://localhost:8000
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_WEBHOOK_VERIFY_TOKEN=hybro-strava-verify
MACROFACTOR_FIREBASE_API_KEY=
```

- [ ] **Step 7: Install dependencies**

Run: `cd server && npm install`

- [ ] **Step 8: Verify the server starts**

Run: `cd server && npx tsx src/index.ts` (with env vars set)
Expected: logs `Server started` on port 3001
Test: `curl http://localhost:3001/health` → `{"status":"ok",...}`

- [ ] **Step 9: Commit**

```bash
git add server/
git commit -m "feat: scaffold Railway Express backend with config, auth, and health endpoint"
```

---

## Task 3: MacroFactor API Client

**Files:**
- Create: `server/src/integrations/macrofactor-client.ts`
- Test: `server/__tests__/integrations/macrofactor-client.test.ts`

The MacroFactor API uses Firebase Auth for authentication and Firestore REST API for data access. The Firebase project is `sbs-diet-app`. Auth requests must include the `X-Ios-Bundle-Identifier: com.sbs.diet` header.

- [ ] **Step 1: Write client tests**

```typescript
// server/__tests__/integrations/macrofactor-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MacroFactorClient } from "../../src/integrations/macrofactor-client.js";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("MacroFactorClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("authenticates with Firebase and returns client", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          idToken: "test-id-token",
          refreshToken: "test-refresh-token",
          localId: "user-123",
          expiresIn: "3600",
        }),
      });

      const client = await MacroFactorClient.login("test@example.com", "password", "fake-api-key");
      expect(client).toBeInstanceOf(MacroFactorClient);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("identitytoolkit.googleapis.com"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Ios-Bundle-Identifier": "com.sbs.diet",
          }),
        }),
      );
    });

    it("throws on invalid credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: { message: "INVALID_PASSWORD" } }),
      });

      await expect(
        MacroFactorClient.login("test@example.com", "wrong", "fake-api-key"),
      ).rejects.toThrow("INVALID_PASSWORD");
    });
  });

  describe("getNutrition", () => {
    it("fetches and parses nutrition data for a date range", async () => {
      // Login mock
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          idToken: "token", refreshToken: "refresh", localId: "uid-1", expiresIn: "3600",
        }),
      });

      const client = await MacroFactorClient.login("e", "p", "key");

      // Firestore nutrition doc mock (year document with MMDD keys)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          fields: {
            "0429": {
              mapValue: {
                fields: {
                  calories: { stringValue: "2200" },
                  protein: { stringValue: "180" },
                  carbs: { stringValue: "220" },
                  fat: { stringValue: "70" },
                  fiber: { stringValue: "30" },
                },
              },
            },
          },
        }),
      });

      const data = await client.getNutrition("2026-04-29", "2026-04-29");
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual({
        date: "2026-04-29",
        calories: 2200,
        protein: 180,
        carbs: 220,
        fat: 70,
        fiber: 30,
      });
    });
  });

  describe("getWeightEntries", () => {
    it("fetches and parses weight entries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          idToken: "token", refreshToken: "refresh", localId: "uid-1", expiresIn: "3600",
        }),
      });

      const client = await MacroFactorClient.login("e", "p", "key");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          fields: {
            "0429": {
              mapValue: {
                fields: {
                  weight: { doubleValue: 82.5 },
                },
              },
            },
          },
        }),
      });

      const entries = await client.getWeightEntries("2026-04-29", "2026-04-29");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({ date: "2026-04-29", weight_kg: 82.5 });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run __tests__/integrations/macrofactor-client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MacroFactor client**

```typescript
// server/src/integrations/macrofactor-client.ts
const FIREBASE_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";
const FIREBASE_REFRESH_URL = "https://securetoken.googleapis.com/v1/token";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/sbs-diet-app/databases/(default)/documents";
const BUNDLE_ID_HEADER = { "X-Ios-Bundle-Identifier": "com.sbs.diet" };

interface NutritionEntry {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface WeightEntry {
  date: string;
  weight_kg: number;
}

export class MacroFactorClient {
  private idToken: string;
  private refreshToken: string;
  private userId: string;
  private expiresAt: number;
  private apiKey: string;

  private constructor(idToken: string, refreshToken: string, userId: string, expiresIn: number, apiKey: string) {
    this.idToken = idToken;
    this.refreshToken = refreshToken;
    this.userId = userId;
    this.expiresAt = Date.now() + expiresIn * 1000;
    this.apiKey = apiKey;
  }

  static async login(email: string, password: string, firebaseApiKey: string): Promise<MacroFactorClient> {
    const res = await fetch(`${FIREBASE_AUTH_URL}?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...BUNDLE_ID_HEADER },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Firebase auth failed");

    return new MacroFactorClient(
      data.idToken,
      data.refreshToken,
      data.localId,
      parseInt(data.expiresIn, 10),
      firebaseApiKey,
    );
  }

  private async ensureToken(): Promise<void> {
    if (Date.now() < this.expiresAt - 60_000) return;

    const res = await fetch(`${FIREBASE_REFRESH_URL}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...BUNDLE_ID_HEADER },
      body: `grant_type=refresh_token&refresh_token=${this.refreshToken}`,
    });

    const data = await res.json();
    if (!res.ok) throw new Error("Token refresh failed");

    this.idToken = data.id_token;
    this.refreshToken = data.refresh_token;
    this.expiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000;
  }

  private async firestoreGet(path: string): Promise<Record<string, unknown>> {
    await this.ensureToken();
    const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
      headers: { Authorization: `Bearer ${this.idToken}` },
    });
    if (!res.ok) throw new Error(`Firestore GET ${path} failed: ${res.status}`);
    return res.json();
  }

  async getNutrition(startDate: string, endDate: string): Promise<NutritionEntry[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results: NutritionEntry[] = [];

    // Group dates by year
    const yearSet = new Set<number>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      yearSet.add(d.getFullYear());
    }

    for (const year of yearSet) {
      const doc = await this.firestoreGet(`users/${this.userId}/nutrition/${year}`) as { fields?: Record<string, { mapValue?: { fields?: Record<string, { stringValue?: string; doubleValue?: number; integerValue?: string }> } }> };
      if (!doc.fields) continue;

      for (const [mmdd, value] of Object.entries(doc.fields)) {
        const month = parseInt(mmdd.slice(0, 2), 10);
        const day = parseInt(mmdd.slice(2, 4), 10);
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (date < startDate || date > endDate) continue;

        const f = value.mapValue?.fields;
        if (!f) continue;

        results.push({
          date,
          calories: parseFloat(f.calories?.stringValue || f.calories?.doubleValue?.toString() || "0"),
          protein: parseFloat(f.protein?.stringValue || f.protein?.doubleValue?.toString() || "0"),
          carbs: parseFloat(f.carbs?.stringValue || f.carbs?.doubleValue?.toString() || "0"),
          fat: parseFloat(f.fat?.stringValue || f.fat?.doubleValue?.toString() || "0"),
          fiber: parseFloat(f.fiber?.stringValue || f.fiber?.doubleValue?.toString() || "0"),
        });
      }
    }

    return results;
  }

  async getWeightEntries(startDate: string, endDate: string): Promise<WeightEntry[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results: WeightEntry[] = [];

    const yearSet = new Set<number>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      yearSet.add(d.getFullYear());
    }

    for (const year of yearSet) {
      const doc = await this.firestoreGet(`users/${this.userId}/scale/${year}`) as { fields?: Record<string, { mapValue?: { fields?: Record<string, { doubleValue?: number; stringValue?: string }> } }> };
      if (!doc.fields) continue;

      for (const [mmdd, value] of Object.entries(doc.fields)) {
        const month = parseInt(mmdd.slice(0, 2), 10);
        const day = parseInt(mmdd.slice(2, 4), 10);
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (date < startDate || date > endDate) continue;

        const f = value.mapValue?.fields;
        if (!f) continue;

        const weight = f.weight?.doubleValue ?? parseFloat(f.weight?.stringValue || "0");
        if (weight > 0) results.push({ date, weight_kg: weight });
      }
    }

    return results;
  }

  async getFoodLog(date: string): Promise<Record<string, unknown>> {
    return this.firestoreGet(`users/${this.userId}/food/${date}`);
  }

  async validate(): Promise<boolean> {
    try {
      await this.firestoreGet(`users/${this.userId}`);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/integrations/macrofactor-client.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/integrations/macrofactor-client.ts server/__tests__/integrations/macrofactor-client.test.ts
git commit -m "feat: add MacroFactor API client with Firebase auth and Firestore access"
```

---

## Task 4: Hevy API Client

**Files:**
- Create: `server/src/integrations/hevy-client.ts`
- Test: `server/__tests__/integrations/hevy-client.test.ts`

Hevy uses a simple API key auth via the `api-key` header. Base URL: `https://api.hevyapp.com`. Max page size is 10 for workouts.

- [ ] **Step 1: Write client tests**

```typescript
// server/__tests__/integrations/hevy-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HevyClient } from "../../src/integrations/hevy-client.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("HevyClient", () => {
  let client: HevyClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new HevyClient("test-api-key");
  });

  describe("validate", () => {
    it("returns true for valid API key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ page: 1, page_count: 1, workouts: [] }),
      });

      expect(await client.validate()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/workouts"),
        expect.objectContaining({
          headers: { "api-key": "test-api-key" },
        }),
      );
    });

    it("returns false for invalid API key", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      expect(await client.validate()).toBe(false);
    });
  });

  describe("getWorkoutEvents", () => {
    it("fetches incremental workout events since a timestamp", async () => {
      const mockEvents = {
        page: 1,
        page_count: 1,
        events: [
          {
            type: "updated",
            workout: {
              id: "w-1",
              title: "Push Day",
              start_time: "2026-04-29T07:00:00Z",
              end_time: "2026-04-29T08:15:00Z",
              exercises: [
                {
                  index: 0,
                  title: "Bench Press (Barbell)",
                  exercise_template_id: "tmpl-1",
                  sets: [
                    { index: 0, type: "normal", weight_kg: 100, reps: 8, rpe: 8.5 },
                  ],
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const events = await client.getWorkoutEvents("2026-04-28T00:00:00Z");
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("updated");
      expect(events[0].workout?.title).toBe("Push Day");
    });
  });

  describe("getWorkouts", () => {
    it("paginates through all workouts", async () => {
      // Page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          page: 1,
          page_count: 2,
          workouts: [{ id: "w-1", title: "Day 1", start_time: "2026-04-29T07:00:00Z", end_time: "2026-04-29T08:00:00Z", exercises: [] }],
        }),
      });
      // Page 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          page: 2,
          page_count: 2,
          workouts: [{ id: "w-2", title: "Day 2", start_time: "2026-04-28T07:00:00Z", end_time: "2026-04-28T08:00:00Z", exercises: [] }],
        }),
      });

      const workouts = await client.getWorkouts();
      expect(workouts).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run __tests__/integrations/hevy-client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Hevy client**

```typescript
// server/src/integrations/hevy-client.ts
const BASE_URL = "https://api.hevyapp.com/v1";

interface HevySet {
  index: number;
  type: "warmup" | "normal" | "failure" | "dropset";
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
}

interface HevyExercise {
  index: number;
  title: string;
  exercise_template_id: string;
  notes: string | null;
  supersets_id: number | null;
  sets: HevySet[];
}

export interface HevyWorkout {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  updated_at: string;
  created_at: string;
  exercises: HevyExercise[];
}

export interface HevyWorkoutEvent {
  type: "updated" | "deleted";
  workout?: HevyWorkout;
  id?: string;
  deleted_at?: string;
}

export class HevyClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: { "api-key": this.apiKey },
    });

    if (!res.ok) throw new Error(`Hevy API ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async validate(): Promise<boolean> {
    try {
      await this.get("/workouts", { page: "1", pageSize: "1" });
      return true;
    } catch {
      return false;
    }
  }

  async getWorkouts(maxPages = 100): Promise<HevyWorkout[]> {
    const all: HevyWorkout[] = [];
    let page = 1;

    while (page <= maxPages) {
      const res = await this.get<{ page: number; page_count: number; workouts: HevyWorkout[] }>(
        "/workouts",
        { page: String(page), pageSize: "10" },
      );
      all.push(...res.workouts);
      if (page >= res.page_count) break;
      page++;
    }

    return all;
  }

  async getWorkoutEvents(since: string): Promise<HevyWorkoutEvent[]> {
    const all: HevyWorkoutEvent[] = [];
    let page = 1;

    while (true) {
      const res = await this.get<{ page: number; page_count: number; events: HevyWorkoutEvent[] }>(
        "/workouts/events",
        { page: String(page), pageSize: "10", since },
      );
      all.push(...res.events);
      if (page >= res.page_count) break;
      page++;
    }

    return all;
  }

  async getWorkout(workoutId: string): Promise<HevyWorkout> {
    return this.get<HevyWorkout>(`/workouts/${workoutId}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/integrations/hevy-client.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/integrations/hevy-client.ts server/__tests__/integrations/hevy-client.test.ts
git commit -m "feat: add Hevy API client with workout fetching and incremental sync"
```

---

## Task 5: Strava API Client + Token Manager

**Files:**
- Create: `server/src/integrations/strava-client.ts`
- Create: `server/src/integrations/token-manager.ts`
- Test: `server/__tests__/integrations/strava-client.test.ts`

Strava uses OAuth 2.0. Access tokens expire after 6 hours. Each refresh returns a **new** refresh token that invalidates the old one. Activities list doesn't include calories — need detail fetch per activity.

- [ ] **Step 1: Write client tests**

```typescript
// server/__tests__/integrations/strava-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StravaClient } from "../../src/integrations/strava-client.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockTokenManager = {
  getValidToken: vi.fn(),
};

describe("StravaClient", () => {
  let client: StravaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenManager.getValidToken.mockResolvedValue("valid-access-token");
    client = new StravaClient(mockTokenManager as any);
  });

  describe("getActivities", () => {
    it("fetches activities after a timestamp", async () => {
      const mockActivities = [
        {
          id: 12345,
          name: "Morning Run",
          sport_type: "Run",
          distance: 5000,
          moving_time: 1500,
          elapsed_time: 1600,
          total_elevation_gain: 50,
          start_date: "2026-04-29T06:00:00Z",
          average_speed: 3.33,
          average_heartrate: 155,
          has_heartrate: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockActivities),
        headers: new Map([
          ["x-ratelimit-usage", "5,100"],
          ["x-ratelimit-limit", "200,2000"],
        ]),
      });

      const activities = await client.getActivities({ after: 1714348800 });
      expect(activities).toHaveLength(1);
      expect(activities[0].sport_type).toBe("Run");
      expect(activities[0].distance).toBe(5000);
    });
  });

  describe("getActivity", () => {
    it("fetches activity detail with calories", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 12345,
          name: "Morning Run",
          sport_type: "Run",
          distance: 5000,
          moving_time: 1500,
          calories: 450,
          average_heartrate: 155,
          has_heartrate: true,
        }),
        headers: new Map(),
      });

      const activity = await client.getActivity(12345);
      expect(activity.calories).toBe(450);
    });
  });

  describe("token refresh", () => {
    it("uses token manager for every request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Map(),
      });

      await client.getActivities({});
      expect(mockTokenManager.getValidToken).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run __tests__/integrations/strava-client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement token manager**

```typescript
// server/src/integrations/token-manager.ts
import { supabase } from "../db.js";
import { logger } from "../utils/logger.js";

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix epoch seconds
}

export class StravaTokenManager {
  private userId: string;
  private clientId: string;
  private clientSecret: string;

  constructor(userId: string, clientId: string, clientSecret: string) {
    this.userId = userId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async getValidToken(): Promise<string> {
    const { data: integration } = await supabase
      .from("integrations")
      .select("access_token, refresh_token, credentials")
      .eq("user_id", this.userId)
      .eq("provider", "strava")
      .single();

    if (!integration) throw new Error("No Strava integration found");

    const expiresAt = (integration.credentials as { expires_at?: number })?.expires_at ?? 0;

    // Refresh if expiring within 5 minutes
    if (Date.now() / 1000 > expiresAt - 300) {
      return this.refreshToken(integration.refresh_token!);
    }

    return integration.access_token!;
  }

  private async refreshToken(refreshToken: string): Promise<string> {
    const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);

    const data: TokenData = await res.json();

    // Save new tokens — refresh token changes on every refresh
    await supabase
      .from("integrations")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        credentials: { expires_at: data.expires_at },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", this.userId)
      .eq("provider", "strava");

    logger.info("Strava token refreshed", { userId: this.userId });
    return data.access_token;
  }
}
```

- [ ] **Step 4: Implement Strava client**

```typescript
// server/src/integrations/strava-client.ts
import { StravaTokenManager } from "./token-manager.js";

const BASE_URL = "https://www.strava.com/api/v3";

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  start_date_local: string;
  average_speed: number; // m/s
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  has_heartrate: boolean;
  calories?: number; // only in detail
}

interface GetActivitiesParams {
  after?: number; // epoch seconds
  before?: number;
  page?: number;
  per_page?: number;
}

export class StravaClient {
  private tokenManager: StravaTokenManager;

  constructor(tokenManager: StravaTokenManager) {
    this.tokenManager = tokenManager;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.tokenManager.getValidToken();
    const url = new URL(`${BASE_URL}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) throw new Error("Strava rate limit exceeded");
    if (!res.ok) throw new Error(`Strava API ${path} failed: ${res.status}`);

    return res.json() as Promise<T>;
  }

  async getActivities(params: GetActivitiesParams): Promise<StravaActivity[]> {
    const queryParams: Record<string, string> = {};
    if (params.after) queryParams.after = String(params.after);
    if (params.before) queryParams.before = String(params.before);
    queryParams.page = String(params.page || 1);
    queryParams.per_page = String(params.per_page || 30);

    return this.get<StravaActivity[]>("/athlete/activities", queryParams);
  }

  async getAllActivitiesSince(afterEpoch: number): Promise<StravaActivity[]> {
    const all: StravaActivity[] = [];
    let page = 1;

    while (true) {
      const batch = await this.getActivities({ after: afterEpoch, page, per_page: 30 });
      if (batch.length === 0) break;
      all.push(...batch);
      page++;
    }

    return all;
  }

  async getActivity(activityId: number): Promise<StravaActivity> {
    return this.get<StravaActivity>(`/activities/${activityId}`);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/integrations/strava-client.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/integrations/strava-client.ts server/src/integrations/token-manager.ts server/__tests__/integrations/strava-client.test.ts
git commit -m "feat: add Strava API client with OAuth token management"
```

---

## Task 6: Sync Workers — MacroFactor + Hevy

**Files:**
- Create: `server/src/sync/base.ts`
- Create: `server/src/sync/macrofactor.ts`
- Create: `server/src/sync/hevy.ts`
- Test: `server/__tests__/sync/macrofactor.test.ts`
- Test: `server/__tests__/sync/hevy.test.ts`

- [ ] **Step 1: Create base sync worker pattern**

```typescript
// server/src/sync/base.ts
import { supabase } from "../db.js";
import { logger } from "../utils/logger.js";

export interface SyncResult {
  userId: string;
  provider: string;
  recordsSynced: number;
  error?: string;
}

export async function logSync(result: SyncResult): Promise<void> {
  await supabase.from("sync_logs").insert({
    user_id: result.userId,
    provider: result.provider,
    status: result.error ? "error" : "success",
    records_synced: result.recordsSynced,
    error_message: result.error || null,
    completed_at: new Date().toISOString(),
  });

  if (result.error) {
    logger.error("Sync failed", { userId: result.userId, provider: result.provider, error: result.error });
  } else {
    logger.info("Sync completed", { userId: result.userId, provider: result.provider, records: result.recordsSynced });
  }
}

export async function getActiveIntegrations(provider: string) {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("provider", provider)
    .eq("status", "active");

  if (error) throw error;
  return data || [];
}

export async function updateSyncTimestamp(userId: string, provider: string): Promise<void> {
  await supabase
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
}

export async function markIntegrationError(userId: string, provider: string): Promise<void> {
  await supabase
    .from("integrations")
    .update({ status: "error", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
}
```

- [ ] **Step 2: Write MacroFactor sync worker tests**

```typescript
// server/__tests__/sync/macrofactor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncMacroFactorForUser, normalizeNutrition } from "../../src/sync/macrofactor.js";

describe("MacroFactor sync", () => {
  describe("normalizeNutrition", () => {
    it("converts MacroFactor nutrition to nutrition_logs row", () => {
      const entry = {
        date: "2026-04-29",
        calories: 2200,
        protein: 180,
        carbs: 220,
        fat: 70,
        fiber: 30,
      };

      const row = normalizeNutrition("user-1", entry);
      expect(row).toEqual({
        user_id: "user-1",
        date: "2026-04-29",
        calories: 2200,
        protein: 180,
        carbs: 220,
        fat: 70,
        fiber: 30,
        sugar: null,
        sodium: null,
        meals: null,
        synced_at: expect.any(String),
      });
    });
  });
});
```

- [ ] **Step 3: Implement MacroFactor sync worker**

```typescript
// server/src/sync/macrofactor.ts
import { supabase } from "../db.js";
import { config } from "../config.js";
import { MacroFactorClient } from "../integrations/macrofactor-client.js";
import { decrypt } from "../utils/encryption.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";
import { logger } from "../utils/logger.js";

interface NutritionEntry {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export function normalizeNutrition(userId: string, entry: NutritionEntry) {
  return {
    user_id: userId,
    date: entry.date,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    fiber: entry.fiber,
    sugar: null,
    sodium: null,
    meals: null,
    synced_at: new Date().toISOString(),
  };
}

export async function syncMacroFactorForUser(
  userId: string,
  credentials: { email: string; password: string },
  since?: string,
): Promise<number> {
  const email = decrypt(credentials.email, config.encryptionKey);
  const password = decrypt(credentials.password, config.encryptionKey);

  const client = await MacroFactorClient.login(email, password, config.macrofactorFirebaseApiKey);

  const startDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);

  const nutrition = await client.getNutrition(startDate, endDate);
  const rows = nutrition.map((entry) => normalizeNutrition(userId, entry));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("nutrition_logs")
      .upsert(rows, { onConflict: "user_id,date" });

    if (error) throw error;
  }

  return rows.length;
}

export async function syncAllMacroFactor(): Promise<void> {
  const integrations = await getActiveIntegrations("macrofactor");

  for (const integration of integrations) {
    try {
      const creds = integration.credentials as { email: string; password: string };
      const since = integration.last_synced_at
        ? new Date(integration.last_synced_at).toISOString().slice(0, 10)
        : undefined;

      const count = await syncMacroFactorForUser(integration.user_id, creds, since);
      await updateSyncTimestamp(integration.user_id, "macrofactor");
      await logSync({ userId: integration.user_id, provider: "macrofactor", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "macrofactor", recordsSynced: 0, error });
      await markIntegrationError(integration.user_id, "macrofactor");
    }
  }
}
```

- [ ] **Step 4: Run MacroFactor sync tests**

Run: `cd server && npx vitest run __tests__/sync/macrofactor.test.ts`
Expected: PASS

- [ ] **Step 5: Write Hevy sync worker tests**

```typescript
// server/__tests__/sync/hevy.test.ts
import { describe, it, expect } from "vitest";
import { normalizeWorkout } from "../../src/sync/hevy.js";

describe("Hevy sync", () => {
  describe("normalizeWorkout", () => {
    it("converts Hevy workout to workout_logs row", () => {
      const workout = {
        id: "w-1",
        title: "Push Day",
        start_time: "2026-04-29T07:00:00Z",
        end_time: "2026-04-29T08:15:00Z",
        updated_at: "2026-04-29T08:16:00Z",
        created_at: "2026-04-29T07:00:00Z",
        exercises: [
          {
            index: 0,
            title: "Bench Press (Barbell)",
            exercise_template_id: "tmpl-1",
            notes: null,
            supersets_id: null,
            sets: [
              { index: 0, type: "normal" as const, weight_kg: 100, reps: 8, rpe: 8.5, distance_meters: null, duration_seconds: null },
            ],
          },
        ],
      };

      const row = normalizeWorkout("user-1", workout);
      expect(row.user_id).toBe("user-1");
      expect(row.workout_id).toBe("w-1");
      expect(row.name).toBe("Push Day");
      expect(row.duration_minutes).toBe(75);
      expect(row.exercises).toHaveLength(1);
      expect(row.exercises[0].name).toBe("Bench Press (Barbell)");
      expect(row.exercises[0].sets[0].weight_kg).toBe(100);
    });
  });
});
```

- [ ] **Step 6: Implement Hevy sync worker**

```typescript
// server/src/sync/hevy.ts
import { supabase } from "../db.js";
import { config } from "../config.js";
import { HevyClient, type HevyWorkout } from "../integrations/hevy-client.js";
import { decrypt } from "../utils/encryption.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";

interface NormalizedExercise {
  name: string;
  sets: { index: number; type: string; weight_kg: number | null; reps: number | null; rpe: number | null }[];
}

export function normalizeWorkout(userId: string, workout: HevyWorkout) {
  const startMs = new Date(workout.start_time).getTime();
  const endMs = new Date(workout.end_time).getTime();
  const durationMinutes = Math.round((endMs - startMs) / 60_000);

  const exercises: NormalizedExercise[] = workout.exercises.map((ex) => ({
    name: ex.title,
    sets: ex.sets.map((s) => ({
      index: s.index,
      type: s.type,
      weight_kg: s.weight_kg,
      reps: s.reps,
      rpe: s.rpe,
    })),
  }));

  return {
    user_id: userId,
    date: workout.start_time.slice(0, 10),
    workout_id: workout.id,
    name: workout.title,
    duration_minutes: durationMinutes,
    exercises,
    synced_at: new Date().toISOString(),
  };
}

export async function syncHevyForUser(userId: string, apiKeyEncrypted: string, since?: string): Promise<number> {
  const apiKey = decrypt(apiKeyEncrypted, config.encryptionKey);
  const client = new HevyClient(apiKey);

  let workouts: HevyWorkout[];

  if (since) {
    // Incremental sync via events endpoint
    const events = await client.getWorkoutEvents(since);
    workouts = events
      .filter((e) => e.type === "updated" && e.workout)
      .map((e) => e.workout!);

    // Handle deletions
    const deletedIds = events
      .filter((e) => e.type === "deleted" && e.id)
      .map((e) => e.id!);

    if (deletedIds.length > 0) {
      await supabase
        .from("workout_logs")
        .delete()
        .eq("user_id", userId)
        .in("workout_id", deletedIds);
    }
  } else {
    // Full sync (initial backfill)
    workouts = await client.getWorkouts();
  }

  const rows = workouts.map((w) => normalizeWorkout(userId, w));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("workout_logs")
      .upsert(rows, { onConflict: "user_id,workout_id" });

    if (error) throw error;
  }

  return rows.length;
}

export async function syncAllHevy(): Promise<void> {
  const integrations = await getActiveIntegrations("hevy");

  for (const integration of integrations) {
    try {
      const since = integration.last_synced_at || undefined;
      const count = await syncHevyForUser(integration.user_id, integration.access_token!, since);
      await updateSyncTimestamp(integration.user_id, "hevy");
      await logSync({ userId: integration.user_id, provider: "hevy", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "hevy", recordsSynced: 0, error });
      await markIntegrationError(integration.user_id, "hevy");
    }
  }
}
```

- [ ] **Step 7: Run Hevy sync tests**

Run: `cd server && npx vitest run __tests__/sync/hevy.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/src/sync/base.ts server/src/sync/macrofactor.ts server/src/sync/hevy.ts server/__tests__/sync/macrofactor.test.ts server/__tests__/sync/hevy.test.ts
git commit -m "feat: add MacroFactor and Hevy sync workers with normalization"
```

---

## Task 7: Sync Workers — Strava + Garmin

**Files:**
- Create: `server/src/sync/strava.ts`
- Create: `server/src/sync/garmin.ts`
- Test: `server/__tests__/sync/strava.test.ts`
- Test: `server/__tests__/sync/garmin.test.ts`

- [ ] **Step 1: Write Strava sync tests**

```typescript
// server/__tests__/sync/strava.test.ts
import { describe, it, expect } from "vitest";
import { normalizeActivity, mapSportType } from "../../src/sync/strava.js";

describe("Strava sync", () => {
  describe("mapSportType", () => {
    it("maps Run types to 'run'", () => {
      expect(mapSportType("Run")).toBe("run");
      expect(mapSportType("TrailRun")).toBe("run");
      expect(mapSportType("VirtualRun")).toBe("run");
    });

    it("maps Ride types to 'bike'", () => {
      expect(mapSportType("Ride")).toBe("bike");
      expect(mapSportType("GravelRide")).toBe("bike");
      expect(mapSportType("VirtualRide")).toBe("bike");
    });

    it("maps Swim to 'swim'", () => {
      expect(mapSportType("Swim")).toBe("swim");
    });

    it("maps unknown types to 'other'", () => {
      expect(mapSportType("Yoga")).toBe("other");
      expect(mapSportType("WeightTraining")).toBe("other");
    });
  });

  describe("normalizeActivity", () => {
    it("converts Strava activity to cardio_logs row", () => {
      const activity = {
        id: 12345,
        name: "Morning Run",
        sport_type: "Run",
        distance: 5000,
        moving_time: 1500,
        elapsed_time: 1600,
        total_elevation_gain: 50,
        start_date: "2026-04-29T06:00:00Z",
        start_date_local: "2026-04-29T06:00:00Z",
        average_speed: 3.33,
        max_speed: 4.0,
        average_heartrate: 155,
        has_heartrate: true,
        calories: 450,
      };

      const row = normalizeActivity("user-1", activity);
      expect(row.user_id).toBe("user-1");
      expect(row.activity_id).toBe("12345");
      expect(row.type).toBe("run");
      expect(row.distance).toBeCloseTo(5.0); // km
      expect(row.duration).toBe(1500); // seconds
      expect(row.avg_hr).toBe(155);
      expect(row.calories).toBe(450);
      expect(row.elevation).toBe(50);
    });

    it("calculates pace in min/km for runs", () => {
      const activity = {
        id: 1,
        name: "Run",
        sport_type: "Run",
        distance: 10000, // 10km
        moving_time: 3000, // 50 min
        elapsed_time: 3000,
        total_elevation_gain: 0,
        start_date: "2026-04-29T06:00:00Z",
        start_date_local: "2026-04-29T06:00:00Z",
        average_speed: 3.33,
        max_speed: 4.0,
        has_heartrate: false,
      };

      const row = normalizeActivity("user-1", activity);
      expect(row.pace_or_speed).toBeCloseTo(5.0); // 5 min/km
    });
  });
});
```

- [ ] **Step 2: Implement Strava sync worker**

```typescript
// server/src/sync/strava.ts
import { supabase } from "../db.js";
import { config } from "../config.js";
import { StravaClient, type StravaActivity } from "../integrations/strava-client.js";
import { StravaTokenManager } from "../integrations/token-manager.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const BIKE_TYPES = new Set(["Ride", "GravelRide", "VirtualRide", "EBikeRide", "EMountainBikeRide", "MountainBikeRide"]);
const SWIM_TYPES = new Set(["Swim"]);

export function mapSportType(sportType: string): "run" | "bike" | "swim" | "other" {
  if (RUN_TYPES.has(sportType)) return "run";
  if (BIKE_TYPES.has(sportType)) return "bike";
  if (SWIM_TYPES.has(sportType)) return "swim";
  return "other";
}

export function normalizeActivity(userId: string, activity: StravaActivity) {
  const type = mapSportType(activity.sport_type);
  const distanceKm = activity.distance / 1000;

  // Pace: min/km for runs, km/h for bikes
  let paceOrSpeed: number | null = null;
  if (activity.distance > 0 && activity.moving_time > 0) {
    if (type === "run") {
      paceOrSpeed = (activity.moving_time / 60) / distanceKm; // min/km
    } else {
      paceOrSpeed = distanceKm / (activity.moving_time / 3600); // km/h
    }
  }

  return {
    user_id: userId,
    date: activity.start_date.slice(0, 10),
    activity_id: String(activity.id),
    type,
    distance: Math.round(distanceKm * 100) / 100,
    duration: activity.moving_time,
    avg_hr: activity.has_heartrate ? (activity.average_heartrate ?? null) : null,
    calories: activity.calories ?? null,
    pace_or_speed: paceOrSpeed ? Math.round(paceOrSpeed * 100) / 100 : null,
    elevation: activity.total_elevation_gain ?? null,
    synced_at: new Date().toISOString(),
  };
}

export async function syncStravaForUser(userId: string, sinceEpoch?: number): Promise<number> {
  const tokenManager = new StravaTokenManager(userId, config.stravaClientId, config.stravaClientSecret);
  const client = new StravaClient(tokenManager);

  const after = sinceEpoch || Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const activities = await client.getAllActivitiesSince(after);

  // Fetch detail for each activity to get calories
  const detailed: StravaActivity[] = [];
  for (const a of activities) {
    const detail = await client.getActivity(a.id);
    detailed.push(detail);
  }

  const rows = detailed.map((a) => normalizeActivity(userId, a));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("cardio_logs")
      .upsert(rows, { onConflict: "user_id,activity_id" });

    if (error) throw error;
  }

  return rows.length;
}

export async function syncStravaActivity(userId: string, activityId: number): Promise<void> {
  const tokenManager = new StravaTokenManager(userId, config.stravaClientId, config.stravaClientSecret);
  const client = new StravaClient(tokenManager);

  const activity = await client.getActivity(activityId);
  const row = normalizeActivity(userId, activity);

  const { error } = await supabase
    .from("cardio_logs")
    .upsert([row], { onConflict: "user_id,activity_id" });

  if (error) throw error;
}

export async function syncAllStrava(): Promise<void> {
  const integrations = await getActiveIntegrations("strava");

  for (const integration of integrations) {
    try {
      const sinceEpoch = integration.last_synced_at
        ? Math.floor(new Date(integration.last_synced_at).getTime() / 1000)
        : undefined;

      const count = await syncStravaForUser(integration.user_id, sinceEpoch);
      await updateSyncTimestamp(integration.user_id, "strava");
      await logSync({ userId: integration.user_id, provider: "strava", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "strava", recordsSynced: 0, error });
      await markIntegrationError(integration.user_id, "strava");
    }
  }
}
```

- [ ] **Step 3: Run Strava sync tests**

Run: `cd server && npx vitest run __tests__/sync/strava.test.ts`
Expected: PASS

- [ ] **Step 4: Write Garmin sync tests**

```typescript
// server/__tests__/sync/garmin.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeGarminData } from "../../src/sync/garmin.js";

describe("Garmin sync", () => {
  describe("normalizeGarminData", () => {
    it("converts Garmin API response to recovery_logs rows", () => {
      const garminResponse = {
        dates: ["2026-04-29"],
        resting_hr: [{ date: "2026-04-29", value: 52 }],
        hrv: [{ date: "2026-04-29", value: 45 }],
        sleep: [{ date: "2026-04-29", hours: 7.5, score: 82 }],
        body_battery: [{ date: "2026-04-29", value: 75 }],
        stress: [{ date: "2026-04-29", value: 28 }],
        steps: [{ date: "2026-04-29", value: 8500 }],
      };

      const rows = normalizeGarminData("user-1", garminResponse);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        user_id: "user-1",
        date: "2026-04-29",
        resting_hr: 52,
        hrv: 45,
        sleep_hours: 7.5,
        sleep_score: 82,
        body_battery: 75,
        stress_level: 28,
        steps: 8500,
        synced_at: expect.any(String),
      });
    });

    it("handles missing data for some metrics", () => {
      const garminResponse = {
        dates: ["2026-04-29"],
        resting_hr: [{ date: "2026-04-29", value: 52 }],
        hrv: [],
        sleep: [],
        body_battery: [],
        stress: [],
        steps: [{ date: "2026-04-29", value: 8500 }],
      };

      const rows = normalizeGarminData("user-1", garminResponse);
      expect(rows).toHaveLength(1);
      expect(rows[0].hrv).toBeNull();
      expect(rows[0].sleep_hours).toBeNull();
    });
  });
});
```

- [ ] **Step 5: Implement Garmin sync worker**

```typescript
// server/src/sync/garmin.ts
import { supabase } from "../db.js";
import { config } from "../config.js";
import { decrypt } from "../utils/encryption.js";
import { getActiveIntegrations, logSync, updateSyncTimestamp, markIntegrationError } from "./base.js";

interface GarminMetric {
  date: string;
  value?: number;
  hours?: number;
  score?: number;
}

interface GarminSyncResponse {
  dates: string[];
  resting_hr: GarminMetric[];
  hrv: GarminMetric[];
  sleep: GarminMetric[];
  body_battery: GarminMetric[];
  stress: GarminMetric[];
  steps: GarminMetric[];
}

function findMetric(metrics: GarminMetric[], date: string): GarminMetric | undefined {
  return metrics.find((m) => m.date === date);
}

export function normalizeGarminData(userId: string, data: GarminSyncResponse) {
  return data.dates.map((date) => {
    const hr = findMetric(data.resting_hr, date);
    const hrv = findMetric(data.hrv, date);
    const sleep = findMetric(data.sleep, date);
    const battery = findMetric(data.body_battery, date);
    const stress = findMetric(data.stress, date);
    const steps = findMetric(data.steps, date);

    return {
      user_id: userId,
      date,
      resting_hr: hr?.value ?? null,
      hrv: hrv?.value ?? null,
      sleep_hours: sleep?.hours ?? null,
      sleep_score: sleep?.score ?? null,
      body_battery: battery?.value ?? null,
      stress_level: stress?.value ?? null,
      steps: steps?.value ?? null,
      synced_at: new Date().toISOString(),
    };
  });
}

async function fetchFromGarminService(email: string, password: string, since: string): Promise<GarminSyncResponse> {
  const res = await fetch(`${config.garminServiceUrl}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, since }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(`Garmin service error: ${(err as { error: string }).error}`);
  }

  return res.json() as Promise<GarminSyncResponse>;
}

export async function syncGarminForUser(
  userId: string,
  credentials: { email: string; password: string },
  since?: string,
): Promise<number> {
  const email = decrypt(credentials.email, config.encryptionKey);
  const password = decrypt(credentials.password, config.encryptionKey);

  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await fetchFromGarminService(email, password, sinceDate);
  const rows = normalizeGarminData(userId, data);

  if (rows.length > 0) {
    const { error } = await supabase
      .from("recovery_logs")
      .upsert(rows, { onConflict: "user_id,date" });

    if (error) throw error;
  }

  return rows.length;
}

export async function syncAllGarmin(): Promise<void> {
  const integrations = await getActiveIntegrations("garmin");

  for (const integration of integrations) {
    try {
      const creds = integration.credentials as { email: string; password: string };
      const since = integration.last_synced_at
        ? new Date(integration.last_synced_at).toISOString().slice(0, 10)
        : undefined;

      const count = await syncGarminForUser(integration.user_id, creds, since);
      await updateSyncTimestamp(integration.user_id, "garmin");
      await logSync({ userId: integration.user_id, provider: "garmin", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "garmin", recordsSynced: 0, error });
      await markIntegrationError(integration.user_id, "garmin");
    }
  }
}
```

- [ ] **Step 6: Run Garmin sync tests**

Run: `cd server && npx vitest run __tests__/sync/garmin.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/sync/strava.ts server/src/sync/garmin.ts server/__tests__/sync/strava.test.ts server/__tests__/sync/garmin.test.ts
git commit -m "feat: add Strava and Garmin sync workers with normalization"
```

---

## Task 8: Garmin Python Microservice

**Files:**
- Create: `services/garmin/requirements.txt`
- Create: `services/garmin/main.py`
- Create: `services/garmin/garmin_client.py`
- Create: `services/garmin/test_main.py`
- Create: `services/garmin/Dockerfile`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
garminconnect==0.3.3
curl_cffi>=0.7.0
pydantic>=2.0.0
pytest==8.3.0
httpx==0.27.0
```

- [ ] **Step 2: Write tests**

```python
# services/garmin/test_main.py
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@patch("main.validate_credentials")
def test_auth_validate_success(mock_validate):
    mock_validate.return_value = True
    response = client.post("/auth/validate", json={
        "email": "test@example.com",
        "password": "password123"
    })
    assert response.status_code == 200
    assert response.json()["valid"] is True


@patch("main.validate_credentials")
def test_auth_validate_failure(mock_validate):
    mock_validate.side_effect = Exception("Invalid credentials")
    response = client.post("/auth/validate", json={
        "email": "test@example.com",
        "password": "wrong"
    })
    assert response.status_code == 200
    assert response.json()["valid"] is False
    assert "error" in response.json()


@patch("main.fetch_garmin_data")
def test_sync_success(mock_fetch):
    mock_fetch.return_value = {
        "dates": ["2026-04-29"],
        "resting_hr": [{"date": "2026-04-29", "value": 52}],
        "hrv": [{"date": "2026-04-29", "value": 45}],
        "sleep": [{"date": "2026-04-29", "hours": 7.5, "score": 82}],
        "body_battery": [{"date": "2026-04-29", "value": 75}],
        "stress": [{"date": "2026-04-29", "value": 28}],
        "steps": [{"date": "2026-04-29", "value": 8500}],
    }
    response = client.post("/sync", json={
        "email": "test@example.com",
        "password": "password123",
        "since": "2026-04-29"
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["dates"]) == 1
    assert data["resting_hr"][0]["value"] == 52


@patch("main.fetch_garmin_data")
def test_sync_auth_failure(mock_fetch):
    mock_fetch.side_effect = Exception("auth_failed")
    response = client.post("/sync", json={
        "email": "test@example.com",
        "password": "wrong",
        "since": "2026-04-29"
    })
    assert response.status_code == 401
```

- [ ] **Step 3: Implement garmin_client.py**

```python
# services/garmin/garmin_client.py
import os
import tempfile
from datetime import date, datetime, timedelta
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)


def create_client(email: str, password: str) -> Garmin:
    """Create and authenticate a Garmin client."""
    token_dir = os.path.join(tempfile.gettempdir(), "garmin_tokens", email.replace("@", "_at_"))
    os.makedirs(token_dir, exist_ok=True)

    client = Garmin(email=email, password=password)
    client.login(token_dir)
    return client


def fetch_data(client: Garmin, since: str) -> dict:
    """Fetch all health metrics from Garmin since the given date."""
    start = datetime.strptime(since, "%Y-%m-%d").date()
    end = date.today()

    dates = []
    resting_hr = []
    hrv_data = []
    sleep_data = []
    body_battery = []
    stress_data = []
    steps_data = []

    current = start
    while current <= end:
        date_str = current.isoformat()
        dates.append(date_str)

        # Resting heart rate
        try:
            hr = client.get_heart_rates(date_str)
            if hr and hr.get("restingHeartRate"):
                resting_hr.append({"date": date_str, "value": hr["restingHeartRate"]})
        except Exception:
            pass

        # HRV
        try:
            hrv = client.get_hrv_data(date_str)
            if hrv and hrv.get("lastNightAvg"):
                hrv_data.append({"date": date_str, "value": round(hrv["lastNightAvg"])})
        except Exception:
            pass

        # Sleep
        try:
            sleep = client.get_sleep_data(date_str)
            dto = sleep.get("dailySleepDTO", {})
            score_obj = sleep.get("overallSleepScore", {})
            if dto:
                total_seconds = sum([
                    dto.get("deepSleepSeconds", 0),
                    dto.get("lightSleepSeconds", 0),
                    dto.get("remSleepSeconds", 0),
                ])
                sleep_data.append({
                    "date": date_str,
                    "hours": round(total_seconds / 3600, 1),
                    "score": score_obj.get("value"),
                })
        except Exception:
            pass

        # Stress + Body Battery (co-located in stress response)
        try:
            stress = client.get_all_day_stress(date_str)
            if stress:
                if stress.get("averageStressLevel"):
                    stress_data.append({"date": date_str, "value": stress["averageStressLevel"]})
                bb_values = stress.get("bodyBatteryValuesArray", [])
                if bb_values:
                    # Take the morning peak (highest value)
                    max_bb = max(v[1] for v in bb_values if v[1] is not None and v[1] >= 0)
                    body_battery.append({"date": date_str, "value": max_bb})
        except Exception:
            pass

        # Steps
        try:
            summary = client.get_user_summary(date_str)
            if summary and summary.get("steps"):
                steps_data.append({"date": date_str, "value": summary["steps"]})
        except Exception:
            pass

        current += timedelta(days=1)

    return {
        "dates": dates,
        "resting_hr": resting_hr,
        "hrv": hrv_data,
        "sleep": sleep_data,
        "body_battery": body_battery,
        "stress": stress_data,
        "steps": steps_data,
    }
```

- [ ] **Step 4: Implement main.py**

```python
# services/garmin/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from garmin_client import create_client, fetch_data
from garminconnect import GarminConnectAuthenticationError, GarminConnectTooManyRequestsError

app = FastAPI(title="Hybro Garmin Service")


class AuthRequest(BaseModel):
    email: str
    password: str


class SyncRequest(BaseModel):
    email: str
    password: str
    since: str  # YYYY-MM-DD


def validate_credentials(email: str, password: str) -> bool:
    """Attempt login to validate credentials."""
    client = create_client(email, password)
    return True


def fetch_garmin_data(email: str, password: str, since: str) -> dict:
    """Authenticate and fetch data."""
    client = create_client(email, password)
    return fetch_data(client, since)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/validate")
def auth_validate(req: AuthRequest):
    try:
        validate_credentials(req.email, req.password)
        return {"valid": True}
    except GarminConnectAuthenticationError as e:
        return {"valid": False, "error": "auth_failed"}
    except GarminConnectTooManyRequestsError:
        return {"valid": False, "error": "rate_limited"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


@app.post("/sync")
def sync(req: SyncRequest):
    try:
        data = fetch_garmin_data(req.email, req.password, req.since)
        return data
    except GarminConnectAuthenticationError:
        raise HTTPException(status_code=401, detail={"error": "auth_failed"})
    except GarminConnectTooManyRequestsError:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})
```

- [ ] **Step 5: Create Dockerfile**

```dockerfile
# services/garmin/Dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 6: Run tests**

Run: `cd services/garmin && pip install -r requirements.txt && pytest test_main.py -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add services/garmin/
git commit -m "feat: add Garmin Python FastAPI microservice"
```

---

## Task 9: Sync Scheduler + Backend Routes

**Files:**
- Create: `server/src/sync/scheduler.ts`
- Create: `server/src/routes/sync.ts`
- Create: `server/src/routes/webhooks.ts`
- Modify: `server/src/index.ts`
- Test: `server/__tests__/routes/sync.test.ts`
- Test: `server/__tests__/routes/webhooks.test.ts`

- [ ] **Step 1: Write route tests**

```typescript
// server/__tests__/routes/sync.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the sync modules before importing routes
vi.mock("../../src/sync/macrofactor.js", () => ({
  syncMacroFactorForUser: vi.fn().mockResolvedValue(5),
  syncAllMacroFactor: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/sync/hevy.js", () => ({
  syncHevyForUser: vi.fn().mockResolvedValue(3),
  syncAllHevy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/sync/strava.js", () => ({
  syncStravaForUser: vi.fn().mockResolvedValue(2),
  syncAllStrava: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/sync/garmin.js", () => ({
  syncGarminForUser: vi.fn().mockResolvedValue(1),
  syncAllGarmin: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/db.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => ({ data: { credentials: { email: "enc", password: "enc" }, access_token: "enc" } }),
          }),
        }),
      }),
    }),
  },
}));

describe("sync routes", () => {
  it("validates provider parameter", async () => {
    // Import after mocks
    const { createSyncRouter } = await import("../../src/routes/sync.js");
    const router = createSyncRouter();
    expect(router).toBeDefined();
  });
});
```

- [ ] **Step 2: Write webhook tests**

```typescript
// server/__tests__/routes/webhooks.test.ts
import { describe, it, expect } from "vitest";
import { verifyStravaWebhook } from "../../src/routes/webhooks.js";

describe("Strava webhook", () => {
  describe("verifyStravaWebhook", () => {
    it("returns challenge when verify token matches", () => {
      const result = verifyStravaWebhook("subscribe", "abc123", "test-token", "test-token");
      expect(result).toEqual({ "hub.challenge": "abc123" });
    });

    it("returns null when verify token does not match", () => {
      const result = verifyStravaWebhook("subscribe", "abc123", "wrong-token", "test-token");
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 3: Implement sync routes**

```typescript
// server/src/routes/sync.ts
import { Router, type Request, type Response } from "express";
import { supabase } from "../db.js";
import { syncAllMacroFactor, syncMacroFactorForUser } from "../sync/macrofactor.js";
import { syncAllHevy, syncHevyForUser } from "../sync/hevy.js";
import { syncAllStrava, syncStravaForUser } from "../sync/strava.js";
import { syncAllGarmin, syncGarminForUser } from "../sync/garmin.js";
import { logger } from "../utils/logger.js";

const VALID_PROVIDERS = ["macrofactor", "hevy", "strava", "garmin"] as const;
type Provider = typeof VALID_PROVIDERS[number];

const syncAllFns: Record<Provider, () => Promise<void>> = {
  macrofactor: syncAllMacroFactor,
  hevy: syncAllHevy,
  strava: syncAllStrava,
  garmin: syncAllGarmin,
};

export function createSyncRouter(): Router {
  const router = Router();

  // POST /sync/trigger — sync one provider for all users (or specific user)
  router.post("/trigger", async (req: Request, res: Response) => {
    const { provider, userId } = req.body as { provider?: string; userId?: string };

    if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
      res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` });
      return;
    }

    try {
      if (userId) {
        // Sync for specific user — fetch their integration data
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
        // Fire and forget
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

  // POST /sync/backfill — initial 30-day backfill for new connection
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
```

- [ ] **Step 4: Implement webhook routes**

```typescript
// server/src/routes/webhooks.ts
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

  // GET /webhooks/strava — webhook verification
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

  // POST /webhooks/strava — receive activity events
  router.post("/strava", async (req: Request, res: Response) => {
    const { object_type, object_id, aspect_type, owner_id } = req.body as {
      object_type: string;
      object_id: number;
      aspect_type: string;
      owner_id: number;
    };

    // Respond immediately (Strava requires response within 2 seconds)
    res.status(200).json({ received: true });

    // Process async
    if (object_type !== "activity") return;

    try {
      // Find user by Strava athlete ID (stored as provider_user_id)
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
```

- [ ] **Step 5: Implement scheduler and wire up index.ts**

```typescript
// server/src/sync/scheduler.ts
import cron from "node-cron";
import { syncAllMacroFactor } from "./macrofactor.js";
import { syncAllHevy } from "./hevy.js";
import { syncAllStrava } from "./strava.js";
import { syncAllGarmin } from "./garmin.js";
import { logger } from "../utils/logger.js";

export function startScheduler(): void {
  // MacroFactor: every 6 hours (0:00, 6:00, 12:00, 18:00)
  cron.schedule("0 */6 * * *", () => {
    logger.info("Cron: starting MacroFactor sync");
    syncAllMacroFactor().catch((err) => logger.error("Cron: MacroFactor sync failed", { error: String(err) }));
  });

  // Hevy: every 6 hours (offset by 1 hour to spread load)
  cron.schedule("0 1,7,13,19 * * *", () => {
    logger.info("Cron: starting Hevy sync");
    syncAllHevy().catch((err) => logger.error("Cron: Hevy sync failed", { error: String(err) }));
  });

  // Strava: daily fallback at 3:00 AM (webhooks handle real-time)
  cron.schedule("0 3 * * *", () => {
    logger.info("Cron: starting Strava fallback sync");
    syncAllStrava().catch((err) => logger.error("Cron: Strava sync failed", { error: String(err) }));
  });

  // Garmin: every 12 hours (2:00, 14:00)
  cron.schedule("0 2,14 * * *", () => {
    logger.info("Cron: starting Garmin sync");
    syncAllGarmin().catch((err) => logger.error("Cron: Garmin sync failed", { error: String(err) }));
  });

  logger.info("Sync scheduler started");
}
```

Update `server/src/index.ts` to wire routes and scheduler:

```typescript
// server/src/index.ts (full replacement)
import express from "express";
import { config } from "./config.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { createSyncRouter } from "./routes/sync.js";
import { createWebhookRouter } from "./routes/webhooks.js";
import { startScheduler } from "./sync/scheduler.js";
import { logger } from "./utils/logger.js";

const app = express();
app.use(express.json());

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Sync routes (API key protected)
app.use("/sync", apiKeyAuth, createSyncRouter());

// Webhook routes (no API key — verified by provider-specific tokens)
app.use("/webhooks", createWebhookRouter());

app.listen(config.port, () => {
  logger.info("Server started", { port: config.port });
  startScheduler();
});

export { app };
```

- [ ] **Step 6: Run route tests**

Run: `cd server && npx vitest run __tests__/routes/`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/sync/scheduler.ts server/src/routes/sync.ts server/src/routes/webhooks.ts server/src/index.ts server/__tests__/routes/
git commit -m "feat: add sync scheduler, trigger/backfill routes, and Strava webhook handler"
```

---

## Task 10: Strava OAuth Flow (Next.js API Routes)

**Files:**
- Create: `src/app/api/integrations/strava/authorize/route.ts`
- Create: `src/app/api/integrations/strava/callback/route.ts`

- [ ] **Step 1: Implement Strava authorize route**

```typescript
// src/app/api/integrations/strava/authorize/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Strava not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "activity:read_all",
    approval_prompt: "auto",
    state: userId, // Pass userId through OAuth flow
  });

  return NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params}`);
}
```

- [ ] **Step 2: Implement Strava callback route**

```typescript
// src/app/api/integrations/strava/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?strava=error&reason=denied", request.url),
    );
  }

  const clientId = process.env.STRAVA_CLIENT_ID!;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET!;

  // Exchange code for tokens
  const tokenRes = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?strava=error&reason=token_exchange", request.url),
    );
  }

  const tokenData = await tokenRes.json();

  // Save to Supabase using service role (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id: state,
        provider: "strava",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        provider_user_id: String(tokenData.athlete?.id),
        credentials: { expires_at: tokenData.expires_at },
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );

  if (dbError) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?strava=error&reason=db", request.url),
    );
  }

  // Trigger initial backfill
  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (backendUrl) {
    fetch(`${backendUrl}/sync/backfill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.RAILWAY_API_SECRET!,
      },
      body: JSON.stringify({
        provider: "strava",
        userId: state,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    }).catch(() => {}); // Fire and forget
  }

  return NextResponse.redirect(
    new URL("/dashboard/settings?strava=success", request.url),
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/integrations/strava/
git commit -m "feat: add Strava OAuth authorize and callback API routes"
```

---

## Task 11: Next.js Integration API Routes

**Files:**
- Create: `src/app/api/integrations/macrofactor/connect/route.ts`
- Create: `src/app/api/integrations/hevy/connect/route.ts`
- Create: `src/app/api/integrations/garmin/connect/route.ts`
- Create: `src/app/api/integrations/[provider]/disconnect/route.ts`
- Create: `src/app/api/integrations/[provider]/sync/route.ts`
- Create: `src/app/api/integrations/status/route.ts`

- [ ] **Step 1: Implement MacroFactor connect route**

```typescript
// src/app/api/integrations/macrofactor/connect/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  // Validate credentials by attempting Firebase auth
  const firebaseApiKey = process.env.MACROFACTOR_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    return NextResponse.json({ error: "MacroFactor not configured" }, { status: 500 });
  }

  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ios-Bundle-Identifier": "com.sbs.diet" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  if (!authRes.ok) {
    return NextResponse.json({ error: "Invalid MacroFactor credentials" }, { status: 401 });
  }

  // Encrypt and store credentials
  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const encryptedCreds = {
    email: encrypt(email, encryptionKey),
    password: encrypt(password, encryptionKey),
  };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: userId,
      provider: "macrofactor",
      credentials: encryptedCreds,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });

  // Trigger backfill
  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (backendUrl) {
    fetch(`${backendUrl}/sync/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": process.env.RAILWAY_API_SECRET! },
      body: JSON.stringify({
        provider: "macrofactor",
        userId,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ status: "connected" });
}
```

- [ ] **Step 2: Implement Hevy connect route**

```typescript
// src/app/api/integrations/hevy/connect/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey } = await request.json();
  if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 });

  // Validate by making a test call
  const testRes = await fetch("https://api.hevyapp.com/v1/workouts?page=1&pageSize=1", {
    headers: { "api-key": apiKey },
  });

  if (!testRes.ok) {
    return NextResponse.json({ error: "Invalid Hevy API key" }, { status: 401 });
  }

  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: userId,
      provider: "hevy",
      access_token: encrypt(apiKey, encryptionKey),
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });

  // Trigger backfill
  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (backendUrl) {
    fetch(`${backendUrl}/sync/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": process.env.RAILWAY_API_SECRET! },
      body: JSON.stringify({
        provider: "hevy",
        userId,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ status: "connected" });
}
```

- [ ] **Step 3: Implement Garmin connect route**

```typescript
// src/app/api/integrations/garmin/connect/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  // Validate via Garmin Python service
  const garminUrl = process.env.GARMIN_SERVICE_URL || process.env.RAILWAY_BACKEND_URL;
  if (!garminUrl) {
    return NextResponse.json({ error: "Garmin service not configured" }, { status: 500 });
  }

  const validateRes = await fetch(`${garminUrl}/auth/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const validateData = await validateRes.json();
  if (!validateData.valid) {
    return NextResponse.json(
      { error: validateData.error || "Invalid Garmin credentials" },
      { status: 401 },
    );
  }

  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const encryptedCreds = {
    email: encrypt(email, encryptionKey),
    password: encrypt(password, encryptionKey),
  };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: userId,
      provider: "garmin",
      credentials: encryptedCreds,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });

  // Trigger backfill
  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (backendUrl) {
    fetch(`${backendUrl}/sync/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": process.env.RAILWAY_API_SECRET! },
      body: JSON.stringify({
        provider: "garmin",
        userId,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ status: "connected" });
}
```

- [ ] **Step 4: Implement disconnect and sync trigger routes**

```typescript
// src/app/api/integrations/[provider]/disconnect/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_PROVIDERS = ["macrofactor", "hevy", "strava", "garmin"];

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });

  return NextResponse.json({ status: "disconnected" });
}
```

```typescript
// src/app/api/integrations/[provider]/sync/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_PROVIDERS = ["macrofactor", "hevy", "strava", "garmin"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  const res = await fetch(`${backendUrl}/sync/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.RAILWAY_API_SECRET!,
    },
    body: JSON.stringify({ provider, userId }),
  });

  if (!res.ok) return NextResponse.json({ error: "Sync trigger failed" }, { status: 500 });

  return NextResponse.json({ status: "sync_triggered" });
}
```

- [ ] **Step 5: Implement status route**

```typescript
// src/app/api/integrations/status/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("integrations")
    .select("provider, status, last_synced_at, created_at")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });

  // Build a map of all providers with their status
  const providers = ["macrofactor", "hevy", "strava", "garmin"];
  const statusMap = providers.map((provider) => {
    const integration = data?.find((i) => i.provider === provider);
    return {
      provider,
      connected: !!integration,
      status: integration?.status || "disconnected",
      lastSyncedAt: integration?.last_synced_at || null,
      connectedAt: integration?.created_at || null,
    };
  });

  return NextResponse.json({ integrations: statusMap });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/integrations/
git commit -m "feat: add Next.js integration API routes for connect, disconnect, status, and sync"
```

---

## Task 12: Settings Page Integration UI

**Files:**
- Create: `src/components/settings/integration-card.tsx`
- Create: `src/components/settings/credentials-modal.tsx`
- Create: `src/components/settings/api-key-modal.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Test: `__tests__/components/settings/integration-card.test.tsx`

- [ ] **Step 1: Write integration card tests**

```typescript
// __tests__/components/settings/integration-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntegrationCard } from "@/components/settings/integration-card";

describe("IntegrationCard", () => {
  it("renders disconnected state", () => {
    render(
      <IntegrationCard
        name="MacroFactor"
        description="Nutrition tracking & macros"
        provider="macrofactor"
        connected={false}
        status="disconnected"
        lastSyncedAt={null}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("MacroFactor")).toBeDefined();
    expect(screen.getByText("Not connected")).toBeDefined();
    expect(screen.getByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("renders connected state with last synced", () => {
    render(
      <IntegrationCard
        name="Hevy"
        description="Strength training"
        provider="hevy"
        connected={true}
        status="active"
        lastSyncedAt={new Date().toISOString()}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("Connected")).toBeDefined();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeDefined();
  });

  it("renders error state", () => {
    render(
      <IntegrationCard
        name="Garmin"
        description="Recovery"
        provider="garmin"
        connected={true}
        status="error"
        lastSyncedAt={null}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByText("Sync error")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/components/settings/integration-card.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement IntegrationCard**

```tsx
// src/components/settings/integration-card.tsx
"use client";

interface IntegrationCardProps {
  name: string;
  description: string;
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Connected", className: "bg-green-100 text-green-700" },
  error: { label: "Sync error", className: "bg-red-100 text-red-700" },
  expired: { label: "Expired", className: "bg-yellow-100 text-yellow-700" },
  disconnected: { label: "Not connected", className: "bg-gray-100 text-gray-500" },
};

export function IntegrationCard({
  name,
  description,
  provider,
  connected,
  status,
  lastSyncedAt,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const badge = STATUS_BADGE[status] || STATUS_BADGE.disconnected;

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <p className="font-medium">{name}</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        {connected && lastSyncedAt && (
          <p className="mt-0.5 text-xs text-gray-400">
            Last synced {formatTimeAgo(lastSyncedAt)}
          </p>
        )}
      </div>
      <div>
        {connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/components/settings/integration-card.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Implement connection modals**

```tsx
// src/components/settings/credentials-modal.tsx
"use client";

import { useState } from "react";

interface CredentialsModalProps {
  provider: string;
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function CredentialsModal({ provider, title, open, onClose, onSubmit }: CredentialsModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Connect {title}</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor={`${provider}-email`} className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id={`${provider}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${provider}-password`} className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id={`${provider}-password`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

```tsx
// src/components/settings/api-key-modal.tsx
"use client";

import { useState } from "react";

interface ApiKeyModalProps {
  provider: string;
  title: string;
  helpUrl?: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string) => Promise<void>;
}

export function ApiKeyModal({ provider, title, helpUrl, open, onClose, onSubmit }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit(apiKey);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Connect {title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          Requires Hevy Pro.{" "}
          {helpUrl && (
            <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              How to get your API key
            </a>
          )}
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor={`${provider}-key`} className="block text-sm font-medium text-gray-700">
              API Key
            </label>
            <input
              id={`${provider}-key`}
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="Enter your API key"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite Settings page**

```tsx
// src/app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { IntegrationCard } from "@/components/settings/integration-card";
import { CredentialsModal } from "@/components/settings/credentials-modal";
import { ApiKeyModal } from "@/components/settings/api-key-modal";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
}

const INTEGRATIONS = [
  { provider: "macrofactor", name: "MacroFactor", description: "Nutrition tracking & macros", type: "credentials" },
  { provider: "hevy", name: "Hevy", description: "Strength training & workouts", type: "api-key" },
  { provider: "strava", name: "Strava", description: "Running, cycling & swimming", type: "oauth" },
  { provider: "garmin", name: "Garmin", description: "Recovery, sleep & HRV", type: "credentials" },
] as const;

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [modal, setModal] = useState<{ provider: string; type: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    const res = await fetch("/api/integrations/status");
    if (res.ok) {
      const data = await res.json();
      setStatuses(data.integrations);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();

    // Check for Strava OAuth redirect result
    const params = new URLSearchParams(window.location.search);
    if (params.get("strava") === "success") {
      setToastMessage("Strava connected successfully!");
      window.history.replaceState({}, "", "/dashboard/settings");
    } else if (params.get("strava") === "error") {
      setToastMessage("Failed to connect Strava. Please try again.");
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [fetchStatuses]);

  const handleConnect = (provider: string, type: string) => {
    if (type === "oauth") {
      window.location.href = "/api/integrations/strava/authorize";
    } else {
      setModal({ provider, type });
    }
  };

  const handleDisconnect = async (provider: string) => {
    const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: "DELETE" });
    if (res.ok) {
      await fetchStatuses();
      setToastMessage(`${provider} disconnected.`);
    }
  };

  const handleCredentialsSubmit = async (provider: string, email: string, password: string) => {
    const res = await fetch(`/api/integrations/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Connection failed");
    }
    await fetchStatuses();
    setToastMessage(`${provider} connected!`);
  };

  const handleApiKeySubmit = async (provider: string, apiKey: string) => {
    const res = await fetch(`/api/integrations/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Connection failed");
    }
    await fetchStatuses();
    setToastMessage(`${provider} connected!`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {toastMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {toastMessage}
          <button onClick={() => setToastMessage(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect your fitness apps so Hybro can see your data.
        </p>
        <div className="mt-4 space-y-3">
          {INTEGRATIONS.map((integration) => {
            const status = statuses.find((s) => s.provider === integration.provider);
            return (
              <IntegrationCard
                key={integration.provider}
                name={integration.name}
                description={integration.description}
                provider={integration.provider}
                connected={status?.connected ?? false}
                status={status?.status ?? "disconnected"}
                lastSyncedAt={status?.lastSyncedAt ?? null}
                onConnect={() => handleConnect(integration.provider, integration.type)}
                onDisconnect={() => handleDisconnect(integration.provider)}
              />
            );
          })}
        </div>
      </div>

      {/* Credentials Modal (MacroFactor, Garmin) */}
      {modal?.type === "credentials" && (
        <CredentialsModal
          provider={modal.provider}
          title={INTEGRATIONS.find((i) => i.provider === modal.provider)?.name ?? ""}
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(email, password) => handleCredentialsSubmit(modal.provider, email, password)}
        />
      )}

      {/* API Key Modal (Hevy) */}
      {modal?.type === "api-key" && (
        <ApiKeyModal
          provider={modal.provider}
          title={INTEGRATIONS.find((i) => i.provider === modal.provider)?.name ?? ""}
          helpUrl="https://hevy.com/settings?developer"
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(apiKey) => handleApiKeySubmit(modal.provider, apiKey)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: All tests PASS (including new integration card tests)

- [ ] **Step 8: Commit**

```bash
git add src/components/settings/ src/app/dashboard/settings/page.tsx __tests__/components/settings/
git commit -m "feat: add Settings page with integration management UI and connection modals"
```

---

## Task 13: Dashboard Sync Status + Onboarding Wiring

**Files:**
- Create: `src/components/dashboard/sync-status.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/onboarding/step-integrations.tsx`

- [ ] **Step 1: Implement sync status component**

```tsx
// src/components/dashboard/sync-status.tsx
"use client";

import { useEffect, useState } from "react";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
  lastSyncedAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  macrofactor: "MF",
  hevy: "Hevy",
  strava: "Strava",
  garmin: "Garmin",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  error: "bg-red-500",
  disconnected: "bg-gray-300",
};

export function SyncStatus() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((res) => res.json())
      .then((data) => setStatuses(data.integrations))
      .catch(() => {});
  }, []);

  if (statuses.length === 0) return null;

  const connected = statuses.filter((s) => s.connected);
  if (connected.length === 0) return null;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-medium text-gray-500">Data Sources</h3>
      <div className="mt-2 flex gap-4">
        {statuses.map((s) => (
          <div key={s.provider} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${STATUS_DOT[s.status] || STATUS_DOT.disconnected}`} />
            <span className={`text-sm ${s.connected ? "text-gray-700" : "text-gray-400"}`}>
              {PROVIDER_LABELS[s.provider] || s.provider}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add sync status to dashboard**

Read `src/app/dashboard/page.tsx` first, then add the `SyncStatus` component. Add this import and component to the existing dashboard layout, after the greeting card or at the top of the page content.

Add import:
```tsx
import { SyncStatus } from "@/components/dashboard/sync-status";
```

Add component in the JSX where appropriate (e.g., after the header or before the placeholder cards):
```tsx
<SyncStatus />
```

- [ ] **Step 3: Wire onboarding integrations step**

Update `src/components/onboarding/step-integrations.tsx` to use the same connection flows as Settings. The Connect buttons should open the appropriate modal or redirect. Since the onboarding step is a client component, add state management for modals and API calls:

```tsx
// src/components/onboarding/step-integrations.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { OnboardingData } from "@/lib/onboarding/types";
import { CredentialsModal } from "@/components/settings/credentials-modal";
import { ApiKeyModal } from "@/components/settings/api-key-modal";

interface StepIntegrationsProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: string;
}

const integrations = [
  { provider: "macrofactor", name: "MacroFactor", description: "Nutrition tracking & macros", type: "credentials" },
  { provider: "hevy", name: "Hevy", description: "Strength training & workouts", type: "api-key" },
  { provider: "strava", name: "Strava", description: "Running, cycling & swimming", type: "oauth" },
  { provider: "garmin", name: "Garmin", description: "Recovery, sleep & HRV", type: "credentials" },
] as const;

export function StepIntegrations({ data, onUpdate }: StepIntegrationsProps) {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [modal, setModal] = useState<{ provider: string; type: string } | null>(null);

  const fetchStatuses = useCallback(async () => {
    const res = await fetch("/api/integrations/status");
    if (res.ok) {
      const result = await res.json();
      setStatuses(result.integrations);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleConnect = (provider: string, type: string) => {
    if (type === "oauth") {
      window.location.href = "/api/integrations/strava/authorize";
    } else {
      setModal({ provider, type });
    }
  };

  const handleCredentialsSubmit = async (provider: string, email: string, password: string) => {
    const res = await fetch(`/api/integrations/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Connection failed");
    }
    await fetchStatuses();
  };

  const handleApiKeySubmit = async (provider: string, apiKey: string) => {
    const res = await fetch(`/api/integrations/${provider}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Connection failed");
    }
    await fetchStatuses();
  };

  const connectedCount = statuses.filter((s) => s.connected).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Connect your apps</h2>
        <p className="mt-1 text-gray-500">
          Connect at least one app so Hybro can see your data. More connections = better coaching.
        </p>
      </div>

      <div className="space-y-3">
        {integrations.map((integration) => {
          const status = statuses.find((s) => s.provider === integration.provider);
          const isConnected = status?.connected ?? false;

          return (
            <div
              key={integration.provider}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">{integration.name}</p>
                <p className="text-sm text-gray-500">{integration.description}</p>
              </div>
              {isConnected ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                  Connected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnect(integration.provider, integration.type)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      {connectedCount > 0 && (
        <p className="text-center text-sm text-green-600">
          {connectedCount} app{connectedCount > 1 ? "s" : ""} connected
        </p>
      )}
      {connectedCount === 0 && (
        <p className="text-center text-sm text-gray-400">
          Connect at least one app to continue.
        </p>
      )}

      {modal?.type === "credentials" && (
        <CredentialsModal
          provider={modal.provider}
          title={integrations.find((i) => i.provider === modal.provider)?.name ?? ""}
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(email, password) => handleCredentialsSubmit(modal.provider, email, password)}
        />
      )}
      {modal?.type === "api-key" && (
        <ApiKeyModal
          provider={modal.provider}
          title={integrations.find((i) => i.provider === modal.provider)?.name ?? ""}
          helpUrl="https://hevy.com/settings?developer"
          open={true}
          onClose={() => setModal(null)}
          onSubmit={(apiKey) => handleApiKeySubmit(modal.provider, apiKey)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/sync-status.tsx src/app/dashboard/page.tsx src/components/onboarding/step-integrations.tsx
git commit -m "feat: add dashboard sync status and wire onboarding integrations step"
```

---

## Environment Setup Checklist

Before testing end-to-end, ensure these env vars are set:

### Next.js (`.env.local`)
```
# Existing
NEXT_PUBLIC_SUPABASE_URL=https://anjthenupycxzkvihzyf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>

# New for Phase 3
ENCRYPTION_KEY=<64-char hex string — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
RAILWAY_API_SECRET=<shared secret — generate similarly>
RAILWAY_BACKEND_URL=<Railway deployment URL or http://localhost:3001 for dev>
STRAVA_CLIENT_ID=<from strava.com/settings/api>
STRAVA_CLIENT_SECRET=<from strava.com/settings/api>
STRAVA_REDIRECT_URI=http://localhost:3000/api/integrations/strava/callback
MACROFACTOR_FIREBASE_API_KEY=<from macrofactor-mcp source>
GARMIN_SERVICE_URL=http://localhost:8000
```

### Railway Backend (`server/.env`)
```
SUPABASE_URL=https://anjthenupycxzkvihzyf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<same as above>
ENCRYPTION_KEY=<same as frontend>
API_SECRET=<same as RAILWAY_API_SECRET>
GARMIN_SERVICE_URL=http://localhost:8000
STRAVA_CLIENT_ID=<same as frontend>
STRAVA_CLIENT_SECRET=<same as frontend>
STRAVA_WEBHOOK_VERIFY_TOKEN=hybro-strava-verify
MACROFACTOR_FIREBASE_API_KEY=<same as frontend>
```
