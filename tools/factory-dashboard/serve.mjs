#!/usr/bin/env node
// The Factory Dashboard: a local page over the GitHub board. GitHub holds every
// ticket; this server only reads it with `gh`, runs the board script, and starts
// the manager headless (`claude -p --agent manager`) when a button asks for work.
//
//   node tools/factory-dashboard/serve.mjs          → http://localhost:4310
//
// Needs `gh` signed in with the project scope and `claude` on the PATH.

import { spawn, execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const RUNS_DIR = join(HERE, ".runs");
const LOG_FILE = join(RUNS_DIR, "log.jsonl");
const PORT = Number(process.env.FACTORY_PORT ?? 4310);
const cfg = JSON.parse(readFileSync(join(ROOT, ".github/factory.json"), "utf8"));
const [OWNER, NAME] = cfg.repo.split("/");
const COLUMNS = ["Backlog", "Ready", "Spec review", "Building", "Agent review", "Ready to merge", "Done"];

// Headless runs can't ask for approval, so they get the tools the factory needs.
// The deny rules in .claude/settings.json (no merge, no push to main) still apply.
const PERMISSION_MODE = process.env.FACTORY_PERMISSION_MODE ?? "acceptEdits";
const ALLOWED_TOOLS = ["Bash(git:*)", "Bash(gh:*)", "Bash(node scripts/board.mjs:*)", "Bash(node scripts/spec-index.mjs:*)", "Bash(dotnet:*)", "Read", "Write", "Edit", "Glob", "Grep", "Agent", "Skill"];

mkdirSync(RUNS_DIR, { recursive: true });

// Started from the Claude desktop app (or a Claude Code session), this server
// inherits that session's variables. Passed on, they make `claude` act as the
// app's child: it waits for the app to refresh its login, which never happens
// headless, and fails with "OAuth session expired". Runs get your own CLI login
// instead. CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) is kept.
const HOST_VARS = /^(CLAUDECODE|CLAUDE_CODE_(?!OAUTH_TOKEN$)|CLAUDE_AGENT_SDK_|CLAUDE_PID$|CLAUDE_EFFORT$|CLAUDE_PREVIEW_|MCP_CONNECTION_|MCP_SERVER_CONNECTION_|ANTHROPIC_BASE_URL$)/;
const claudeEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !HOST_VARS.test(k)));

// Whether the CLI is signed in, re-checked at most once a minute.
let auth = { at: 0 };
async function claudeAuth(fresh) {
  if (!fresh && Date.now() - auth.at < 60_000) return auth;
  // `claude auth status` exits non-zero when signed out; its JSON is on stdout either way.
  const out = await new Promise(ok => execFile("claude", ["auth", "status"], { cwd: ROOT, env: claudeEnv, shell: process.platform === "win32", windowsHide: true }, (err, stdout) => ok(stdout || err?.message || "")));
  try {
    const s = JSON.parse(out);
    auth = { at: Date.now(), loggedIn: !!s.loggedIn || !!claudeEnv.CLAUDE_CODE_OAUTH_TOKEN, method: s.authMethod, email: s.email ?? s.account?.email ?? null };
  } catch {
    auth = { at: Date.now(), loggedIn: !!claudeEnv.CLAUDE_CODE_OAUTH_TOKEN, error: String(out).trim().split("\n")[0] || "claude not found on the PATH" };
  }
  return auth;
}
const SIGN_IN = "The claude CLI isn't signed in. Run `claude auth login` in a terminal, then try again.";

/* ---------- GitHub ---------- */

function run(cmd, args, opts = {}) {
  return new Promise((ok, fail) =>
    execFile(cmd, args, { cwd: ROOT, maxBuffer: 64 << 20, windowsHide: true, ...opts }, (err, stdout, stderr) =>
      err ? fail(new Error((stderr || stdout || err.message).trim().split("\n")[0])) : ok(stdout)));
}
const ghJson = async (...args) => JSON.parse(await run("gh", args));

// One query, about 2 points: the board, recent PRs, labels and what waits on a human.
const QUERY = `query($login: String!, $number: Int!, $owner: String!, $name: String!, $after: String) {
  repositoryOwner(login: $login) { ... on ProjectV2Owner { projectV2(number: $number) { title url
    items(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes {
      status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      content { ... on Issue { number title url state createdAt updatedAt closedAt labels(first: 20) { nodes { name } }
        parent { number } subIssuesSummary { total completed } } }
    } } } } }
  repository(owner: $owner, name: $name) {
    pullRequests(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) { nodes {
      number title url state isDraft headRefName body createdAt updatedAt mergedAt reviewDecision
      labels(first: 20) { nodes { name } }
      closingIssuesReferences(first: 10) { nodes { number } }
      commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
    } }
    needsHuman: issues(states: OPEN, labels: ["needs-human"], first: 50) { nodes { number } }
    cases: issues(states: [OPEN, CLOSED], labels: ["type:case"], first: 50) { nodes { number title url state createdAt updatedAt closedAt labels(first: 20) { nodes { name } } parent { number } subIssuesSummary { total completed } } }
    labels(first: 100) { nodes { name description } }
  }
  viewer { login name }
  rateLimit { remaining resetAt }
}`;

const names = l => l?.nodes?.map(n => n.name) ?? [];

// Which issues a PR is for: "Closes #N", "Spec for #N", or a story/<N>- branch.
function issuesOf(pr) {
  const out = new Set(pr.closingIssuesReferences?.nodes?.map(n => n.number) ?? []);
  for (const m of (pr.body ?? "").matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|spec for|design for|refs?|part of)\s+#(\d+)/gi)) out.add(Number(m[1]));
  const b = pr.headRefName.match(/^(?:story|design)\/(\d+)-/);
  if (b) out.add(Number(b[1]));
  return [...out];
}

function prKind(pr) {
  const labels = names(pr.labels);
  if (pr.headRefName.startsWith("spec/") || labels.includes("type:spec")) return "spec";
  if (pr.headRefName.startsWith("design/")) return "design";
  if (pr.headRefName.startsWith("story/")) return "build";
  return "other";
}

// Phase names from docs/plan.html ("0 Set up", "1 Design", …), for the portfolio.
function phases() {
  try {
    const html = readFileSync(join(ROOT, "docs/plan.html"), "utf8");
    const out = {};
    for (const part of html.split('class="phase"').slice(1)) {
      const text = part.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const m = text.match(/^\W*(\d)\s+([A-Z][a-z]+(?: [a-z]+)?)\s+(An evening|A weekend|A week|Ongoing|[\d–-]+ \w+(?: of \w+)?|\w+ \w+)\s+([^.]*\.)/);
      if (m) out[m[1]] = { name: m[2], when: m[3], goal: m[4].replace(/&amp;/g, "&") };
    }
    return out;
  } catch { return {}; }
}

async function fetchBoard() {
  const nodes = [];
  let first, after;
  for (let page = 0; page < 10; page++) {
    const vars = ["-f", `login=${cfg.owner}`, "-F", `number=${cfg.project}`, "-f", `owner=${OWNER}`, "-f", `name=${NAME}`];
    if (after) vars.push("-f", `after=${after}`);
    const res = JSON.parse(await run("gh", ["api", "graphql", "-f", `query=${QUERY}`, ...vars]));
    first ??= res;
    const items = res.data.repositoryOwner?.projectV2?.items;
    if (!items) throw new Error(`Project ${cfg.project} of ${cfg.owner} not found`);
    nodes.push(...items.nodes);
    if (!items.pageInfo.hasNextPage) break;
    after = items.pageInfo.endCursor;
  }
  const repo = first.data.repository;
  const prs = repo.pullRequests.nodes.map(pr => ({
    number: pr.number, title: pr.title, url: pr.url, state: pr.state, draft: pr.isDraft, branch: pr.headRefName,
    createdAt: pr.createdAt, updatedAt: pr.updatedAt, mergedAt: pr.mergedAt, review: pr.reviewDecision, kind: prKind(pr), labels: names(pr.labels),
    ci: pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? null, issues: issuesOf(pr), body: (pr.body ?? "").slice(0, 600),
  }));
  const blocked = new Set(repo.needsHuman.nodes.map(n => n.number));
  const toCard = (c, column) => {
    const labels = names(c.labels);
    // The board column GitHub shows, and the one the issue's real state implies.
    const truth = c.state === "CLOSED" ? "Done" : column;
    return {
      number: c.number, title: c.title, url: c.url, state: c.state, createdAt: c.createdAt, updatedAt: c.updatedAt, closedAt: c.closedAt, labels,
      column: truth, boardColumn: column, stale: truth !== column,
      team: labels.find(l => l.startsWith("team:"))?.slice(5) ?? null,
      type: labels.find(l => l.startsWith("type:"))?.slice(5) ?? null,
      phase: labels.find(l => l.startsWith("phase:"))?.slice(6) ?? null,
      parent: c.parent?.number ?? null, subIssues: c.subIssuesSummary ?? null,
      needsHuman: blocked.has(c.number), prs: prs.filter(p => p.issues.includes(c.number)).map(p => p.number),
    };
  };
  const cards = nodes.filter(n => n.content?.number).map(n => toCard(n.content, n.status?.name ?? "Backlog"));
  const onBoard = new Set(cards.map(c => c.number));
  const cases = repo.cases.nodes.filter(c => !onBoard.has(c.number)).map(c => ({ ...toCard(c, c.state === "CLOSED" ? "Done" : "Backlog"), offBoard: true, stale: false }));
  return {
    at: Date.now(), project: { title: first.data.repositoryOwner.projectV2.title, url: cfg.url }, repo: cfg.repo,
    viewer: first.data.viewer, columns: COLUMNS, cards: [...cards, ...cases], prs, rate: first.data.rateLimit,
    labels: repo.labels.nodes, phases: phases(),
  };
}

/* ---------- GitHub cache ---------- */

// GitHub gives 5,000 GraphQL points an hour, shared with every `gh` call the
// agent runs make. So the board is read only when something changed. A
// conditional call to the repo's events feed tells: a 304 costs nothing. A card
// moved on github.com makes no event, so the board is also read every 10
// minutes. Runs and buttons on this page mark it dirty right away. Everything
// is kept on disk, so a restart paints from the last read.
const CACHE_FILE = join(RUNS_DIR, "github-cache.json");
const BOARD_MAX_AGE = 10 * 60e3, CHECK_EVERY = 60e3, MIN_GAP = 10e3, LOW_GAP = 5 * 60e3, LOW_POINTS = 500;
let store = { board: null, etag: null, details: {} };
try { store = { ...store, ...JSON.parse(readFileSync(CACHE_FILE, "utf8")) }; } catch {}
let dirty = !store.board, checkedAt = 0, pausedUntil = 0, lastError = null, reading, saving;
const persist = () => { clearTimeout(saving); saving = setTimeout(() => writeFileSync(CACHE_FILE, JSON.stringify(store)), 500); };
const isRateLimit = e => /rate limit/i.test(e?.message ?? "");

// Whether anything happened in the repository since the last check.
async function repoChanged() {
  if (Date.now() - checkedAt < CHECK_EVERY) return false;
  checkedAt = Date.now();
  const etagArgs = store.etag ? ["-H", `If-None-Match: ${store.etag}`] : [];
  // gh exits non-zero on a 304; the headers are on stdout either way.
  const out = await new Promise(ok => execFile("gh", ["api", "-i", ...etagArgs, `repos/${cfg.repo}/events?per_page=1`], { cwd: ROOT, windowsHide: true }, (err, stdout) => ok(stdout || "")));
  if (/^HTTP\/\S+ 304/m.test(out)) return false;
  const etag = out.match(/^etag:\s*(.+)$/im)?.[1]?.trim();
  if (!etag || etag === store.etag) return false;
  store.etag = etag;
  persist();
  return true;
}

// When the GraphQL budget comes back. This query is answered even at zero.
async function graphqlReset() {
  try { return Date.parse(JSON.parse(await run("gh", ["api", "graphql", "-f", "query={ rateLimit { resetAt } }"])).data.rateLimit.resetAt); }
  catch { return Date.now() + 5 * 60e3; }
}

const withState = b => b && { ...b, pausedUntil: pausedUntil > Date.now() ? pausedUntil : null, error: lastError };

// `fresh` comes from this page after a run or a button; it still waits MIN_GAP
// so several open tabs don't each read the board.
async function board(fresh) {
  const b = store.board, now = Date.now();
  if (now < pausedUntil) { if (b) return withState(b); throw new Error(lastError); }
  const gap = (b?.rate?.remaining ?? LOW_POINTS) < LOW_POINTS ? LOW_GAP : MIN_GAP;
  const due = !b || ((fresh || dirty || now - b.at > BOARD_MAX_AGE || await repoChanged()) && now - b.at > gap);
  if (!due) return withState(b);
  reading ??= fetchBoard()
    .then(nb => { store.board = nb; dirty = false; lastError = null; persist(); })
    .catch(async e => {
      lastError = e.message;
      if (isRateLimit(e)) pausedUntil = await graphqlReset();
      else pausedUntil = Date.now() + 60e3;
    })
    .finally(() => { reading = undefined; });
  await reading;
  if (!store.board) throw new Error(lastError);
  return withState(store.board);
}

// Issue, PR and spec reads, kept until the thing they show changes: an issue or
// PR until its updatedAt on the board moves, a spec until its branch does.
async function detail(key, stamp, read) {
  const hit = store.details[key];
  if (hit && (stamp ? hit.stamp === stamp : Date.now() - hit.at < 5 * 60e3)) return hit.value;
  if (hit && Date.now() < pausedUntil) return hit.value;
  try {
    const value = await read();
    store.details[key] = { stamp, at: Date.now(), value };
    const keys = Object.keys(store.details);
    if (keys.length > 200) for (const k of keys.sort((a, b) => store.details[a].at - store.details[b].at).slice(0, keys.length - 200)) delete store.details[k];
    persist();
    return value;
  } catch (e) {
    if (isRateLimit(e)) pausedUntil = await graphqlReset();
    if (hit) return hit.value;
    throw e;
  }
}
const cardStamp = n => store.board?.cards.find(c => c.number === n)?.updatedAt;
const prStamp = n => store.board?.prs.find(p => p.number === n)?.updatedAt;
const branchStamp = ref => ref ? store.board?.prs.find(p => p.branch === ref)?.updatedAt : store.etag;

// Details go through REST, which has its own hourly budget; GraphQL is left for the board.
const issueDetail = n => detail(`issue:${n}`, cardStamp(n), async () => {
  const [i, comments] = await Promise.all([
    ghJson("api", `repos/${cfg.repo}/issues/${n}`),
    ghJson("api", `repos/${cfg.repo}/issues/${n}/comments?per_page=100`),
  ]);
  return {
    number: i.number, title: i.title, body: i.body ?? "", state: i.state.toUpperCase(), url: i.html_url, createdAt: i.created_at,
    author: { login: i.user?.login }, labels: i.labels.map(l => ({ name: l.name })),
    comments: comments.slice(-12).map(c => ({ author: c.user?.login, at: c.created_at, body: c.body })),
  };
});

// A spec file by id (API-005) at a ref: the PR branch while in review, main once merged.
const spec = (id, ref) => detail(`spec:${id}@${ref || "main"}`, branchStamp(ref), () => readSpec(id, ref));
async function readSpec(id, ref) {
  const at = encodeURIComponent(ref || "HEAD");
  const tree = await ghJson("api", `repos/${cfg.repo}/git/trees/${at}?recursive=1`);
  const file = tree.tree.find(f => f.type === "blob" && f.path.startsWith("specs/") && f.path.split("/").pop().toUpperCase().startsWith(id.toUpperCase()));
  if (!file) return { id, ref, missing: true };
  const text = await run("gh", ["api", "-H", "Accept: application/vnd.github.raw", `repos/${cfg.repo}/contents/${file.path}?ref=${at}`]);
  return { id, ref, path: file.path, url: `https://github.com/${cfg.repo}/blob/${ref || "main"}/${file.path}`, text };
}

const prFiles = n => detail(`pr:${n}`, prStamp(n), () => readPrFiles(n));
async function readPrFiles(n) {
  const [pr, files, comments] = await Promise.all([
    ghJson("api", `repos/${cfg.repo}/pulls/${n}`).then(p => ({ number: p.number, title: p.title, url: p.html_url, state: p.merged_at ? "MERGED" : p.state.toUpperCase(), isDraft: p.draft, headRefName: p.head.ref, headRefOid: p.head.sha, body: p.body ?? "", additions: p.additions, deletions: p.deletions })),
    ghJson("api", `repos/${cfg.repo}/pulls/${n}/files?per_page=100`),
    ghJson("api", `repos/${cfg.repo}/pulls/${n}/comments?per_page=100`),
  ]);
  return {
    pr,
    files: files.map(f => ({ path: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch ?? null })),
    comments: comments.map(c => ({ id: c.id, path: c.path, line: c.line ?? c.original_line, body: c.body, author: c.user?.login, at: c.created_at, outdated: c.line == null })),
  };
}

// The roster: each agent's frontmatter from .claude/agents.
function agents() {
  const out = [];
  for (const f of readdirSync(join(ROOT, ".claude/agents")).filter(f => f.endsWith(".md"))) {
    const text = readFileSync(join(ROOT, ".claude/agents", f), "utf8");
    const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const get = k => fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1]?.trim();
    out.push({ name: get("name") ?? f.slice(0, -3), description: get("description") ?? "", model: get("model") ?? "", tools: get("tools") ?? "" });
  }
  return out;
}

/* ---------- log ---------- */

const log = [];
try { for (const l of readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean).slice(-300)) log.push(JSON.parse(l)); } catch {}
function addLog(e) {
  e = { at: Date.now(), ...e };
  log.push(e);
  if (log.length > 300) log.shift();
  appendFileSync(LOG_FILE, JSON.stringify(e) + "\n");
}

/* ---------- Claude runs ---------- */

const runs = new Map();
for (const f of readdirSync(RUNS_DIR).filter(f => f.endsWith(".json"))) {
  try {
    const r = JSON.parse(readFileSync(join(RUNS_DIR, f), "utf8"));
    // Nothing starts by itself when the server restarts.
    if (r.status === "queued") r.status = "stopped";
    if (r.status === "running") { r.status = "interrupted"; for (const a of r.agents ?? []) if (!a.endedAt) a.endedAt = r.endedAt ?? Date.now(); }
    runs.set(r.id, r);
  } catch {}
}
const procs = new Map();
const save = r => writeFileSync(join(RUNS_DIR, `${r.id}.json`), JSON.stringify(r));
const brief = (s, n = 400) => { s = String(s ?? "").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
const firstIssue = s => Number(String(s ?? "").match(/(?:story|issue|PR|#)\s*#?(\d+)/i)?.[1]) || null;
const textOf = c => typeof c === "string" ? c : Array.isArray(c) ? c.map(x => x.text ?? "").join("\n") : "";

// Folds one stream-json event into the run: log rows, and the subagents it starts and ends.
function fold(r, ev) {
  const rows = [];
  const who = ev.parent_tool_use_id ? "sub" : "main";
  if (ev.type === "system" && ev.subtype === "init") rows.push({ kind: "info", text: `Session ${ev.session_id} · ${ev.model ?? ""}` });
  if (ev.type === "assistant") for (const b of ev.message?.content ?? []) {
    if (b.type === "text" && b.text.trim()) rows.push({ kind: "text", who, text: b.text.trim() });
    if (b.type !== "tool_use") continue;
    const i = b.input ?? {};
    if (b.name === "Agent" || b.name === "Task") {
      const agent = String(i.subagent_type ?? "general-purpose").split(":").pop();
      // A "run until my turn" run learns its first story from the first subagent it starts.
      r.issue ??= firstIssue(i.description) ?? firstIssue(i.prompt);
      // A run keeps going story after story; `current` is the one it's on now.
      r.current = firstIssue(i.description) ?? firstIssue(i.prompt) ?? r.current ?? r.issue;
      r.agents.push({ id: b.id, agent, text: i.description ?? brief(i.prompt, 120), issue: r.current, startedAt: Date.now() });
      rows.push({ kind: "agent", who, agent, text: i.description ?? brief(i.prompt, 120) });
      addLog({ who: agent, issue: r.issue, run: r.id, msg: `${agent} started: ${i.description ?? brief(i.prompt, 80)}` });
    } else rows.push({ kind: "tool", who, text: `${b.name} ${brief(i.command ?? i.file_path ?? i.pattern ?? i.skill ?? i.url ?? "", 160)}` });
  }
  if (ev.type === "user") for (const b of ev.message?.content ?? []) {
    const a = b.type === "tool_result" && r.agents.find(a => a.id === b.tool_use_id && !a.endedAt);
    if (!a) continue;
    a.endedAt = Date.now();
    a.result = brief(textOf(b.content), 1500);
    a.failed = !!b.is_error;
    addLog({ who: a.agent, issue: a.issue, run: r.id, msg: `${a.agent} ${a.failed ? "failed" : "finished"}: ${brief(a.text, 80)}` });
  }
  if (ev.type === "result") rows.push({ kind: ev.is_error ? "error" : "result", text: brief(ev.result, 4000) });
  return rows;
}

// Every story run keeps going until everything waits on you (run-story's *Keep going*).
const KEEP_GOING = "\n\nWhen a story stops at a human gate, keep going with the next story that can move, until everything waits on me. End with what waits on me.";
// One story at a time, as run-story asks: a second story run waits its turn.
const storyBusy = () => [...runs.values()].some(r => r.status === "running" && r.kind === "story");
function startOrQueue(p) {
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 6);
  const r = { id, label: p.label, prompt: p.kind === "story" ? p.prompt + KEEP_GOING : p.prompt, issue: p.issue ?? null, pr: p.pr ?? null, team: p.team ?? null, kind: p.kind ?? "ask", status: "queued", queuedAt: Date.now(), startedAt: Date.now(), rows: [], agents: [] };
  runs.set(id, r);
  if (r.kind === "story" && storyBusy()) {
    addLog({ who: "you", issue: r.issue, run: id, msg: `Queued for the manager: ${r.label}` });
    save(r);
  } else startRun(r);
  return id;
}
function nextQueued() {
  if (storyBusy()) return;
  const q = [...runs.values()].filter(r => r.status === "queued").sort((a, b) => a.queuedAt - b.queuedAt)[0];
  if (q) startRun(q);
}

function startRun(r) {
  const { id, label, prompt } = r;
  r.status = "running";
  r.startedAt = Date.now();
  addLog({ who: "you", issue: r.issue, run: id, msg: `Started the manager: ${label}` });
  const args = ["-p", "--agent", "manager", "--output-format", "stream-json", "--verbose", "--permission-mode", PERMISSION_MODE, "--allowedTools", ...ALLOWED_TOOLS, "--name", `Dashboard: ${label}`];
  // Windows runs claude through claude.cmd, which needs a shell; the prompt goes
  // over stdin so no user text is ever parsed by it.
  const win = process.platform === "win32";
  const child = spawn("claude", win ? args.map(a => `"${a}"`) : args, { cwd: ROOT, shell: win, windowsHide: true, env: claudeEnv });
  procs.set(id, child);
  child.stdin.end(prompt);
  let buf = "";
  child.stdout.on("data", chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      appendFileSync(join(RUNS_DIR, `${id}.jsonl`), line + "\n");
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.session_id) r.sessionId = ev.session_id;
      if (ev.type === "result") { r.cost = ev.total_cost_usd; r.turns = ev.num_turns; r.result = brief(ev.result, 4000); r.isError = !!ev.is_error; }
      for (const row of fold(r, ev)) { row.at = Date.now(); r.rows.push(row); }
    }
  });
  let err = "";
  child.stderr.on("data", c => { err += c; });
  child.on("close", code => {
    procs.delete(id);
    r.endedAt = Date.now();
    for (const a of r.agents) if (!a.endedAt) a.endedAt = r.endedAt;
    if (r.status === "running") r.status = code === 0 && !r.isError ? "done" : "failed";
    // A login problem: say how to fix it, and check the login again next time.
    if (/authenticat|oauth|log ?in|401/i.test(r.result ?? "")) { r.result = `${SIGN_IN}\n\n${r.result}`; auth.at = 0; }
    if (code !== 0 && err.trim()) r.rows.push({ kind: "error", at: Date.now(), text: brief(err, 2000) });
    addLog({ who: "manager", issue: r.issue, run: id, msg: `${r.label}: ${r.status}${r.result ? " · " + brief(r.result, 140) : ""}` });
    dirty = true;
    save(r);
    nextQueued();
  });
  save(r);
  return r;
}

function stopRun(id) {
  const child = procs.get(id), r = runs.get(id);
  if (r?.status === "queued") { r.status = "stopped"; r.endedAt = Date.now(); save(r); return true; }
  if (!child || !r) return false;
  r.status = "stopped";
  if (process.platform === "win32") execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
  else child.kill("SIGTERM");
  return true;
}

const listRuns = () => [...runs.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 60)
  .map(({ rows, ...r }) => ({ ...r, last: rows.filter(x => x.kind === "text" || x.kind === "agent" || x.kind === "result").at(-1)?.text ?? "", tail: rows.slice(-30) }));

/* ---------- actions ---------- */

// Prompts for the manager. Each names the skill it follows, as the factory expects.
const PROMPTS = {
  "run-next": () => ({ label: "Run until my turn", kind: "story", prompt: "Use the run-story skill to run the stories on the board." }),
  "run-story": b => ({ label: `Run story #${b.issue}`, kind: "story", issue: b.issue, prompt: `Use the run-story skill to run story #${b.issue}.` }),
  "send-back": b => ({ label: `Send back PR #${b.pr}`, kind: "story", issue: b.issue, pr: b.pr, prompt: `Use the run-story skill to send PR #${b.pr} back to its team with my review comments.${b.note ? `\n\nAlso from me: ${b.note}` : ""}` }),
  "refine": b => ({ label: `Refine #${b.issue}`, kind: "ask", issue: b.issue, prompt: `Start the pm agent to refine issue #${b.issue} into acceptance criteria and a task list, following the write-story skill. Don't move it out of its column.` }),
  "breakdown": b => ({ label: `Break down #${b.issue}`, kind: "ask", issue: b.issue, prompt: `Start the pm agent to break issue #${b.issue} into ${b.child === "feature" ? "features" : "stories"}, following the write-story skill. Create each as an issue with the right type: and team: labels, add it as a sub-issue of #${b.issue} (gh api repos/${cfg.repo}/issues/${b.issue}/sub_issues -F sub_issue_id=<id>), and put it on the board in Backlog.` }),
  "standup": b => ({ label: `Stand-up: ${b.team}`, kind: "standup", team: b.team, prompt: `Write a short stand-up for team:${b.team}. Read the board (node scripts/board.mjs list) and the team's open issues and PRs; change nothing. Reply in Markdown under 170 words with these bold labels: **Moving**, **Stuck or at risk**, **Needs you**, **Next**. Name issue numbers.` }),
  "ask": b => ({ label: brief(b.text, 60), kind: "ask", issue: b.issue ?? null, prompt: b.text }),
};

async function ensureLabel(name) {
  const b = await board();
  if (b.labels.some(l => l.name === name)) return;
  await run("gh", ["label", "create", name, "--repo", cfg.repo]).catch(() => {});
}

async function createItem(b) {
  const labels = [`type:${b.kind}`, b.team && `team:${b.team}`, b.phase && `phase:${b.phase}`].filter(Boolean);
  for (const l of labels) await ensureLabel(l);
  const url = (await run("gh", ["issue", "create", "--repo", cfg.repo, "--title", b.title, "--body", b.body || " ", ...labels.flatMap(l => ["--label", l])])).trim();
  const n = Number(url.split("/").pop());
  if (b.parent) {
    const id = (await run("gh", ["api", `repos/${cfg.repo}/issues/${n}`, "--jq", ".id"])).trim();
    await run("gh", ["api", "-X", "POST", `repos/${cfg.repo}/issues/${b.parent}/sub_issues`, "-F", `sub_issue_id=${id}`]);
  }
  await run("node", ["scripts/board.mjs", "move", String(n), "Backlog"]);
  addLog({ who: "you", issue: n, msg: `Created ${b.kind} #${n}: ${b.title}` });
  return n;
}

const NEEDS_CLAUDE = new Set(["feedback", "run-next", "run-story", "send-back", "refine", "breakdown", "standup", "ask"]);

async function act(b) {
  let out = { ok: true };
  // Refuse before posting anything to GitHub, so feedback isn't half sent.
  if ((NEEDS_CLAUDE.has(b.action) || b.then) && !(await claudeAuth(true)).loggedIn) throw new Error(SIGN_IN);
  switch (b.action) {
    case "move":
      await run("node", ["scripts/board.mjs", "move", String(b.issue), b.column]);
      addLog({ who: "you", issue: b.issue, msg: `Moved #${b.issue} to ${b.column}` });
      break;
    case "sync": await run("node", ["scripts/board.mjs", "sync"]); addLog({ who: "you", msg: "Synced the board with GitHub" }); break;
    case "approve-case":
      await ensureLabel("approved");
      await run("gh", ["issue", "edit", String(b.issue), "--repo", cfg.repo, "--add-label", "approved"]);
      addLog({ who: "you", issue: b.issue, msg: `Approved case #${b.issue}` });
      break;
    case "merge":
      // A human pressed Merge; squash as CLAUDE.md asks, then catch the board up.
      await run("gh", ["pr", "merge", String(b.pr), "--repo", cfg.repo, "--squash", "--delete-branch"]);
      await run("node", ["scripts/board.mjs", "sync"]);
      addLog({ who: "you", issue: b.issue ?? null, msg: `Merged PR #${b.pr}` });
      break;
    case "pr-comment": {
      const sha = (await run("gh", ["api", `repos/${cfg.repo}/pulls/${b.pr}`, "--jq", ".head.sha"])).trim();
      await run("gh", ["api", "-X", "POST", `repos/${cfg.repo}/pulls/${b.pr}/comments`, "-f", `body=${b.body}`, "-f", `commit_id=${sha}`, "-f", `path=${b.path}`, "-F", `line=${b.line}`, "-f", "side=RIGHT"]);
      addLog({ who: "you", issue: b.issue ?? null, msg: `Commented on PR #${b.pr} ${b.path}:${b.line}` });
      break;
    }
    case "create": out = { issue: await createItem(b) }; break;
    case "feedback": {
      // Your words go on GitHub first (the PR when there is one, else the
      // issue), so the record lives there; then the manager acts on them.
      if (b.pr) await run("gh", ["pr", "review", String(b.pr), "--repo", cfg.repo, "--comment", "--body", b.text]);
      else await run("gh", ["issue", "comment", String(b.issue), "--repo", cfg.repo, "--body", b.text]);
      addLog({ who: "you", issue: b.issue ?? null, msg: `Feedback on ${b.pr ? `PR #${b.pr}` : `#${b.issue}`}: ${brief(b.text, 100)}` });
      const p = b.pr
        ? PROMPTS["send-back"]({ pr: b.pr, issue: b.issue })
        : { label: `Feedback on #${b.issue}`, kind: "story", issue: b.issue, prompt: `I just commented on issue #${b.issue}:\n\n${b.text}\n\nAct on it. If #${b.issue} is a story or task, use the run-story skill to continue it with my comment. If it's a case, epic or feature, do what I ask with the right skill (business-case or write-story).` };
      return { run: startOrQueue(p) };
    }
    case "approve": {
      // Approve a gate: merge the PR (or label the case), then let the factory go on.
      if (b.text) await run("gh", [b.pr ? "pr" : "issue", "comment", String(b.pr ?? b.issue), "--repo", cfg.repo, "--body", b.text]);
      if (b.pr) {
        await run("gh", ["pr", "merge", String(b.pr), "--repo", cfg.repo, "--squash", "--delete-branch"]);
        await run("node", ["scripts/board.mjs", "sync"]);
        addLog({ who: "you", issue: b.issue ?? null, msg: `Approved and merged PR #${b.pr}` });
      } else {
        await ensureLabel("approved");
        await run("gh", ["issue", "edit", String(b.issue), "--repo", cfg.repo, "--add-label", "approved"]);
        addLog({ who: "you", issue: b.issue, msg: `Approved case #${b.issue}` });
      }
      dirty = true;
      // A merged build PR closes its story: nothing left to run.
      if (b.then === "story") return { run: startOrQueue(PROMPTS["run-story"]({ issue: b.issue })) };
      if (b.then === "case") return { run: startOrQueue({ label: `Stories for case #${b.issue}`, kind: "ask", issue: b.issue, prompt: `I approved case #${b.issue}. Start pm to write its stories with the write-story skill, as sub-issues of #${b.issue}, and put them on the board in Backlog.` }) };
      return { ok: true };
    }
    default: {
      const p = PROMPTS[b.action]?.(b);
      if (!p) throw new Error(`Unknown action ${b.action}`);
      return { run: startOrQueue(p) };
    }
  }
  dirty = true;
  return out;
}

/* ---------- http ---------- */

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};
const readBody = req => new Promise(ok => { let s = ""; req.on("data", c => (s += c)); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } }); });

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  try {
    // Only this page may call the API: no other site can start runs or merges.
    if (req.method === "POST" && req.headers.origin && req.headers.origin !== `http://localhost:${PORT}` && req.headers.origin !== `http://127.0.0.1:${PORT}`)
      return send(res, 403, { error: "Wrong origin" });
    if (p === "/" || p === "/index.html") return send(res, 200, readFileSync(join(HERE, "index.html")), "text/html; charset=utf-8");
    if (p === "/api/board") return send(res, 200, await board(url.searchParams.has("fresh")));
    if (p === "/api/agents") return send(res, 200, { agents: agents(), permissionMode: PERMISSION_MODE, allowedTools: ALLOWED_TOOLS });
    if (p === "/api/claude") return send(res, 200, await claudeAuth(url.searchParams.has("fresh")));
    if (p === "/api/log") return send(res, 200, log.slice(-150).reverse());
    if (p.startsWith("/api/issue/")) return send(res, 200, await issueDetail(Number(p.split("/").pop())));
    if (p === "/api/spec") return send(res, 200, await spec(url.searchParams.get("id"), url.searchParams.get("ref")));
    if (p.match(/^\/api\/pr\/\d+$/)) return send(res, 200, await prFiles(Number(p.split("/").pop())));
    if (p === "/api/runs") return send(res, 200, listRuns());
    if (p.startsWith("/api/runs/") && req.method === "GET") {
      const r = runs.get(p.split("/").pop());
      return r ? send(res, 200, r) : send(res, 404, { error: "No such run" });
    }
    if (p.startsWith("/api/runs/") && p.endsWith("/stop") && req.method === "POST") return send(res, 200, { ok: stopRun(p.split("/")[3]) });
    if (p === "/api/action" && req.method === "POST") return send(res, 200, await act(await readBody(req)));
    send(res, 404, { error: "Not found" });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Factory dashboard on http://localhost:${PORT}  (repo ${cfg.repo}, board ${cfg.url})`));
