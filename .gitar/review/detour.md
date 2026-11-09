# Detour review requirements

Review each feature PR against these product-specific invariants:

- Profiles and invitation payloads cross a trust boundary. Validate JSON shape, string lengths, allowed enum values, participant IDs, and timestamps on the server; client validation alone is insufficient.
- An NFC/QR link opens an invitation; it does not authenticate a participant or prove physical presence. A request must never choose another user's session or accept on someone else's behalf.
- Concurrent and repeated acceptance must not exceed circle capacity, duplicate a participant, or lose an already accepted participant. Elasticsearch updates that depend on previous state must use optimistic concurrency and handle conflicts.
- Expired or revoked invitations cannot be accepted. Use server time and UTC timestamps; show a useful recovery message without exposing internal database errors.
- Keep API keys, session cookies, and auth headers server-side. Never use NEXT_PUBLIC_ for service secrets or include secrets in Docker build arguments, source files, screenshots, or logs.
- Telemetry may contain operation names, status, durations, and counts. It must not contain profile text, queries, invitation bearer tokens, cookie contents, or raw Elasticsearch error bodies.
- Preserve demo labels whenever fictional attendees or local sample matches appear. Do not claim a service is connected merely because an environment variable exists.
- Keep published-profile consent explicit. Browser-local draft edits must not silently publish personal information.
- UI and API response changes must agree. Preserve keyboard access, visible input labels, dialog focus restoration, loading/error recovery, and bounded wrapping of user text.
- Keep regression coverage for matching, input validation, authorization, expiry, idempotency, and concurrent acceptance when those behaviors change. Run npm test, npm run build, and npm run typecheck before approval.

Prefer a small fix at the shared cause. Do not enable auto-merge or broaden credentials to make checks pass.
