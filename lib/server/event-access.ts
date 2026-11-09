import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { EventId } from "../events.ts";
import { ApiError } from "./http.ts";

const accessSeconds = 12 * 60 * 60;

function configuredCode(eventId: EventId): string | null {
  const raw = process.env.EVENT_ACCESS_CODES;
  if (!raw && process.env.NODE_ENV !== "production") return null;
  try {
    const codes: unknown = JSON.parse(raw || "");
    const code =
      codes && typeof codes === "object" && !Array.isArray(codes)
        ? (codes as Record<string, unknown>)[eventId]
        : null;
    if (
      typeof code === "string" &&
      code.length >= 8 &&
      code.length <= 80 &&
      code === code.trim()
    )
      return code;
  } catch {}
  throw new ApiError(
    503,
    "Event access is not configured. Ask the organizer to check the event code.",
  );
}

function cookieName(eventId: EventId) {
  return `detour_access_${eventId}`;
}

function signature(eventId: EventId, value: string, code: string) {
  return createHmac("sha256", code)
    .update(`${eventId}:${value}`)
    .digest("base64url");
}

function equal(left: string, right: string) {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}

export function eventAccessStatus(request: Request, eventId: EventId) {
  const code = configuredCode(eventId);
  if (!code) return { required: false, granted: true };
  const name = `${cookieName(eventId)}=`;
  const value = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name))
    ?.slice(name.length);
  const parts = value?.split(".");
  if (!parts || parts.length !== 3) return { required: true, granted: false };
  const [expires, nonce, signed] = parts;
  const now = Math.floor(Date.now() / 1000);
  const expiry = Number(expires);
  const valid =
    /^\d{10}$/.test(expires) &&
    /^[A-Za-z0-9_-]{16}$/.test(nonce) &&
    /^[A-Za-z0-9_-]{43}$/.test(signed) &&
    Number.isSafeInteger(expiry) &&
    expiry > now &&
    expiry <= now + accessSeconds &&
    equal(signed, signature(eventId, `${expires}.${nonce}`, code));
  return { required: true, granted: valid };
}

export function requireEventAccess(request: Request, eventId: EventId) {
  if (!eventAccessStatus(request, eventId).granted)
    throw new ApiError(
      403,
      "Enter this event’s access code using Event network before continuing.",
    );
}

export function grantEventAccess(
  request: Request,
  eventId: EventId,
  value: unknown,
): string {
  const code = configuredCode(eventId);
  if (!code)
    throw new ApiError(400, "This development network does not require a code.");
  if (typeof value !== "string" || value.length > 80 || !equal(value.trim(), code))
    throw new ApiError(
      403,
      "That event code did not match. Check it with the organizer and try again.",
    );
  const unsigned = `${Math.floor(Date.now() / 1000) + accessSeconds}.${randomBytes(12).toString("base64url")}`;
  const secure = new URL(process.env.APP_URL || request.url).protocol === "https:";
  return `${cookieName(eventId)}=${unsigned}.${signature(eventId, unsigned, code)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${accessSeconds}${secure ? "; Secure" : ""}`;
}
