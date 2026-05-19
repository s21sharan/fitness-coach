import { extractFactsFromChat, extractFactsFromNote } from "@/lib/athlete-context/extractor";
import { insertFact } from "@/lib/athlete-context/facts";

interface ChatJobInput {
  userId: string;
  userMessage: string;
  assistantText: string;
  conversationId: string;
}

/**
 * Fire-and-forget runner used from the chat route's onFinish. Extracts
 * durable facts from a single user/assistant exchange and writes them to
 * athlete_facts. Failure modes are swallowed — extraction must never break
 * a successful chat turn.
 */
export function runChatExtractorJob(input: ChatJobInput): void {
  if (!input.userMessage.trim() || !input.assistantText.trim()) return;
  // Intentionally not awaited; the caller streams response immediately.
  void (async () => {
    try {
      const facts = await extractFactsFromChat({
        userMessage: input.userMessage,
        assistantText: input.assistantText,
      });
      for (const f of facts) {
        await insertFact(input.userId, {
          ...f,
          source_ref_table: "chat_messages",
          source_ref_id: input.conversationId,
        });
      }
    } catch (e) {
      console.error("runChatExtractorJob failed", e);
    }
  })();
}

interface NoteJobInput {
  userId: string;
  plannedWorkoutId: string;
  sessionType: string;
  date: string;
  noteText: string;
  source: "completion_note" | "skip_note";
}

export function runNoteExtractorJob(input: NoteJobInput): void {
  if (!input.noteText.trim()) return;
  void (async () => {
    try {
      const facts = await extractFactsFromNote({
        noteText: input.noteText,
        context: {
          sessionType: input.sessionType,
          date: input.date,
          source: input.source,
        },
      });
      for (const f of facts) {
        await insertFact(input.userId, {
          ...f,
          source: input.source,
          source_ref_table: "planned_workouts",
          source_ref_id: input.plannedWorkoutId,
        });
      }
    } catch (e) {
      console.error("runNoteExtractorJob failed", e);
    }
  })();
}

interface PlanAcceptanceInput {
  userId: string;
  planId: string;
  splitType: string;
  daysPerWeek: number | null;
  aggressiveness: string | null;
}

/**
 * Synchronous-ish: writes a small fixed set of preference facts derived from
 * the just-accepted plan. Called from /api/plan/accept. We do NOT call the
 * extractor here — these signals are structured, not free text. Awaiting is
 * cheap (3 inserts) so the route can confirm they landed.
 */
export async function emitPlanAcceptanceFacts(input: PlanAcceptanceInput): Promise<void> {
  const baseRef = {
    source: "plan_acceptance" as const,
    source_ref_table: "training_plans",
    source_ref_id: input.planId,
  };
  try {
    await insertFact(input.userId, {
      category: "preference",
      subject: "split_type",
      predicate: "selected",
      value: { split_type: input.splitType },
      summary: `Selected ${input.splitType} split on most recent plan acceptance.`,
      lifecycle: "standing",
      confidence: 0.9,
      ...baseRef,
    });
    if (input.daysPerWeek != null) {
      await insertFact(input.userId, {
        category: "preference",
        subject: "days_per_week",
        predicate: "selected",
        value: { days: input.daysPerWeek },
        summary: `Accepted plan with ${input.daysPerWeek} training days/week.`,
        lifecycle: "standing",
        confidence: 0.9,
        ...baseRef,
      });
    }
    if (input.aggressiveness) {
      await insertFact(input.userId, {
        category: "preference",
        subject: "aggressiveness",
        predicate: "selected",
        value: { level: input.aggressiveness },
        summary: `Accepted plan at ${input.aggressiveness} aggressiveness.`,
        lifecycle: "standing",
        confidence: 0.85,
        ...baseRef,
      });
    }
  } catch (e) {
    console.error("emitPlanAcceptanceFacts failed", e);
  }
}
