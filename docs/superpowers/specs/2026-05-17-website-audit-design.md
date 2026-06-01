# Website Audit — Design Spec

**Date:** 2026-05-17
**Project:** Kate Voet portfolio (Astro 6.3.3 static site, MDX, Tailwind 3, DaisyUI)
**Maintainer:** MrMochi

## Goal

Produce a thorough, evidence-backed audit of the website across five dimensions —
**bugs, errors, performance, SEO, and accessibility** — then fix the findings in a
controlled pass after review.

## Scope decisions (agreed)

| Decision | Choice |
|---|---|
| Outcome | Report first → user review → controlled fix pass |
| Depth | Thorough — one careful pass per dimension |
| Target | Local production build only (`build` + `astro preview` on `localhost:4321`) |
| Dimensions | Bugs · Errors · Performance · SEO · Accessibility |
| Methodology | Approach A — objective tooling baseline, then manual review by dimension |

## Out of scope

- Live-site / CDN / HTTP-header analysis (local build only).
- New features, redesign, or visual restyling.
- Content rewriting beyond correcting actual errors.
- Major dependency upgrades, unless one is the direct fix for a flagged bug or
  security issue.

## Methodology

### Phase 1 — Objective tooling baseline

Run against a fresh production build served by `astro preview` on `localhost:4321`.

| Tool | Catches | Notes |
|---|---|---|
| `npm run build` | Build errors, broken image imports, MDX failures, warnings | Source of truth for "does it ship" |
| `astro check` | TypeScript/Astro diagnostics, unused props, bad types | Confirm/install `@astrojs/check` if absent |
| Lighthouse CLI (`npx lighthouse`) | Performance, SEO, a11y, best-practices scores per route | Needs headless Chrome — verify before relying on it |
| axe / pa11y | Contrast, alt text, ARIA, heading order | Drives Chrome |
| `linkinator` | Broken internal links and asset 404s | Crawls the preview server |
| `html-validate` | Malformed markup, invalid nesting | Static, no browser |

**Representative routes** for browser-driven tools (Lighthouse, axe): home, about,
behind-the-scenes, and **one** project page. The 16 project pages share a single
template, so one is representative; the report will state this explicitly.

**Dependency honesty:** Lighthouse/axe require headless Chrome. Verify availability
at the start of execution. If a tool cannot run, fall back to manual + static checks
and flag the gap in the report rather than implying the tool ran.

### Phase 2 — Manual review by dimension

A coverage matrix guarantees nothing is skipped: every route and every shared
component / layout / config file is reviewed across all five dimensions.

- **Bugs** — logic errors; broken interactions (nav scroll colour-switch, lightbox,
  AOS, view transitions); edge cases; dead or unreachable code.
- **Errors** — console errors/warnings; hydration issues; 404s; malformed
  frontmatter; fragile `import.meta.glob` lookups.
- **Performance** — image sizing / `widths` / `sizes` correctness; render-blocking
  resources; font loading; layout shift (CLS); oversized assets.
- **SEO** — titles, descriptions, canonical, OG/Twitter per route; JSON-LD validity;
  sitemap and robots; heading hierarchy; semantic markup.
- **Accessibility** — colour contrast; alt-text quality; keyboard navigation; focus
  states; ARIA; reduced-motion support.

**Coverage matrix — routes**

- `/` (index.astro)
- `/about` (about.mdx)
- `/behind-the-scenes` (behind-the-scenes.mdx)
- `/projects/*` (16 MDX files; review one fully, spot-check the rest for content/frontmatter)

**Coverage matrix — shared code**

- Components: BaseHead, Header, Footer, Hero, FilmCard, ProjectCard, ProjectGrid,
  ProjectHero, ContentPicture, ContentYoutube, Polaroid, Lightbox, ScrapbookNote,
  CreditsItem, FestivalsItem.
- Layouts: BaseLayout and any others under `src/layouts/`.
- Config: `astro.config`, `tailwind.config.cjs`, `src/config.ts`, `package.json`,
  `public/robots.txt`, the GitHub Pages deploy workflow.
- Styles: `src/styles/global.css` and related.

## Deliverable — the report

A single markdown report at `docs/audit/2026-05-17-website-audit-report.md`.

**Top of report:** summary table of finding counts by severity, plus the Lighthouse/axe
baseline scores per route.

**Each finding:**

> **ID** · dimension · severity · location (`file:line`) · evidence · impact ·
> recommended fix · rough effort

**Severity rubric**

- **Critical** — broken; blocks users or the build.
- **High** — clear UX, SEO, or performance damage.
- **Medium** — suboptimal; worth fixing.
- **Low** — polish / nitpick.

Findings are sorted severity-first.

## Fix pass (after report approval)

1. Fixes applied in batches grouped by dimension.
2. Rebuild + re-run the relevant tool after each batch to confirm no regression.
3. Final Lighthouse/axe re-run to show before/after deltas.
4. Commits stay local. Pushing is handled separately (out of this agent's scope).

## Success criteria

- Every route and shared code file reviewed across all five dimensions (matrix complete).
- Each finding has reproducible evidence and a concrete recommended fix.
- Tooling that could not run is disclosed, not silently skipped.
- After the fix pass, build is clean and Lighthouse/axe scores improve or are explained.
