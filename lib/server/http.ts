import { createHash, randomBytes } from "node:crypto";
import { validateProfile, type Profile } from "../detour.ts";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function respond(
  action: () => Promise<Response>,
): Promise<Response> {
  try {
    const response = await action();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : "The conference network is unavailable. Please try again shortly.",
      },
      {
        status: error instanceof ApiError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export function requireSameOrigin(request: Request) {
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (request.headers.get("Origin") !== expected) {
    throw new ApiError(
      403,
      "Open Detour in this browser before making changes.",
    );
  }
}

export async function readJson(request: Request): Promise<unknown> {
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim() !==
    "application/json"
  ) {
    throw new ApiError(415, "Send this request as JSON.");
  }
  const limit = 16 * 1024;
  if (Number(request.headers.get("Content-Length")) > limit) {
    throw new ApiError(
      413,
      "This request is too large. Shorten your introduction and try again.",
    );
  }
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(400, "Add the required information and try again.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new ApiError(
          413,
          "This request is too large. Shorten your introduction and try again.",
        );
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      "This request is not valid JSON. Please try again.",
    );
  } finally {
    reader.releaseLock();
  }
}

export function parseProfile(value: unknown): Profile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Add your introduction before publishing it.");
  }
  const profile = value as Record<string, unknown>;
  if (
    typeof profile.name !== "string" ||
    typeof profile.offer !== "string" ||
    typeof profile.ask !== "string" ||
    typeof profile.available !== "boolean" ||
    (profile.mode !== "In person" && profile.mode !== "Text first")
  ) {
    throw new ApiError(
      400,
      "Check your name, offer, ask, and connection preference.",
    );
  }
  const clean: Profile = {
    name: profile.name.trim(),
    offer: profile.offer.trim(),
    ask: profile.ask.trim(),
    available: profile.available,
    mode: profile.mode,
  };
  const error = validateProfile(clean);
  if (error) throw new ApiError(400, error);
  return clean;
}

export function requireId(value: string): string {
  if (!/^[a-zA-Z0-9_-]{20,64}$/.test(value))
    throw new ApiError(404, "This invitation or profile could not be found.");
  return value;
}

export function guestToken(request: Request): string | null {
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("detour_guest="))
    ?.slice("detour_guest=".length);
  return token && /^[a-zA-Z0-9_-]{43}$/.test(token) ? token : null;
}

export function newGuestToken() {
  return randomBytes(32).toString("base64url");
}
export function ownerHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function guestCookie(
  token: string,
  request: Request,
  expire = false,
): string {
  const secure =
    new URL(process.env.APP_URL || request.url).protocol === "https:";
  return `detour_guest=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expire ? 0 : 60 * 60 * 24 * 7}${secure ? "; Secure" : ""}`;
}
