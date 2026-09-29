// Verifies that projects added in this PR link back to codevu.com.
// Runs in CI on pull requests that touch data/projects.json.
// Exits non-zero with a clear message when any check fails.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DATA_PATH = 'data/projects.json';
const REQUIRED_HOST = 'codevu.com';
const FETCH_TIMEOUT_MS = 15000;
const MAX_NAME_LENGTH = 60;

const failures = [];

function fail(message) {
  failures.push(message);
}

function readProjectsAtRef(ref) {
  try {
    const raw = execSync(`git show ${ref}:${DATA_PATH}`, { encoding: 'utf8' });
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateEntry(entry, index) {
  const label = `entry ${index}`;
  if (typeof entry !== 'object' || entry === null) {
    fail(`${label}: must be an object`);
    return false;
  }
  let ok = true;
  if (typeof entry.name !== 'string' || entry.name.trim() === '') {
    fail(`${label}: "name" is required`);
    ok = false;
  } else if (entry.name.length > MAX_NAME_LENGTH) {
    fail(`${label}: "name" must be ${MAX_NAME_LENGTH} characters or fewer`);
    ok = false;
  }
  if (!isValidUrl(entry.url)) {
    fail(`${label}: "url" must be a valid http(s) URL`);
    ok = false;
  }
  if (!isValidUrl(entry.backlinkUrl)) {
    fail(`${label}: "backlinkUrl" must be a valid http(s) URL`);
    ok = false;
  }
  if (entry.icon !== undefined && !isValidUrl(entry.icon)) {
    fail(`${label}: "icon" must be a valid http(s) URL`);
    ok = false;
  }
  return ok;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'wall-of-builders-backlink-check/1.0' },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function findBacklink(html) {
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let match;
  while ((match = anchorPattern.exec(html)) !== null) {
    const tag = match[0];
    let href;
    try {
      href = new URL(match[1], 'https://placeholder.invalid');
    } catch {
      continue;
    }
    const host = href.hostname.replace(/^www\./, '');
    if (host === REQUIRED_HOST || host.endsWith(`.${REQUIRED_HOST}`)) {
      return { tag };
    }
  }
  return null;
}

function isHiddenOrNofollow(tag) {
  return /rel\s*=\s*["'][^"']*nofollow/i.test(tag) || /style\s*=\s*["'][^"']*display\s*:\s*none/i.test(tag);
}

async function verifyBacklink(entry) {
  let html;
  try {
    html = await fetchHtml(entry.backlinkUrl);
  } catch (error) {
    fail(`"${entry.name}": could not fetch backlinkUrl (${entry.backlinkUrl}): ${error.message}`);
    return;
  }
  const backlink = findBacklink(html);
  if (!backlink) {
    fail(`"${entry.name}": no link to ${REQUIRED_HOST} found in the HTML of ${entry.backlinkUrl}`);
    return;
  }
  if (isHiddenOrNofollow(backlink.tag)) {
    fail(`"${entry.name}": the link to ${REQUIRED_HOST} must be a plain crawlable link (not hidden or nofollow)`);
  }
}

async function main() {
  const baseSha = process.env.BASE_SHA;
  if (!baseSha) {
    fail('BASE_SHA is not set; cannot diff against the base branch');
  }
  const baseProjects = baseSha ? readProjectsAtRef(baseSha) : [];
  const headRaw = readFileSync(DATA_PATH, 'utf8');
  let headProjects;
  try {
    headProjects = JSON.parse(headRaw);
  } catch {
    fail(`${DATA_PATH} is not valid JSON`);
    headProjects = [];
  }
  if (!Array.isArray(headProjects)) {
    fail(`${DATA_PATH} must contain a JSON array`);
    headProjects = [];
  }

  const baseUrls = new Set(baseProjects.map((p) => p && p.url));
  const newEntries = headProjects.filter((p) => p && !baseUrls.has(p.url));

  const seen = new Set(baseUrls);
  headProjects.forEach((entry, index) => {
    if (entry && seen.has(entry.url) && baseUrls.has(entry.url) === false) {
      fail(`entry ${index}: duplicate url "${entry.url}"`);
    }
    seen.add(entry && entry.url);
    validateEntry(entry, index);
  });

  for (const entry of newEntries) {
    if (entry && isValidUrl(entry.backlinkUrl)) {
      await verifyBacklink(entry);
    }
  }

  if (failures.length > 0) {
    console.error('Backlink verification failed:\n');
    for (const message of failures) {
      console.error(`- ${message}`);
    }
    process.exit(1);
  }
  console.log(`OK: ${newEntries.length} new project(s) verified.`);
}

main();
