#!/usr/bin/env python3
"""Seed Wall of Builders tiles from a list of verified sites.

Placement rule (the wall's fill requirement):
  Tiles fill from the middle of the 64x64 field outward along a square
  spiral. A tile may ONLY be placed if at least one orthogonally adjacent
  tile (up/down/left/right) is already filled. The very first tile goes on
  the center cell. Violating this aborts the run with an error.

The site renders projects[i] at spiral cell i (center-out), reading
data/projects.json oldest-first and reversing it, so new entries are
appended here in REVERSE spiral order: the last array element ends up
closest to the center.

Usage:
  python3 seed.py --sites sites-10.json --repo ~/workspace/wall-of-builders [--dry-run]

Each site becomes exactly one git commit in the registry repo.
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

GRID_ROWS = 64
GRID_COLS = 64
MAX_NAME_LEN = 60
MAX_DESC_LEN = 140
FETCH_TIMEOUT_SECS = 15


def spiral_cells(count, rows, cols):
    """Center-out square spiral of (row, col) cells.

    Ring r walks: (cr, cc-r) -> up to (cr-r, cc-r) -> right to (cr-r, cc+r)
    -> down to (cr+r, cc+r) -> left to (cr+r, cc-r) -> up to (cr+1, cc-r).
    Every cell after the first is 4-adjacent to an earlier cell.
    Mirrors spiralCells() in codevu-site/app/actions/public/wall-of-builders-content.tsx.
    """
    cells = []
    if count <= 0 or rows <= 0 or cols <= 0:
        return cells
    center_row = (rows - 1) // 2
    center_col = (cols - 1) // 2
    seen = set()

    def push(row, col):
        if 0 <= row < rows and 0 <= col < cols and (row, col) not in seen:
            seen.add((row, col))
            cells.append((row, col))

    push(center_row, center_col)
    ring = 1
    while len(cells) < count and ring <= rows + cols:
        row, col = center_row, center_col - ring
        push(row, col)
        for _ in range(ring):
            row -= 1
            push(row, col)
        for _ in range(2 * ring):
            col += 1
            push(row, col)
        for _ in range(2 * ring):
            row += 1
            push(row, col)
        for _ in range(2 * ring):
            col -= 1
            push(row, col)
        for _ in range(ring - 1):
            row -= 1
            push(row, col)
        ring += 1
    return cells[:count]


NEIGHBORS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def require_adjacent(cell, filled):
    """The wall's fill requirement: a new tile must touch a filled tile.

    Raises SystemExit on violation. The first tile (empty wall) is exempt.
    """
    if not filled:
        return
    row, col = cell
    if not any((row + dr, col + dc) in filled for dr, dc in NEIGHBORS):
        raise SystemExit(
            f"REFUSED: tile at row={row} col={col} has no filled adjacent tile. "
            "The wall can only grow from filled tiles."
        )


def clean_url(raw):
    parsed = urlparse(raw.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError(f"not an http(s) URL: {raw!r}")
    return raw.strip()


def apple_touch_icon(site_url):
    """Return the site's apple-touch-icon URL, or None.

    The wall only shows high-quality icons; a site without an
    apple-touch-icon is skipped.
    """
    request = urllib.request.Request(
        site_url,
        headers={"User-Agent": "codevu-wall-of-builders/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_SECS) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    for tag in re.findall(r"<link\b[^>]*>", html, re.IGNORECASE):
        rel = re.search(r'rel\s*=\s*["\']([^"\']*)["\']', tag, re.IGNORECASE)
        if not rel or "apple-touch-icon" not in rel.group(1).lower():
            continue
        href = re.search(r'href\s*=\s*["\']([^"\']*)["\']', tag, re.IGNORECASE)
        if not href or href.group(1).startswith("data:"):
            continue
        absolute = urljoin(site_url, href.group(1))
        parsed = urlparse(absolute)
        if parsed.scheme in ("http", "https") and parsed.hostname:
            return absolute
    return None


def validate_entry(site):
    name = site["name"].strip()
    url = clean_url(site["url"])
    description = site.get("description", "").strip()
    if not name:
        raise ValueError("empty name")
    if len(name) > MAX_NAME_LEN:
        raise ValueError(f"name too long ({len(name)}): {name!r}")
    if len(description) > MAX_DESC_LEN:
        raise ValueError(f"description too long ({len(description)}): {name!r}")
    entry = {"name": name, "url": url}
    if description:
        entry["description"] = description
    # NOTE: no `locked` (set by the weekly backlink check; PRs faking it are
    # rejected) and no `backlinkUrl` (seeds have no backlink, so tiles stay
    # unlocked per the optional-backlink policy).
    return entry


def git(repo, *args):
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed:\n{result.stderr}")
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sites", required=True, help="JSON list of {name, url, description}")
    parser.add_argument("--repo", required=True, help="wall-of-builders repo checkout")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repo = Path(args.repo)
    projects_path = repo / "data" / "projects.json"
    sites = json.loads(Path(args.sites).read_text())
    existing = json.loads(projects_path.read_text())
    if not isinstance(existing, list):
        raise SystemExit("data/projects.json is not a JSON array")

    start_index = len(existing)
    cells = spiral_cells(start_index + len(sites), GRID_ROWS, GRID_COLS)
    if len(cells) < start_index + len(sites):
        raise SystemExit("spiral ran out of cells")

    seen_domains = {urlparse(e["url"]).hostname for e in existing if isinstance(e, dict)}
    filled = {(r, c) for r, c in cells[:start_index]}

    placements = []
    skipped = []
    placed_count = 0
    for site in sites:
        entry = validate_entry(site)
        domain = urlparse(entry["url"]).hostname
        if domain in seen_domains:
            raise SystemExit(f"REFUSED: duplicate domain {domain} ({entry['name']})")
        icon_url = apple_touch_icon(entry["url"])
        if not icon_url:
            skipped.append(entry["name"])
            print(f"  SKIP (no apple-touch-icon): {entry['name']}")
            continue
        entry["icon"] = icon_url
        seen_domains.add(domain)
        cell = cells[start_index + placed_count]
        require_adjacent(cell, filled)
        filled.add(cell)
        placements.append((cell, entry))
        placed_count += 1

    print(f"existing tiles: {start_index}, new tiles: {len(placements)}, skipped: {len(skipped)}")
    for (row, col), entry in placements:
        print(f"  spiral #{cells.index((row, col))} -> row={row} col={col}: {entry['name']}")
    if skipped:
        print(f"skipped (no apple-touch-icon): {', '.join(skipped)}")
    if args.dry_run:
        print("dry run: no files changed, no commits made")
        return

    # Append in REVERSE spiral order: the site reverses the array, so the
    # last element lands on the centermost new cell.
    ordered = [entry for _, entry in reversed(placements)]
    for entry in ordered:
        data = json.loads(projects_path.read_text())
        data.append(entry)
        projects_path.write_text(json.dumps(data, indent=2) + "\n")
        git(repo, "add", "data/projects.json")
        git(repo, "commit", "-m", f"wob: seed tile - {entry['name']}")
        print(f"committed: {entry['name']}")

    print(f"done: {len(ordered)} individual commits. Push with: git -C {repo} push")


if __name__ == "__main__":
    main()
