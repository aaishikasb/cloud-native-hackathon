# Detour

Conference networking UI prototype. Next.js App Router, React, TypeScript, Tailwind CSS 4, and Phosphor Icons. Package manager: npm.

## Commands

- `npm install`
- `npm run dev` — local preview at http://localhost:3000
- `npm run build` — production validation
- `npm run typecheck`
- `npm test` — Node built-in tests; requires Node 22.6+ for TypeScript stripping (Node 23.6+ recommended).

## Project conventions

- Semantic colors and font mappings live in `app/globals.css`. Use Tailwind's existing scales.
- Stack Sans Notch is for headings and callouts; Stack Sans Text is for body and controls. Fonts and OFL licenses are self-hosted in `public/fonts`.
- `lib/detour.ts` contains fictional sample attendees and pure search/profile-validation logic.
- `components/detour-app.tsx` owns the client UI, native dialogs, and versioned browser-local persistence.
- Preserve explicit demo labels. No live attendees, actual invitations, AI matching, Elasticsearch, Dash0, Radar, or Gitar integrations exist yet.
- NFC is an HTTPS URL entry point, not authentication. The QR code encodes the same sample invite URL; a public or otherwise phone-reachable URL is needed for a phone demo.
- Do not log profile content or commit credentials. If connected services are added, keep credentials server-side.
- Verify desktop/mobile rendering and keyboard/dialog behavior after UI edits. Keep regression tests for nontrivial matching or persistence changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
