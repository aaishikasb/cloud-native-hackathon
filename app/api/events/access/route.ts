import { getEventId } from "../../../../lib/events.ts";
import { eventAccessStatus, grantEventAccess } from "../../../../lib/server/event-access.ts";
import { ApiError, readJson, requireSameOrigin, respond } from "../../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function selectedEvent(request: Request) {
  const eventId = getEventId(new URL(request.url).searchParams.get("event"));
  if (!eventId) throw new ApiError(400, "Choose a supported conference.");
  return eventId;
}

export async function GET(request: Request) {
  return respond(async () => Response.json(eventAccessStatus(request, selectedEvent(request))));
}

export async function POST(request: Request) {
  return respond(async () => {
    requireSameOrigin(request);
    const eventId = selectedEvent(request);
    const input = await readJson(request);
    const code = input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>).code : undefined;
    const cookie = grantEventAccess(request, eventId, code);
    return Response.json({ required: true, granted: true }, { headers: { "Set-Cookie": cookie } });
  });
}
