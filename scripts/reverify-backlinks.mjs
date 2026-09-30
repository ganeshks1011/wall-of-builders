// Re-checks every project's backlink and records whether each tile is
// locked. A live backlink locks the tile so it can't be claimed by anyone
// else; a missing or dead backlink leaves it unlocked. Tiles are never
// delisted for backlink reasons. Runs on a weekly schedule; the workflow
// commits the updated data file when anything changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { fetchHtml, findBacklink, isHiddenOrNofollow, isValidUrl } from './backlink-check.mjs';

const DATA_PATH = 'data/projects.json';

async function backlinkIsLive(entry) {
  if (!isValidUrl(entry.backlinkUrl)) return false;
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
  let changed = 0;
  let lockedCount = 0;
  for (const entry of projects) {
    const locked = await backlinkIsLive(entry);
    if (entry.locked !== locked) {
      entry.locked = locked;
      changed++;
    }
    if (locked) lockedCount++;
  }
  if (changed > 0) {
    writeFileSync(DATA_PATH, `${JSON.stringify(projects, null, 2)}\n`);
  }
  console.log(
    `Checked ${projects.length} project(s): ${lockedCount} locked, ` +
    `${projects.length - lockedCount} unlocked, ${changed} updated.`
  );
}

main();
