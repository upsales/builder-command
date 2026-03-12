import { google } from "googleapis";

export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  status: string; // confirmed, tentative, cancelled
  responseStatus: string; // needsAction, accepted, declined, tentative
  location: string | null;
  description: string | null;
  htmlLink: string;
  organizer: string | null;
  attendees: { name: string; email: string; responseStatus: string }[];
  conferenceLink: string | null;
}

function getBaseUrl() {
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? `${getBaseUrl()}/api/google/callback`
  );
}

export function getAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });
}

export async function exchangeCode(code: string): Promise<string> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh token received. Try revoking access and reconnecting.");
  }
  return tokens.refresh_token;
}

export interface CalendarInfo {
  id: string;
  name: string;
  primary: boolean;
  backgroundColor: string | null;
}

export async function listCalendars(refreshToken: string): Promise<CalendarInfo[]> {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: client });
  const res = await calendar.calendarList.list();
  return (res.data.items ?? [])
    .filter((c) => !c.deleted && c.selected !== false)
    .map((c) => ({
      id: c.id!,
      name: c.summary ?? c.id!,
      primary: c.primary === true,
      backgroundColor: c.backgroundColor ?? null,
    }))
    .sort((a, b) => (a.primary ? -1 : b.primary ? 1 : a.name.localeCompare(b.name)));
}

export async function fetchEvents(refreshToken: string): Promise<CalendarEvent[]> {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: client });

  // Fetch events for today and tomorrow
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfTomorrow = new Date(startOfDay);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

  // List all calendars the user has access to
  const calListRes = await calendar.calendarList.list();
  const calendars = (calListRes.data.items ?? []).filter(
    (c) => !c.deleted && c.selected !== false
  );

  const allEvents: CalendarEvent[] = [];
  const seenIds = new Set<string>();

  // Fetch events from all calendars in parallel
  const results = await Promise.all(
    calendars.map(async (cal) => {
      try {
        const res = await calendar.events.list({
          calendarId: cal.id!,
          timeMin: startOfDay.toISOString(),
          timeMax: endOfTomorrow.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });
        return { calendarId: cal.id!, calendarName: cal.summary ?? cal.id!, events: res.data.items ?? [] };
      } catch {
        return { calendarId: cal.id!, calendarName: cal.summary ?? cal.id!, events: [] };
      }
    })
  );

  for (const { calendarId, calendarName, events } of results) {
    for (const event of events) {
      if (!event.id || event.status === "cancelled") continue;
      // Deduplicate (same event can appear in multiple calendars)
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);

      const start = event.start?.dateTime ?? event.start?.date ?? "";
      const end = event.end?.dateTime ?? event.end?.date ?? "";
      const allDay = !event.start?.dateTime;

      const myAttendee = event.attendees?.find((a) => a.self === true);
      const responseStatus = myAttendee?.responseStatus ?? "accepted";

      const conferenceLink = event.conferenceData?.entryPoints?.find(
        (e) => e.entryPointType === "video"
      )?.uri ?? null;

      allEvents.push({
        id: event.id,
        calendarId,
        calendarName,
        title: event.summary ?? "(No title)",
        start,
        end,
        allDay,
        status: event.status ?? "confirmed",
        responseStatus,
        location: event.location ?? null,
        description: event.description ?? null,
        htmlLink: event.htmlLink ?? "",
        organizer: event.organizer?.displayName ?? event.organizer?.email ?? null,
        attendees: (event.attendees ?? [])
          .filter((a) => !a.resource)
          .map((a) => ({
            name: a.displayName ?? a.email ?? "",
            email: a.email ?? "",
            responseStatus: a.responseStatus ?? "needsAction",
          })),
        conferenceLink,
      });
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return allEvents;
}

export async function respondToEvent(
  refreshToken: string,
  eventId: string,
  response: "accepted" | "declined" | "tentative",
  calendarId?: string,
): Promise<void> {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: client });
  const calId = calendarId ?? "primary";

  const event = await calendar.events.get({
    calendarId: calId,
    eventId,
  });

  const attendees = event.data.attendees?.map((a) => {
    if (a.self) {
      return { ...a, responseStatus: response };
    }
    return a;
  });

  await calendar.events.patch({
    calendarId: calId,
    eventId,
    requestBody: { attendees },
  });
}
