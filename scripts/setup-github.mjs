#!/usr/bin/env node
// One-time GitHub setup for the agent factory: labels, the project board and its columns.
// Safe to run again: labels are updated in place and an existing board is reused.
//
//   node scripts/setup-github.mjs <owner/repo> ["Board title"]
//
// Needs the gh CLI with the "project" scope: gh auth refresh -s project

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [repo, title = "Hivesite"] = process.argv.slice(2);
if (!repo?.includes("/")) {
  console.log('Usage: node scripts/setup-github.mjs <owner/repo> ["Board title"]');
  process.exit(1);
}
const owner = repo.split("/")[0];
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 << 20 });
const ghJson = (...args) => JSON.parse(gh(...args, "--format", "json"));

const COLUMNS = [
  ["Backlog", "GRAY", "Written, not yet picked for work"],
  ["Ready", "BLUE", "A human approved it for the factory"],
  ["Spec review", "PURPLE", "Spec or design PR waits for a human"],
  ["Building", "YELLOW", "A dev agent is building it"],
  ["Agent review", "ORANGE", "Reviewer and tester are checking the PR"],
  ["Ready to merge", "PINK", "PR waits for a human to merge"],
  ["Done", "GREEN", "Merged"],
];
const TEAMS = [
  ["factory", "GRAY"], ["content", "PURPLE"], ["rendering", "GREEN"], ["publishing", "ORANGE"], ["design", "PINK"],
];

// 1. Labels
const labels = JSON.parse(readFileSync(new URL("../.github/labels.json", import.meta.url), "utf8"));
for (const l of labels) {
  gh("label", "create", l.name, "--repo", repo, "--color", l.color, "--description", l.description, "--force");
}
console.log(`labels: ${labels.length} synced`);

// 2. Board: the one in .github/factory.json, else one with this title, else a new one
const known = existsSync(new URL("../.github/factory.json", import.meta.url))
  ? JSON.parse(readFileSync(new URL("../.github/factory.json", import.meta.url), "utf8")).project
  : undefined;
let project = ghJson("project", "list", "--owner", owner).projects.find(p => (known ? p.number === known : p.title === title));
if (!project) project = ghJson("project", "create", "--owner", owner, "--title", title);
gh("project", "link", String(project.number), "--owner", owner, "--repo", repo);
console.log(`board: #${project.number} ${project.url}`);

// 3. Columns (the built-in Status field) and a Team field
const fields = ghJson("project", "field-list", String(project.number), "--owner", owner).fields;
const status = fields.find(f => f.name === "Status");
const opts = COLUMNS.map(([name, color, description]) => `{name:${JSON.stringify(name)},color:${color},description:${JSON.stringify(description)}}`).join(",");
gh("api", "graphql", "-f", `query=mutation{updateProjectV2Field(input:{fieldId:"${status.id}",singleSelectOptions:[${opts}]}){projectV2Field{...on ProjectV2SingleSelectField{name}}}}`);
console.log(`columns: ${COLUMNS.map(c => c[0]).join(" → ")}`);

if (!fields.some(f => f.name === "Team")) {
  gh("project", "field-create", String(project.number), "--owner", owner, "--name", "Team",
    "--data-type", "SINGLE_SELECT", "--single-select-options", TEAMS.map(t => t[0]).join(","));
  console.log("field: Team");
}

// 4. Remember the board for scripts/board.mjs
const cfgPath = new URL("../.github/factory.json", import.meta.url);
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
writeFileSync(cfgPath, JSON.stringify({ ...cfg, owner, repo, project: project.number, url: project.url }, null, 2) + "\n");
console.log("wrote .github/factory.json");
