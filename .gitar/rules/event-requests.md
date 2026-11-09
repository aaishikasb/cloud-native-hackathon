---
title: "Review public event requests"
description: "Check proposed event requests for complete public details, duplicates, and readiness for maintainer approval."
type: check
when: "PRs modifying event-requests/*.json, lib/event-request.ts, or lib/events.ts"
actions: "Report approval readiness with exact file and test evidence in Verification. Do not modify files, apply fixes, merge requests, or publish events automatically."
---

Check each added or changed `event-requests/*.json` against `parseEventRequest` in `lib/event-request.ts` and `tests/event-request.test.ts`.

- Require the event name, public HTTPS website, city or venue, real start/end dates in order, and a brief reason. Enforce the parser's field limits and generated safe slug. The filename must match `eventRequestFilename`.
- Compare normalized names and IDs with `lib/events.ts` and other pending request files. Identify duplicates instead of adding another event.
- Public requests must not contain access codes, passwords, API keys, private contact details, or claims of organizer approval without evidence. Flag uncertain public details for the maintainer to confirm from the supplied official event website.
- A valid JSON request is a proposal, not authorization or an automatically active event. State whether a human maintainer has enough information to review it. A catalog update requires explicit approval; when an approved request becomes a catalog entry, remove its pending request file in the same change.

Do not treat passing CI as organizer permission or proof that dates and venue details are current. Report what remains uncertain. Never auto-apply suggested changes or create credentials.
