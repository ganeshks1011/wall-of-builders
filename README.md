# Million Pixels

A Million Dollar Homepage-inspired wall: 1,000,000 pixels, where every block is a real side project.

## How it works

No money changes hands. To claim a pixel block on the wall, link back to us:

1. Add a link to `https://codevu.com` somewhere public on your project's site (footer, links page, anywhere crawlable).
2. Fork this repo and add your project to `data/projects.json`.
3. Open a pull request.
4. An automated check fetches your page and verifies the backlink. If it finds a plain, crawlable link, your PR passes.
5. Once merged, your pixel goes live on the wall at `codevu.com/million-pixels`, linking back to your project.

Keep the backlink live. We re-check weekly, and pixels whose backlinks disappear get delisted.

## Entry format

Add one object to the array in `data/projects.json`:

```json
{
  "name": "My Side Project",
  "url": "https://myproject.com",
  "backlinkUrl": "https://myproject.com/about"
}
```

- `name`: your project's name, max 60 characters.
- `url`: your project's homepage.
- `backlinkUrl`: the page on your site where the link to `codevu.com` lives.

Wall position is assigned automatically in merge order. Each block shows the project's favicon, pulled automatically when the wall renders (we grab the largest available icon, typically the 180x180 apple-touch-icon, and scale it down to block size).

## Rules

- One block per project.
- Your site must be a real side project. No spam, parked domains, or anything illegal.
- The backlink must be a plain `<a href="https://codevu.com">` in the page's HTML. JavaScript-rendered, hidden, or `nofollow` links don't count.

## Roadmap

- [ ] Wall page renderer on codevu.com reading this repo's data
- [x] Block visuals: favicon auto-pull
- [ ] Weekly backlink re-verification with auto-delist
- [ ] Decide the canonical backlink target (`codevu.com` vs the wall page URL)

## License

MIT. See [LICENSE](LICENSE).
