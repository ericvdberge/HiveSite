---
name: dashboard
description: Starts the local factory dashboard (tools/factory-dashboard) and opens it. Use when asked to open, launch or show the factory dashboard, or on /dashboard.
disable-model-invocation: true
---

# Open the factory dashboard

The dashboard is a local server on http://localhost:4310. It's documented in `tools/factory-dashboard/README.md`.

## Steps

1. Check whether it already runs: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4310/api/claude`. A `200` means it's up; go to step 3.
2. Start it:
   - In the Claude desktop app, call `preview_start` with the name `factory-dashboard` from `.claude/launch.json`. It runs the server and opens the page in the browser pane.
   - Anywhere else, run `node tools/factory-dashboard/serve.mjs` from the repository root in the background, then wait until step 1 returns `200`.
3. Open http://localhost:4310, in the browser pane if you have one, otherwise in the user's browser (`start` on Windows, `open` on macOS, `xdg-open` on Linux). Skip this if `preview_start` already opened it.
4. Read `http://127.0.0.1:4310/api/claude`. If `loggedIn` is false, tell the user to run `claude auth login` in an ordinary terminal; runs won't start until then.
5. Reply in one or two lines: the link, and how many items wait on the user (count the cards on the page's *Your turn* view, or say it's open if you can't read it).

Don't press buttons on the page. Approving, merging and sending feedback are the user's to do.
