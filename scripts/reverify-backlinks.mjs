// Re-checks every project's backlink and drops entries whose link is
// gone or unreachable. Runs on a weekly schedule; the workflow commits
// the updated data file when anything changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { fetchHtml, findBacklink, isHiddenOrNofollow } from './backlink-check.mjs';

const DATA_PATH = 'data/projects.json';

async function backlinkIsLive(entry) {
  let html;
  try {
    html = await fetchHtml(entry.backlinkUrl);
  } catch {
    return false;
  }
  const backlink = findBacklink(html);
  return backlink !== null && !isHiddenOrNofollow(backlink.tag);
}

async function main() {
  const projects = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const survivors = [];
  const removed = [];
  for (const entry of projects) {
    if (await backlinkIsLive(entry)) {
      survivors.push(entry);
    } else {
      removed.push(entry.name);
    }
  }
  if (removed.length > 0) {
    writeFileSync(DATA_PATH, `${JSON.stringify(survivors, null, 2)}\n`);
  }
  console.log(`Checked ${projects.length} project(s), delisted ${removed.length}.`);
  for (const name of removed) {
    console.log(`- ${name}`);
  }
}

main();
