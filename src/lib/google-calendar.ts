import { createClient } from "@supabase/supabase-js";

interface CalendarEvent {
  start: string;
  end: string;
  summary: string;
}

interface TimeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

export function parseAvailableSlots(
  events: CalendarEvent[],
  dateStr: string,
  startHour: number,
  endHour: number,
): TimeSlot[] {
  const dayStart = new Date(`${dateStr}T${String(startHour).padStart(2, "0")}:00:00Z`);
  const dayEnd = new Date(`${dateStr}T${String(endHour).padStart(2, "0")}:00:00Z`);

  const sorted = events
    .map((e) => ({ start: new Date(e.start), end: new Date(e.end) }))
    .filter((e) => e.end > dayStart && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const slots: TimeSlot[] = [];
  let cursor = dayStart;

  for (const event of sorted) {
    if (event.start > cursor) {
      const durationMs = event.start.getTime() - cursor.getTime();
      if (durationMs >= 30 * 60 * 1000) {
        slots.push({
          start: cursor.toISOString(),
          end: event.start.toISOString(),
          durationMinutes: Math.round(durationMs / 60000),
        });
      }
    }
    if (event.end > cursor) cursor = event.end;
  }

  if (cursor < dayEnd) {
    const durationMs = dayEnd.getTime() - cursor.getTime();
    if (durationMs >= 30 * 60 * 1000) {
      slots.push({
        start: cursor.toISOString(),
        end: dayEnd.toISOString(),
        durationMinutes: Math.round(durationMs / 60000),
      });
    }
  }

  return slots;
}

async function refreshGoogleToken(userId: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
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

export async function getCalendarEvents(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const token = await refreshGoogleToken(userId);

  const params = new URLSearchParams({
    timeMin: `${startDate}T00:00:00Z`,
    timeMax: `${endDate}T23:59:59Z`,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error(`Google Calendar API failed: ${res.status}`);

  const data = await res.json();
  return (data.items || []).map((item: { start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; summary?: string }) => ({
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || "",
    summary: item.summary || "",
  }));
}

export async function createCalendarEvent(
  userId: string,
  summary: string,
  description: string,
  startTime: string,
  durationMinutes: number,
): Promise<string> {
  const token = await refreshGoogleToken(userId);

  const startDate = new Date(startTime);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
      }),
    },
  );

  if (!res.ok) throw new Error(`Failed to create calendar event: ${res.status}`);
  const data = await res.json();
  return data.id;
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  const token = await refreshGoogleToken(userId);

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}
