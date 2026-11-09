import {
  guestCookie,
  readJson,
  requireSameOrigin,
  respond,
} from "../../../lib/server/http.ts";
import {
  publishProfile,
  withdrawProfile,
} from "../../../lib/server/network.ts";
import { traceOperation } from "../../../lib/telemetry.ts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return respond(() =>
    traceOperation("profile.publish", {}, async () => {
      requireSameOrigin(request);
      const { id, eventId, profile, token } = await publishProfile(
        request,
        await readJson(request),
      );
      return Response.json(
        { id, eventId, profile },
        { headers: { "Set-Cookie": guestCookie(token, request) } },
      );
    }),
  );
}
export async function DELETE(request: Request) {
  return respond(() =>
    traceOperation("profile.withdraw", {}, async () => {
      requireSameOrigin(request);
      await withdrawProfile(request);
      // The guest identity may still own an introduction in another conference.
      return Response.json({ withdrawn: true });
    }),
  );
}
