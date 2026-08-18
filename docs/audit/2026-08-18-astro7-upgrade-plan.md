# katevoet.com — Astro 7 upgrade implementation plan

**Date:** 2026-08-18 · **Repo:** `/Users/victormaes/Documents/GitHub-desktop/katevoet` · **Branch:** `master` (work directly on it)
**Current state:** Astro **6.4.8**, `@astrojs/mdx` **5.0.6**, `@astrojs/sitemap` 3.7.3, Tailwind 3.4.19, version 3.6.0, clean tree, fully verified static site (6 pages) deployed to GitHub Pages via `.github/workflows/deploy.yml`.
**Goal:** upgrade to **astro 7.2.3 (or latest 7.x)** + **@astrojs/mdx 7.0.6 (or latest 7.x)** together, clearing the 4 open `npm audit` advisories (3 Astro XSS + sharp/libvips), with zero regression in the built site.
**Explicitly OUT of scope:** Tailwind 4, any design change, any content change, analytics. Do not touch them.

This plan is self-contained. Read it fully before running anything.

---

## 0. Hard rules (override everything else)

1. **NEVER run `git push`** in any form (`push`, `push --force`, `push origin HEAD`, etc.). Commit locally only; the owner pushes.
2. Every commit must be authored as **`monsieurmusclaira <maes.victor.1@gmail.com>`**. The repo-local git config is already set — verify with `git config user.name && git config user.email` before committing. **No AI attribution of any kind** in commit messages: no "Co-Authored-By", no "Generated with", nothing after the last content line.
3. Work directly on `master`. Do not create branches, do not open PRs.
4. If the upgrade cannot be completed cleanly, **roll back** (§6) and write a short report of what blocked it instead of leaving the tree half-migrated. A working 6.4.8 site beats a broken 7.x site.
5. Do not modify: page content/copy, design tokens, `docs/`, `.github/workflows/` (unless a documented Astro 7 requirement forces a Node bump — see §2.1), or anything in §"out of scope".

## 1. Environment facts (read or you will waste time)

- **Lighthouse cannot run on this machine** (x64 Node on Apple Silicon). Do not attempt it.
- The dev server can fail under an arm64 node against x64-installed binaries. **Verify with the production build**: `npm run build` then `npx astro preview --port 4322`. There is a `.claude/launch.json` entry `katevoet-preview` on port 4322. Port 4321 may be occupied by an unrelated project — leave that process alone.
- If a browser pane is used: it can report `visibilityState: hidden` (IntersectionObserver/rAF only fire when a screenshot forces a frame), the viewport can collapse to 0×0 or reset on hard navigation — always set the viewport explicitly and sanity-check `document.documentElement.clientWidth` before trusting any measurement.
- Type-checking: `@astrojs/check` is deliberately NOT a committed devDependency (its dependency chain carries advisories). Run it as:
  `npm install --no-save @astrojs/check typescript && npx astro check` → then `npm install` to prune. Note Astro 7 may want a newer check package — use whatever `npx @astrojs/upgrade` selects, still `--no-save`.
- Internal-link guard: `node scripts/check-links.mjs` (run after every build; must report 0 broken).

## 2. Pre-flight

1. Confirm clean tree (`git status --porcelain` empty) and record the rollback point: `git rev-parse HEAD` (expect `8ab4e7b` or later). Note it in your report.
2. **Node version:** `node -v`. Astro 7 raises the minimum Node requirement — check the official guide (below) for the exact floor. The deploy workflow uses `node-version: 22`, which is expected to satisfy it; if (and only if) the official guide requires ≥ a version above 22, update `.github/workflows/deploy.yml` accordingly and say so in the report.
3. **Baseline snapshot** (used for the A/B diff in §4): build on 6.4.8 first and stash the output:
   ```bash
   npm run build && cp -R dist /tmp/dist-baseline-6
   ```
4. Read the **official** upgrade guide: https://docs.astro.build/en/guides/upgrade-to/v7/ — it is the source of truth for breaking changes. A prior automated summary of that page mentioned (verify each against the live page; do not trust this list blindly):
   - a stricter compiler that requires matching closing tags on non-void elements and stops auto-correcting invalid HTML nesting;
   - a changed default for HTML whitespace/compression (`compressHTML`) that can strip spaces between inline elements — if inter-word spacing changes in built HTML, set the old behavior explicitly in `astro.config.mjs` rather than editing content;
   - a new default markdown processor, with an opt-out to the remark/rehype pipeline (this repo's `@astrojs/markdown-remark` direct dep was removed earlier; the MDX integration manages its own — only act if the guide says MDX pages need it);
   - removed deprecated `astro:transitions` internals (this repo only uses `<ClientRouter />`, `transition:persist`, and the `astro:page-load` / `astro:before-swap` events — all public API, expected safe, but verify they're not listed as changed);
   - removed/renamed experimental flags (this repo's `astro.config.mjs` sets no experimental flags — nothing to do unless the guide says otherwise);
   - Vite major bump underneath (no custom Vite config in this repo).

## 3. Upgrade steps

1. Run the official tool: `npx @astrojs/upgrade` — accept astro 7.x and @astrojs/mdx 7.x, plus whatever it bumps for `@astrojs/sitemap`. Do NOT let it add unrelated packages.
2. `npm install`, then `npm ls astro @astrojs/mdx @astrojs/sitemap` — record exact versions.
3. `npm audit` — expect the 3 Astro XSS advisories and the sharp advisory to be **gone**. Record the result. If anything remains, list it in the report; do not `--force` anything.
4. `npm run build`. Fix errors strictly minimally, guided by the official guide. Likely places issues could surface in THIS repo — check these even if the build passes:
   - **MDX `layout:` frontmatter handling** — the site's 5 pages depend on `src/layouts/BaseLayout.astro:11` reading `Astro.props.frontmatter` (`const fm = Astro.props.frontmatter ?? {}`). If mdx 7 changes how frontmatter reaches the layout, the symptom is every page falling back to the generic site title/description. §4 checks this explicitly.
   - **Frontmatter `schema` objects** — the three project MDX files and `about.mdx` pass a YAML `schema:` object through frontmatter into `BaseHead.astro`, serialized as JSON-LD. Verify the objects still arrive intact (JSON-LD blocks in dist parse and are non-empty).
   - **`import.meta.glob` of images** — `BaseHead.astro`, `ProjectHero.astro`, `ContentPicture.astro`, `ProjectCard.astro` all glob `/src/assets/img/**` and resolve string paths from frontmatter. A Vite major can change glob typing/behavior; symptom: images missing or build error.
   - **`astro:assets` `<Picture formats={['avif']} fallbackFormat="webp">` and `getImage()`** in the same files — verify emitted formats/`widths` ladders are unchanged (§4 diff will catch it).
   - **Inline scripts** (`Lightbox.astro` `is:inline` IIFE, the `data-astro-rerun` scripts in `BaseHead.astro`/`Footer.astro`) — verify they still ship once per page and `data-astro-rerun` still re-executes on soft navigation.
   - **`trailingSlash: 'always'`** and the sitemap `serialize`/`lastmod` config in `astro.config.mjs` — confirm neither option was renamed.
   - **Compiler strictness:** if the build fails on unclosed/misnested tags, fix the specific tag it names (the MDX pages contain hand-written HTML sections — most likely location). Keep fixes surgical; do not reformat.
5. Type check (per §1 method): 0 errors / 0 warnings required; hints noted.

## 4. Verification (all gates must pass before committing)

1. `npm run build` → clean, exactly **6 pages** (index, about, 3 projects, 404).
2. `node scripts/check-links.mjs` → 0 broken.
3. **A/B diff against the 6.4.8 baseline** — this is the strongest regression net; run it exactly:
   ```bash
   # page inventory identical
   (cd /tmp/dist-baseline-6 && find . -name '*.html' | sort) > /tmp/pages-6.txt
   (cd dist && find . -name '*.html' | sort) > /tmp/pages-7.txt
   diff /tmp/pages-6.txt /tmp/pages-7.txt
   # per-page: titles, descriptions, canonicals, og:image, h1/h2 counts, JSON-LD block count
   for f in $(cat /tmp/pages-7.txt); do
     for d in /tmp/dist-baseline-6 dist; do
       python3 - "$d/$f" <<'PY'
   import sys, re, json
   h = open(sys.argv[1]).read()
   t = re.search(r'<title>(.*?)</title>', h, re.S)
   desc = re.search(r'name="description" content="(.*?)"', h)
   ld = re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
   [json.loads(x) for x in ld]
   print(sys.argv[1], '|', t.group(1)[:60], '|', (desc.group(1)[:40] if desc else 'NONE'),
         '| h1:', len(re.findall(r'<h1[ >]', h)), 'h2:', len(re.findall(r'<h2[ >]', h)), 'ld:', len(ld))
   PY
     done
   done
   ```
   Titles/descriptions/h1/h2/JSON-LD counts must match pairwise between baseline and new build. **If titles collapse to "Kate Voet — Belgian Film Director & Screenwriter" on project pages, the MDX frontmatter path broke (§3.4 first bullet) — fix before proceeding.**
   Also compare total weight: `du -sh /tmp/dist-baseline-6 dist` (expect ~12 MB both; investigate any swing beyond ±2 MB) and confirm srcset ladders survived: `grep -c 'srcset' dist/index.html` matches baseline.
4. **Whitespace regression probe** (compressHTML change): pick two text-heavy built pages and diff their *visible text* against baseline:
   ```bash
   for f in about/index.html projects/a-long-goodbye/index.html; do
     python3 -c "import re,sys;h=open(sys.argv[1]).read();h=re.sub(r'<script.*?</script>','',h,flags=re.S);print(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',h)))" /tmp/dist-baseline-6/$f > /tmp/a.txt
     python3 -c "import re,sys;h=open(sys.argv[1]).read();h=re.sub(r'<script.*?</script>','',h,flags=re.S);print(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',h)))" dist/$f > /tmp/b.txt
     diff /tmp/a.txt /tmp/b.txt && echo "$f text identical"
   done
   ```
   Words jammed together (e.g. "DirectorScreenwriter") = the whitespace change; fix via config per §2.4, not by editing content.
5. **Runtime smoke test** (production preview on port 4322, viewport explicitly 1280×800 then 375×812):
   - Fresh load at 375: burger menu opens/closes; Escape closes it.
   - Soft-nav home → project → click a still: lightbox opens, arrows navigate, Escape closes and restores scroll. Then open the lightbox and go Back: **no stranded overlay** on the previous page (regression guard for the `astro:before-swap` close).
   - Soft-nav twice, then scroll a project page: below-fold sections still fade in (the `.js` class re-add and reveal observer still work under Astro 7's router).
   - Footer year correct after a soft nav (`data-astro-rerun` still re-executes).
   - No horizontal scroll on any page at 375.
   - Header: white over hero at top, charcoal + scrim after scrolling past the hero; charcoal on `/404.html`.
6. `dist/CNAME` exists and contains `katevoet.com`.
7. Delete `/tmp/dist-baseline-6` when all gates pass.

## 5. Commit & version

- One commit for the upgrade itself:
  `Upgrade to Astro 7 and MDX 7, clearing the open security advisories`
  Body: exact version movements (6.4.8→7.x.y, mdx 5.0.6→7.x.y, sitemap if bumped), the audit result (expected: 0 vulnerabilities), any config/markup changes the migration forced (each with one-line justification), and the §4 gate results.
- If migration forced source changes beyond `package.json`/lockfile/config, keep them in the same commit — they are part of the upgrade.
- Bump `package.json` version to **4.0.0** (framework major) in the same commit; run `npm install` after editing so the lockfile version field matches.
- `git status` must be clean afterward. **Do not push.**

## 6. Rollback (if blocked)

```bash
git reset --hard <rollback-hash-from-§2.1>
npm install
npm run build && node scripts/check-links.mjs   # confirm 6.4.8 still green
```
Then write the report: what failed, the exact error, which breaking change caused it, and what a human should decide before retrying.

## 7. Report format (deliverable)

1. Versions before → after (astro, mdx, sitemap, node).
2. `npm audit` before → after.
3. Every file changed beyond package.json/lockfile, with a one-line reason each.
4. §4 gate results, item by item, with the actual command output for the A/B diff and audit.
5. Anything skipped/deviated and why; anything the owner should eyeball.
6. Commit hash. Confirmation that nothing was pushed.
