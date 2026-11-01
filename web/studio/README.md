# Hivesite Studio

The web app where owners manage their Hivesite sites. Vue 3, Vite and TypeScript (strict), with vue-router, Vitest, ESLint and Prettier. It is not a published-site template.

## Commands

Run from `web/studio`, with Node 22.22+ or 24.

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm ci`            | Install the locked dependencies               |
| `npm run dev`       | Start the dev server on http://localhost:5173 |
| `npm run build`     | Build to `dist/`                              |
| `npm run lint`      | ESLint                                        |
| `npm run typecheck` | `vue-tsc --noEmit`                            |
| `npm test`          | Vitest, once                                  |
| `npm run format`    | Prettier, in place                            |

CI runs `npm ci`, `lint`, `typecheck`, `test` and `build`.

## Reaching the Host

The studio talks to the Host (`src/Hivesite.Host`) through one base URL:

| Variable            | Default                 | Meaning                       |
| ------------------- | ----------------------- | ----------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Base URL of the Hivesite Host |

Copy `.env.example` to `.env.local` to change it. Read it only through `src/config.ts`.

The dev server stays on port 5173, the origin the Host allows for CORS.
