// Shared backlink verification helpers, used by the PR check and the
// weekly re-verification job.

const REQUIRED_HOST = 'codevu.com';
const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT = 'wall-of-builders-backlink-check/1.0';

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
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

export { fetchHtml, findBacklink, isHiddenOrNofollow, isValidUrl, REQUIRED_HOST };
