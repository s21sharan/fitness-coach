import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

interface RaceSearchResult {
  name: string;
  date: string;
  city: string;
  state: string;
  distance: string;
  sport_type: string;
  url: string;
  runsignup_id: number;
}

type RunSignUpEventType =
  | "running_race"
  | "trail_race"
  | "ultra"
  | "triathlon"
  | "duathlon"
  | "bike_race"
  | "swim"
  | string;

function mapEventType(eventType: RunSignUpEventType): string {
  switch (eventType) {
    case "running_race":
    case "trail_race":
    case "ultra":
      return "running";
    case "triathlon":
    case "duathlon":
      return "triathlon";
    case "bike_race":
      return "cycling";
    case "swim":
      return "swimming";
    default:
      return "other";
  }
}

interface RunSignUpEvent {
  distance: string;
  event_type: string;
}

interface RunSignUpRace {
  race_id: number;
  name: string;
  next_date: string;
  address: { city: string; state: string };
  events: RunSignUpEvent[];
  url: string;
}

interface RunSignUpResponse {
  races: Array<{ race: RunSignUpRace }>;
}

export async function GET(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const location = url.searchParams.get("location");
  const radiusParam = url.searchParams.get("radius");

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required and must be at least 2 characters" },
      { status: 400 },
    );
  }

  const today = new Date().toISOString().split("T")[0];

  const params = new URLSearchParams({
    name: q,
    start_date: today,
    results_per_page: "10",
    sort: "date ASC",
    format: "json",
  });

  if (process.env.RUNSIGNUP_API_KEY) {
    params.set("api_key", process.env.RUNSIGNUP_API_KEY);
  }
  if (process.env.RUNSIGNUP_API_SECRET) {
    params.set("api_secret", process.env.RUNSIGNUP_API_SECRET);
  }

  if (location) {
    params.set("zipcode", location);
    params.set("radius", radiusParam ?? "50");
  }

  const runsignupUrl = `https://runsignup.com/Rest/races?${params.toString()}`;

  try {
    const response = await fetch(runsignupUrl);

    if (!response.ok) {
      return NextResponse.json({ error: "RunSignUp API request failed" }, { status: 502 });
    }

    const data: RunSignUpResponse = await response.json();

    const races: RaceSearchResult[] = (data.races ?? []).map(({ race }) => {
      const firstEvent = race.events?.[0];
      return {
        runsignup_id: race.race_id,
        name: race.name,
        date: race.next_date,
        city: race.address?.city ?? "",
        state: race.address?.state ?? "",
        distance: firstEvent?.distance ?? "",
        sport_type: mapEventType(firstEvent?.event_type ?? ""),
        url: race.url,
      };
    });

    return NextResponse.json({ races });
  } catch {
    return NextResponse.json({ error: "Failed to reach RunSignUp API" }, { status: 502 });
  }
}
