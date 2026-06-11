# Website Audit Report — 2026-06-11

**Project:** Kate Voet portfolio (Astro 6.4.4, MDX, Tailwind 3, DaisyUI 4) · v3.2.1
**Scope:** bugs · errors · design improvements · performance
**Method:** tooling gates (build, `astro check`, linkinator, `npm audit`, `npm outdated`) →
manual code review → live design review in the dev server (DOM/computed-style inspection +
screenshots where the capture pipeline cooperated). Findings only — no fixes applied.

## Tooling baseline — all green

| Gate | Result |
|---|---|
| `npm run build` | clean, 19 pages, sitemap, no warnings |
| `astro check` | 0 errors, 0 warnings, 0 hints |
| `linkinator` | only the known external Vimeo 401 |
| `npm audit` | 0 vulnerabilities |
| `npm outdated` | astro 6.4.6 + typography 0.5.20 patches available; Tailwind 4 / DaisyUI 5 / mdx 6 majors deferred by decision |

## Findings

### High

**H1 — 14 of 19 pages are orphaned (unreachable by any internal link)** · design/SEO/content
- Evidence: grep of built HTML — 13 of 16 project pages (`anna`, `burn`, `burning-clouds`, `bieke-depoorter-chance-encounters`, `ever-since-i-have-been-flying`, `felix-le-gamin-qui-traverse`, `hoge-blekker`, `la-belle-rosine`, `moonlight-woman`, `springtide`, `today-we-escape`, `vlinderman`, `world-wood-web`) and `/behind-the-scenes` have **zero** inbound links. The homepage grid ([ProjectGrid.astro](src/components/ProjectGrid.astro)) links only 3 projects; header/footer link only Work/About/Contact.
- Impact: visitors cannot discover most of the portfolio; orphan pages rank poorly (sitemap-only discovery).
- Recommendation: add the remaining projects to the homepage grid or an "All work" index section, and link Behind the Scenes from the header and/or footer nav.

**H2 — Deployed site is ~1.1 GB; 742 MB of it is dead PNGs; over the GitHub Pages 1 GB limit** · performance/deployment
- Evidence: `dist/` = 1.1 GB. 241 original PNGs (742 MB) are emitted into `dist/_astro/` with **zero references** from any built HTML/CSS/JS (Astro emits the original file alongside the WebP variants it generates; only the WebPs — 254 MB — are referenced). GitHub Pages documents a 1 GB published-site limit; deploys may fail or be truncated at any time.
- The heaviest page (the-tears-of-things) references only ~5 MB of (lazy-loaded) images — the *served* pages are fine; the dead weight is purely in the artifact.
- Recommendation (pick one):
  a) Convert the PNG film stills in `src/assets/img/**` to high-quality JPEG/WebP sources — film stills are photographic; PNG is the wrong format. Shrinks repo, build time, and dist (best long-term).
  b) Post-build prune: delete unreferenced `dist/_astro/*.png` in a build step before deploy (quick, but treats the symptom).

### Medium

**M1 — Project-page `<h1>` renders at 15px, smaller than the synopsis below it** · design
- [ProjectHero.astro:45](src/components/ProjectHero.astro:45): the film title uses `text-subtitle` (clamp ≈12.75–15px, uppercase) while the synopsis under it is 18.75px. The page's most important text reads as an eyebrow label (verified visually and via computed styles).
- Recommendation: give the title real heading scale (e.g. the `text-display`/h2 clamp), keeping the eyebrow style as a label above it if desired.

**M2 — No section headings on project pages** · design/semantics
- "Credits", "Awards", "Festivals", "Markets", "With the support of" are styled `<p class="text-secondary">` via [FestivalsItem.astro](src/components/FestivalsItem.astro)'s `heading` prop — project pages have h1 → nothing else. Hurts scannability and document outline.
- Recommendation: render the `heading` prop as an `<h2>` styled exactly as today.

**M3 — Every page shares the same generic og:image** · SEO/social
- [BaseHead.astro](src/components/BaseHead.astro) supports a per-page `image` prop, but no page passes it — every share card is `social.jpg`. Each project has a hero still in frontmatter that would make a far better card.
- Recommendation: pass `meta.heroImage` (resolved to a built asset URL) from project pages into the layout → BaseHead.

**M4 — `polaroid.css` applies a global CSS reset on the behind-the-scenes page only** · bug-risk/consistency
- [polaroid.css:1-7](src/styles/polaroid.css) ships `*, *:before, *:after { margin:0; padding:0; box-sizing:border-box }` plus bare `figure`/`figcaption` element selectors, imported only by [behind-the-scenes.mdx](src/pages/behind-the-scenes.mdx). One page runs a different box model than the rest of the site, and any future `<figure>` on that page inherits polaroid styling.
- Recommendation: drop the reset block (Tailwind preflight already normalises) and scope the selectors under a `.polaroid` class.

**M5 — Scrapbook notes collapse to ~112px wide on mobile** · design
- [polaroid.css:49-53](src/styles/polaroid.css:49): `.scrapbook-note { width: 30% }` → at a 375px viewport the yellow notes are 112px wide with a 25px handwriting font (~4 characters per line). Verified in the dev server at mobile width.
- Recommendation: `width: 100%` (or `min(30rem, 100%)`) on small screens via a media query or Tailwind classes.

### Low

- **L1 — Footer year is frozen at build time** ([Footer.astro:2](src/components/Footer.astro)): `new Date()` runs during the static build, so `© 2026` only updates when the site is rebuilt. Fine in practice; worth knowing.
- **L2 — Dead directories**: `src/js/` (`nav.js`, `utils.js` — unreferenced), `src/scripts/VideoHero.js` (targets the VideoHero component deleted in the May audit), and `src/color/colors.zip` (a zip archive inside `src/`). Remove all three.
- **L3 — figcaption font stack lists "Nothing You Could Do"** ([polaroid.css:24](src/styles/polaroid.css:24)) — that font is never loaded; it silently falls back to Caveat. Drop it from the stack (or load it).
- **L4 — Patch updates available**: astro 6.4.4 → 6.4.6, @tailwindcss/typography 0.5.19 → 0.5.20.

## What's healthy (verified)

- All May-audit fixes hold: one `<h1>` per page, credits text readable (`text-charcoal`, AOS animates it in correctly), laurels load, footer contrast, reduced-motion support, lightbox semantics.
- Lazy-loading discipline is correct everywhere: 2 eager images (hero) per page, all gallery/below-fold images lazy; heaviest page's referenced image payload ≈ 5 MB.
- AOS is self-hosted, initialises, and animates on scroll (verified live); no console errors on any page visited.
- No real horizontal overflow on home/about/project/BTS at desktop or mobile content widths.

## Resolution (same day)

Per the site owner's direction, the portfolio was trimmed to its three flagship projects
(A Long Goodbye, The Tears of Things, Les Homards Immortels):

- Deleted the 13 other project pages, the Behind the Scenes page, their 15 asset folders
  (`src/assets/img/`), and the now-unused `Polaroid.astro`, `ScrapbookNote.astro`,
  `polaroid.css`.
- **H1 resolved**: every remaining page is linked (3 projects on the homepage grid, About in
  the nav). No orphans.
- **H2 resolved**: `dist/` shrank from 1.1 GB to 303 MB (dead PNG weight 742 MB → 35 MB) —
  well under the GitHub Pages limit. `src/assets` shrank 1.9 GB → 559 MB.
- **M4, M5, L3 dissolved** (their files were deleted).
- Still open: M1 (tiny h1 on project pages), M2 (no section headings), M3 (per-page
  og:image), L1, L2, L4.

Verified after the trim: build clean (5 pages), `astro check` 0 errors, linkinator clean
(external Vimeo 401 only), `npm audit` 0 vulnerabilities, one `<h1>` per page.

## Disclosed gaps

- **Lighthouse/axe still cannot run** (x64 Node on Apple Silicon refuses to drive Chrome) — no numeric scores; covered via DOM inspection + gates instead.
- **The preview screenshot pipeline was intermittently broken** (viewport collapsed to 0×0 mid-session, producing blank frames). Two would-be findings were traced to this tool fault and **discarded as false positives** (a "148px horizontal overflow" and "blank content sections"); both were disproven by direct DOM measurement on a healthy viewport. Design review relied on computed styles plus the screenshots that did capture correctly.
- The mobile-menu click-test was interrupted by the dev server dying; the toggle handler was verified by code review only.
