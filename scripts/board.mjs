#!/usr/bin/env node
// Reads and moves issues on the GitHub project board named in .github/factory.json.
//
//   node scripts/board.mjs list [Column]
//   node scripts/board.mjs move <issue> "<Column>"
//
// Needs the gh CLI with the "project" scope: gh auth refresh -s project

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(".github/factory.json", "utf8"));
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 << 20 });
const ghJson = (...args) => JSON.parse(gh(...args, "--format", "json"));
const proj = ["--owner", cfg.owner];

function items() {
  return ghJson("project", "item-list", String(cfg.project), ...proj, "--limit", "1000").items;
}

function statusField() {
  const field = ghJson("project", "field-list", String(cfg.project), ...proj).fields.find(f => f.name === "Status");
  if (!field) throw new Error("The board has no Status field");
  return field;
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
  const col = colWords.join(" ");
  const field = statusField();
  const option = field.options.find(o => o.name.toLowerCase() === col.toLowerCase());
  if (!option) throw new Error(`No column "${col}". Columns: ${field.options.map(o => o.name).join(", ")}`);
  const url = `https://github.com/${cfg.repo}/issues/${issue}`;
  let item = items().find(i => i.content?.url === url);
  if (!item) item = ghJson("project", "item-add", String(cfg.project), ...proj, "--url", url);
  const projectId = ghJson("project", "view", String(cfg.project), ...proj).id;
  gh("project", "item-edit", "--id", item.id, "--project-id", projectId, "--field-id", field.id, "--single-select-option-id", option.id);
  console.log(`#${issue} → ${option.name}`);
} else {
  console.log('Usage: node scripts/board.mjs list [Column] | move <issue> "<Column>"');
  process.exit(cmd ? 1 : 0);
}
