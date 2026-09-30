# Wall of Builders

A Million Dollar Homepage-inspired wall where every block is a real startup or side project built by someone. Claim a tile to promote your project. The canvas is 1024x1024 pixels (a touch over a million); each block is 16x16, so the wall holds 4,096 tiles in a tidy 64x64 grid.

## How it works

No money changes hands. Claiming is free, and the backlink is optional:

1. Fork this repo and add your project to `data/projects.json`.
2. Open a pull request. An automated check validates your entry.
3. Once merged, your pixel goes live on the wall at `codevu.com/wob`, linking back to your project.

### Lock your tile with a backlink

Add a plain, crawlable link to `https://codevu.com` somewhere public on your project's site (footer, links page, anywhere crawlable) and list that page as `backlinkUrl` in your entry. We verify it automatically when you open the PR, and re-check weekly.

A tile with a live backlink is **locked**: it cannot be claimed by anyone else. Without a backlink your tile stays live, but it is unlocked, which means someone else could claim it out from under you. If your backlink ever goes dead, your tile simply unlocks. It is never delisted for that.

## Entry format

Add one object to the array in `data/projects.json`:

```json
{
  "name": "My Side Project",
  "url": "https://myproject.com",
  "backlinkUrl": "https://myproject.com/about",
  "icon": "https://myproject.com/icon.png",
  "description": "Turns your bookmarks into a weekly newsletter",
  "tags": ["productivity", "newsletter"]
}
```

- `name`: your project's name, max 60 characters.
- `url`: your project's homepage. Your pixel block on the wall links here.
- `backlinkUrl` (optional): the page on your site where the link to `codevu.com` lives. Provide it to lock your tile; leave it out and your tile stays unlocked.
- `locked`: set automatically by our weekly backlink check. `true` means your backlink is live and your tile is locked. Don't set it by hand; pull requests that fake or flip it are rejected.
- `icon` (optional): direct URL to the image shown on your pixel block. Leave it out and we auto-pull the largest favicon from your site.
- `description` (optional): one line on what your project does, max 140 characters. Shown in the wall's browse view.
- `tags` (optional): up to 5 short tags, e.g. `["ai", "devtools"]`. Used for search and filtering.

Wall position is assigned automatically in merge order. Each block links to the project's `url` and shows its icon: your supplied `icon` when given, otherwise the largest available favicon pulled automatically when the wall renders (typically the 180x180 apple-touch-icon, scaled down to block size).

## Rules

- One block per project.
- Your site must be a real side project. No spam, parked domains, or anything illegal.
- The backlink, when you provide one, must be a plain `<a href="https://codevu.com">` in the page's HTML. JavaScript-rendered, hidden, or `nofollow` links don't count.
- A locked tile (live backlink) cannot be removed or re-claimed by anyone else's pull request.

## Roadmap

- [ ] Wall page renderer on codevu.com reading this repo's data
- [x] Block visuals: favicon auto-pull
- [x] Weekly backlink re-verification (locks tiles with live backlinks; never delists)
- [ ] Decide the canonical backlink target (`codevu.com` vs the wall page URL)

## License

MIT. See [LICENSE](LICENSE).
