# Hivesite Studio

The web app where owners manage their Hivesite sites. Vue 3, Vite and TypeScript (strict), with vue-router, Vitest, ESLint and Prettier. It is not a published-site template.

## Commands

Run from `web/studio`, with Node 22.22+ or 24.

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm ci`               | Install the locked dependencies                                  |
| `npm run dev`          | Start the dev server on http://localhost:5173                    |
| `npm run build`        | Build to `dist/`                                                 |
| `npm run lint`         | ESLint                                                           |
| `npm run typecheck`    | `vue-tsc --noEmit`                                               |
| `npm test`             | Vitest, once                                                     |
| `npm run format`       | Prettier, in place                                               |
| `npm run generate:api` | Regenerate `src/api/schema.d.ts` from `openapi/hivesite.json`    |

CI runs `npm ci`, `lint`, `typecheck`, `test` and `build`.

## Reaching the Host

The studio talks to the Host (`src/Hivesite.Host`) through one base URL:

| Variable            | Default                 | Meaning                       |
| ------------------- | ----------------------- | ----------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Base URL of the Hivesite Host |

Copy `.env.example` to `.env.local` to change it. Read it only through `src/config.ts`.

The dev server stays on port 5173, the origin the Host allows for CORS.

## API client

`src/api` holds the typed client (`openapi-fetch`) and the types generated from the OpenAPI document. The document is build output (`openapi/hivesite.json`, git-ignored). To refresh the types, run `dotnet build src/Hivesite.Host` from the repo root, then `npm run generate:api` in `web/studio`, and commit `src/api/schema.d.ts`. CI regenerates it and fails on any difference. Never edit either file by hand.

- Calls throw one `ApiError` (`code`, `message`, optional `field`). Branch on `code` only.
- `fieldKey(error.field)` maps a JSON Pointer (`/settings/description` becomes `settings.description`) or a query name (`limit`) to a form field key.
- `listAll(cursor => ...)` follows `next_cursor` until it is `null`.
- A 401 `unauthenticated` calls the handler set with `setUnauthenticatedHandler` (sign-in, #58, hooks in there).
