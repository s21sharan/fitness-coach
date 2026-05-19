import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listAllFactsForUser, archiveFact, updateFactSummary, insertFact } from "@/lib/athlete-context/facts";
import {
  FACT_CATEGORIES,
  FACT_LIFECYCLES,
  FACT_PREDICATES,
  isKnownCategory,
  isKnownPredicate,
} from "@/lib/athlete-context/vocab";
import type { FactLifecycle } from "@/lib/athlete-context/types";
import { normalizeSubject } from "@/lib/athlete-context/format";

// GET   /api/athlete-facts → list facts (active first by recency)
// POST  /api/athlete-facts → create a manual fact (source='manual')
// PATCH /api/athlete-facts → archive or edit a fact's summary
//
// User-facing surface for the Coach Memory page. The extractor pipeline
// inserts facts implicitly; POST is the manual-entry path.

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const facts = await listAllFactsForUser(userId);
  return NextResponse.json({
    facts,
    vocab: {
      categories: FACT_CATEGORIES,
      predicates: FACT_PREDICATES,
      lifecycles: FACT_LIFECYCLES,
    },
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    category?: string;
    subject?: string | null;
    predicate?: string;
    summary?: string;
    lifecycle?: string;
    custom_expires_days?: number | null;
  };

  const category = (body.category ?? "").trim();
  const predicate = (body.predicate ?? "").trim();
  const summary = (body.summary ?? "").trim();
  const requestedLifecycle = (body.lifecycle ?? "").trim();
  const subject = typeof body.subject === "string" ? normalizeSubject(body.subject) : null;
  const customDaysRaw = body.custom_expires_days;
  const customDays =
    typeof customDaysRaw === "number" && Number.isFinite(customDaysRaw) && customDaysRaw > 0
      ? Math.min(3650, Math.round(customDaysRaw))
      : null;

  if (!isKnownCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!isKnownPredicate(predicate)) {
    return NextResponse.json({ error: "Invalid predicate" }, { status: 400 });
  }
  if (summary.length < 3) {
    return NextResponse.json({ error: "Summary too short" }, { status: 400 });
  }

  let lifecycle: FactLifecycle;
  let expiresAtOverride: string | null | undefined; // undefined = "use lifecycle default"

  if (requestedLifecycle === "custom") {
    if (customDays == null) {
      return NextResponse.json({ error: "custom_expires_days required for custom lifecycle" }, { status: 400 });
    }
    lifecycle = bucketLifecycleFromDays(customDays);
    expiresAtOverride = new Date(Date.now() + customDays * 24 * 60 * 60 * 1000).toISOString();
  } else if ((FACT_LIFECYCLES as readonly string[]).includes(requestedLifecycle)) {
    lifecycle = requestedLifecycle as FactLifecycle;
    expiresAtOverride = undefined;
  } else {
    return NextResponse.json({ error: "Invalid lifecycle" }, { status: 400 });
  }

  const fact = await insertFact(userId, {
    category,
    subject,
    predicate,
    value: customDays != null ? { custom_expires_days: customDays } : null,
    summary: summary.slice(0, 280),
    lifecycle,
    confidence: 1,
    source: "manual",
    expires_at: expiresAtOverride,
  });
  if (!fact) return NextResponse.json({ error: "Failed to create fact" }, { status: 500 });
  return NextResponse.json({ fact });
}

/**
 * Map a custom number of days to one of the four named lifecycle buckets
 * used by the system prompt for grouping. The bucket is just for display
 * ordering; expires_at is set explicitly so the actual TTL is exact.
 */
function bucketLifecycleFromDays(days: number): FactLifecycle {
  if (days <= 5) return "ephemeral";
  if (days <= 20) return "recent";
  return "standing";
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    factId: string;
    action: "archive" | "edit";
    summary?: string;
  };
  if (!body?.factId || !body?.action) {
    return NextResponse.json({ error: "factId and action required" }, { status: 400 });
  }

  if (body.action === "archive") {
    const ok = await archiveFact(userId, body.factId);
    return NextResponse.json({ ok });
  }
  if (body.action === "edit") {
    const summary = (body.summary ?? "").trim();
    if (!summary) return NextResponse.json({ error: "summary required" }, { status: 400 });
    const ok = await updateFactSummary(userId, body.factId, summary.slice(0, 280));
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
