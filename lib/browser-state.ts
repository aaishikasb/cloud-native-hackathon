import { validateProfile, type Profile } from "./detour.ts";

type BrowserState = { profile: Profile | null; saved: string[] };

export function parseBrowserState(raw: string | null): BrowserState {
  const stored: unknown = raw ? JSON.parse(raw) : null;
  if (!stored || typeof stored !== "object")
    return { profile: null, saved: [] };

  const value = stored as Record<string, unknown>;
  const candidate = value.profile as Partial<Profile> | null;
  let profile: Profile | null = null;
  if (
    candidate &&
    typeof candidate.name === "string" &&
    typeof candidate.offer === "string" &&
    typeof candidate.ask === "string" &&
    typeof candidate.available === "boolean" &&
    (candidate.mode === "In person" || candidate.mode === "Text first") &&
    !validateProfile(candidate as Profile)
  ) {
    profile = {
      name: candidate.name,
      offer: candidate.offer,
      ask: candidate.ask,
      mode: candidate.mode,
      available: candidate.available,
    };
  }

  const saved = Array.isArray(value.saved)
    ? [
        ...new Set(
          value.saved.filter(
            (id): id is string =>
              typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id),
          ),
        ),
      ]
    : [];
  return { profile, saved };
}

export function serializeBrowserState(
  profile: Profile | null,
  saved: readonly string[],
): string {
  // Null preserves bookmarks without promoting the displayed sample into a saved draft.
  return JSON.stringify({ profile, saved });
}
