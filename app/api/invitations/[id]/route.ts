import { respond } from "../../../../lib/server/http.ts";
import { getInvitation } from "../../../../lib/server/network.ts";
import { traceOperation } from "../../../../lib/telemetry.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return respond(() =>
    traceOperation("invitation.read", {}, async () =>
      Response.json(await getInvitation(request, (await context.params).id)),
    ),
  );
}
