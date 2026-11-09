import { requireSameOrigin, respond } from "../../../../../lib/server/http.ts";
import { acceptInvitation } from "../../../../../lib/server/network.ts";
import { traceOperation } from "../../../../../lib/telemetry.ts";

export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return respond(() =>
    traceOperation("invitation.accept", {}, async () => {
      requireSameOrigin(request);
      return Response.json(
        await acceptInvitation(request, (await context.params).id),
      );
    }),
  );
}
