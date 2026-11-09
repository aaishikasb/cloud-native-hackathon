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
      const { id, profile, token } = await publishProfile(
        request,
        await readJson(request),
      );
      return Response.json(
        { id, profile },
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
      return Response.json(
        { withdrawn: true },
        { headers: { "Set-Cookie": guestCookie("", request, true) } },
      );
    }),
  );
}
