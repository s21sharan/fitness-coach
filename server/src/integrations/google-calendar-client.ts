import { supabase } from "../db.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

interface CalendarEvent {
  id: string;
  start: string;
  end: string;
  summary: string;
}

interface PlannedWorkout {
  id: string;
  calendar_event_id: string;
  scheduled_time: string;
  session_type: string;
}

interface Reschedule {
  workoutId: string;
  eventId: string;
  oldTime: string;
  newTime: string;
}

export function detectReschedules(
  calendarEvents: CalendarEvent[],
  plannedWorkouts: PlannedWorkout[],
): Reschedule[] {
  const reschedules: Reschedule[] = [];
  const eventMap = new Map(calendarEvents.map((e) => [e.id, e]));

  for (const workout of plannedWorkouts) {
    if (!workout.calendar_event_id || !workout.scheduled_time) continue;
    const event = eventMap.get(workout.calendar_event_id);
    if (!event) continue;

    const eventStart = new Date(event.start).toISOString();
    const workoutStart = new Date(workout.scheduled_time).toISOString();

    if (eventStart !== workoutStart) {
      reschedules.push({
        workoutId: workout.id,
        eventId: workout.calendar_event_id,
        oldTime: workoutStart,
        newTime: eventStart,
      });
    }
  }

  return reschedules;
}

async function refreshGoogleToken(userId: string): Promise<string> {
  const { data: integration } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, credentials")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .single();

  if (!integration) throw new Error("No Google Calendar integration");

  const expiresAt = (integration.credentials as { expires_at?: number })?.expires_at ?? 0;

  if (Date.now() / 1000 > expiresAt - 300) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        refresh_token: integration.refresh_token!,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) throw new Error("Google token refresh failed");
    const data = await res.json();
    const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    await supabase
      .from("integrations")
      .update({
        access_token: data.access_token,
        credentials: { expires_at: newExpiresAt },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "google_calendar");

    return data.access_token;
  }

  return integration.access_token!;
}

export async function fetchCalendarEvents(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const token = await refreshGoogleToken(userId);

  const params = new URLSearchParams({
    timeMin: `${startDate}T00:00:00Z`,
    timeMax: `${endDate}T23:59:59Z`,
    singleEvents: "true",
    orderBy: "startTime",
    q: "[Hybro]",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error(`Google Calendar API failed: ${res.status}`);

  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || "",
    summary: item.summary || "",
  }));
}

export async function checkForReschedules(userId: string, planId: string): Promise<Reschedule[]> {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = monday.toISOString().slice(0, 10);
  const endStr = sunday.toISOString().slice(0, 10);

  const calendarEvents = await fetchCalendarEvents(userId, startStr, endStr);

  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("id, calendar_event_id, scheduled_time, session_type")
    .eq("plan_id", planId)
    .not("calendar_event_id", "is", null)
    .gte("date", startStr)
    .lte("date", endStr);

  if (!workouts || workouts.length === 0) return [];

  const reschedules = detectReschedules(calendarEvents, workouts as PlannedWorkout[]);

  for (const r of reschedules) {
    await supabase
      .from("planned_workouts")
      .update({ scheduled_time: r.newTime })
      .eq("id", r.workoutId);

    logger.info("Calendar reschedule detected", { workoutId: r.workoutId, oldTime: r.oldTime, newTime: r.newTime });
  }

  return reschedules;
}
