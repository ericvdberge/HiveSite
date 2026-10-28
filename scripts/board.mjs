#!/usr/bin/env node
// Reads and moves issues on the GitHub project board named in .github/factory.json.
//
//   node scripts/board.mjs list [Column]
//   node scripts/board.mjs move <issue> "<Column>"
//   node scripts/board.mjs sync
//
// sync catches the board up with GitHub: closed issues go to Done, and open
// issues with an open spec PR go to Spec review if they sit before it.
//
// Needs the gh CLI with the "project" scope: gh auth refresh -s project

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(".github/factory.json", "utf8"));
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 << 20 });
const ghJson = (...args) => JSON.parse(gh(...args, "--format", "json"));
const proj = ["--owner", cfg.owner];
const COLUMNS = ["Backlog", "Ready", "Spec review", "Building", "Agent review", "Ready to merge", "Done"];

function items() {
  return ghJson("project", "item-list", String(cfg.project), ...proj, "--limit", "1000").items;
}

function statusField() {
  const field = ghJson("project", "field-list", String(cfg.project), ...proj).fields.find(f => f.name === "Status");
  if (!field) throw new Error("The board has no Status field");
  return field;
}

// Loads what a move needs once, so sync can move many issues without refetching.
function board() {
  return { items: items(), field: statusField(), projectId: ghJson("project", "view", String(cfg.project), ...proj).id };
}

function move(b, issue, col) {
  const option = b.field.options.find(o => o.name.toLowerCase() === col.toLowerCase());
  if (!option) throw new Error(`No column "${col}". Columns: ${b.field.options.map(o => o.name).join(", ")}`);
  const url = `https://github.com/${cfg.repo}/issues/${issue}`;
  let item = b.items.find(i => i.content?.url === url);
  if (!item) item = ghJson("project", "item-add", String(cfg.project), ...proj, "--url", url);
  gh("project", "item-edit", "--id", item.id, "--project-id", b.projectId, "--field-id", b.field.id, "--single-select-option-id", option.id);
  console.log(`#${issue} → ${option.name}`);
}

function sync() {
  const b = board();
  const issues = JSON.parse(gh("issue", "list", "--repo", cfg.repo, "--state", "all", "--limit", "1000", "--json", "number,state"));
  const prs = JSON.parse(gh("pr", "list", "--repo", cfg.repo, "--state", "open", "--limit", "200", "--json", "number,headRefName,body"));
  const column = n => b.items.find(i => i.content?.number === n && i.content?.url?.includes(`/${cfg.repo}/issues/`))?.status;

  // Issues an open spec PR is for: "Closes #N", "Spec for #N".
  const inSpecReview = new Set();
  for (const pr of prs.filter(p => p.headRefName.startsWith("spec/"))) {
    for (const m of (pr.body ?? "").matchAll(/(?:closes|fixes|resolves|spec for)\s+#(\d+)/gi)) inSpecReview.add(Number(m[1]));
  }

  let moved = 0;
  for (const { number, state } of issues) {
    const now = column(number);
    if (now === undefined) continue; // not on the board
    if (state === "CLOSED" && now !== "Done") { move(b, number, "Done"); moved++; }
    else if (state === "OPEN" && inSpecReview.has(number) && COLUMNS.indexOf(now ?? "Backlog") < COLUMNS.indexOf("Spec review")) {
      move(b, number, "Spec review"); moved++;
    }
  }
  if (!moved) console.log("The board is up to date.");
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "list") {
  const col = rest.join(" ");
  const rows = items().filter(i => !col || i.status === col);
  for (const i of rows) {
    const c = i.content ?? {};
    console.log(`${(i.status ?? "—").padEnd(15)} #${String(c.number ?? "").padEnd(4)} ${c.title ?? i.title}  ${(i.labels ?? []).join(",")}`);
  }
  if (!rows.length) console.log(col ? `Nothing in ${col}.` : "The board is empty.");
} else if (cmd === "move" && rest.length >= 2) {
  const [issue, ...colWords] = rest;
  move(board(), issue, colWords.join(" "));
} else if (cmd === "sync") {
  sync();
} else {
  console.log('Usage: node scripts/board.mjs list [Column] | move <issue> "<Column>" | sync');
  process.exit(cmd ? 1 : 0);
}
