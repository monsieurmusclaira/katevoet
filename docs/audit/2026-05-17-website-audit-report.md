# Website Audit Report — 2026-05-17

**Project:** Kate Voet portfolio (Astro 6.3.3, MDX, Tailwind 3, DaisyUI)
**Scope:** bugs · errors · performance · SEO · accessibility
**Target:** local production build (`build` + `astro preview` on `localhost:4321`)
**Method:** objective tooling baseline → manual review by dimension → findings verified
against the built HTML in `dist/`. Report-first, then a controlled fix pass.
**Branch:** `audit/website-2026-05-17`
**Maintainer:** MrMochi

All findings below were fixed except where marked *Disclosed gap*. Every fix was applied,
rebuilt, and re-verified.

## Before → after

| Metric | Before | After |
|---|---|---|
| `npm run build` | clean | clean (19 pages) |
| `astro check` | 9 errors, 11 hints | 0 errors, 0 warnings, 0 hints |
| `linkinator` broken links | 13 | 1 (external Vimeo 401 only) |
| Pages with an `<h1>` | 2 / 19 | 19 / 19 |
| `npm audit` | 0 | 0 |
| Caveat font `<link>` on behind-the-scenes | ~30 (in body) | 1 (in head) |

## Findings & resolutions

Severity: **High** (clear damage) · **Medium** (worth fixing) · **Low** (polish/cleanup).

### High

| ID | Dimension | Finding | Resolution |
|---|---|---|---|
| H1 | a11y/content | Credits/awards/festivals text was `text-base-200` (#f0ece6) on cream (~1.05:1) — effectively invisible on all 16 project pages. | Swapped to `text-charcoal` across the project MDX. |
| H2 | bug/SEO | 12 festival-laurel images 404'd on Les Homards Immortels — SVGs orphaned when `public/img/` was removed in the image migration. | Restored the laurel `.svg` files to `public/img/.../laurels/`. linkinator: 13 → 1. |
| H3 | SEO/a11y | 17 pages (all projects + behind-the-scenes) had no `<h1>` — the title rendered as a `<p>`. | `ProjectHero` title now renders as `<h1>`; one `<h1>` per page. |
| H4 | bug/perf | AOS gated the above-the-fold hero behind a third-party CDN script and never re-initialised after client-side navigation — content could stay invisible. | Self-hosted AOS (pinned), re-init via `AOS.refreshHard()` on `astro:page-load`, removed `data-aos` from the LCP hero, disabled AOS under reduced-motion. |

### Medium

| ID | Dimension | Finding | Resolution |
|---|---|---|---|
| M1 | bug/perf | Header `scroll` listener was added inside `initNav`, accumulating one handler per view-transition navigation. | Bind the scroll listener once at module scope. |
| M2 | bug | Header DOM nodes used without null checks (the 9 `astro check` errors). | Null-guard the colour helpers; removed unused `header` var. |
| M3 | perf | `Caveat` font injected via `<link>` inside Polaroid/ScrapbookNote → ~30 duplicate render-blocking links on behind-the-scenes. | Consolidated into the single BaseHead Google Fonts request; removed per-component links. |
| M4 | a11y | Mobile-menu button had no accessible name or state. | Added `aria-label`/`aria-expanded`/`aria-controls`; toggle updates state. |
| M5 | a11y | No `prefers-reduced-motion` support anywhere. | Added a reduced-motion media query; entrance effects resolve to their visible state; AOS disabled. |
| M6 | a11y | Lightbox controls were tabbable when closed; no focus trap/restore when open. | `role="dialog"`/`aria-modal`, `inert` when closed, focus to close button on open + restore on close, Tab trap. |
| M7 | a11y | Footer `text-white/30` and `/40` failed contrast on charcoal. | Raised to `/60` and `/70` (≥ AA 4.5:1). |
| M8 | reliability/perf | AOS loaded from unpinned `unpkg/aos@next` with no integrity. | Replaced with a pinned, self-hosted `aos@2.3.4` dependency (and dropped the unpkg preconnect). |

### Low (cleanup)

| ID | Finding | Resolution |
|---|---|---|
| L1 | Dead, unreferenced `Layout.astro`, `PolaroidLayout.astro`, `ProjectLayout.astro`, `FilmCard.astro`. | Deleted. |
| L2 | Dead `_archive/` folder (736 KB) and `.afdesign` source files in the repo. | Removed `_archive/`; untracked + gitignored `*.afdesign`. |
| L3 | Dead CSS (legacy `.grain`, unused `img[data-loading]`) and dead props (`ScrapbookNote` `image`/`alt`, `ProjectGrid` `desc`). | Removed. |
| L4 | JSON-LD script raised an `astro(4000)` hint. | Added explicit `is:inline`. |
| L5 | `warmgray` #6b6b6b on cream ≈ 4.66:1 (borderline for small captions). | Darkened to #5a5a5a. |

## Disclosed gaps (tooling that could not run)

- **Lighthouse & axe did not run.** The local Node is an x64 build on Apple Silicon
  (arm64); Lighthouse refuses to drive Chrome under Rosetta. No numeric
  perf/a11y/SEO/best-practices scores were produced. Those dimensions were covered by
  manual review + `astro check` + linkinator + built-HTML inspection. To get scores later,
  install an arm64 Node and re-run `npx lighthouse` / `npx @axe-core/cli` against
  `astro preview`.
- **html-validate** not run (needs a config); markup correctness covered via `astro check`
  and built-HTML inspection.
- **Vimeo `[401]`** (`player.vimeo.com/video/206725218`, Les Homards) — a crawler block,
  not necessarily broken for real visitors; verify manually.

## Verification

Final state after the fix pass:

- `npm run build` → clean, 19 pages.
- `astro check` → 0 errors, 0 warnings, 0 hints (was 9 / 0 / 11).
- `npx linkinator ./dist --recurse` → 1 broken (external Vimeo 401 only; was 13).
- Built-HTML spot checks → one `<h1>` per page; credits/awards render in readable
  `text-charcoal`; laurel images resolve.
- `npm audit` → 0 vulnerabilities.

## Notes

- `astro check` was run via `npx` during the audit. It was intentionally **not** added as a
  committed devDependency: its `@astrojs/language-server` → `yaml-language-server` chain
  carries 5 moderate (dev-only) advisories that would otherwise show in `npm audit`. Re-add
  it locally when you want CI type-checking.
- Unrelated to the site: the local dev Node is an x64 build on Apple Silicon — switching to
  an arm64 build would speed up local tooling (and unblock Lighthouse).
