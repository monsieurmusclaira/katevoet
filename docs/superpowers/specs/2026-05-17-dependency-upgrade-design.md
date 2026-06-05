# Dependency Upgrade — Design Spec

**Date:** 2026-05-17
**Project:** Kate Voet portfolio (Astro static site, MDX, Tailwind 3, DaisyUI)

## Goal

Upgrade Astro to 6.4 and bring the other dependencies up to their latest **safe**
(minor/patch) versions, without taking on any major migrations.

## Scope — what gets upgraded

| Package | From | To | Jump |
|---|---|---|---|
| astro | 6.3.3 | 6.4.4 | minor |
| @astrojs/markdown-remark | 7.1.1 | 7.2.0 | minor |
| @astrojs/mdx | 5.0.4 | 5.0.6 | patch (stays on v5) |
| @astrojs/sitemap | 3.7.2 | 3.7.3 | patch |
| postcss | 8.5.14 | 8.5.15 | patch |
| sass | 1.99.0 | 1.100.0 | patch |
| @tailwindcss/typography | 0.5.10 | 0.5.19 | minor |

- `^` version ranges are retained (e.g. `^6.4.4`).
- `@tailwindcss/aspect-ratio` is already at the latest (0.4.2) — no change.

## Explicitly held back (deferred)

- **tailwindcss** stays 3.4.19 (v4 is a CSS-first rewrite).
- **daisyui** stays 4.12.24 (v5 is the Tailwind-4-coupled major).
- **@astrojs/mdx** v6 — the major is deferred; only the v5 patch is taken.

These three majors are out of scope and would each be their own brainstorm → spec → plan cycle.

## Astro 6.4 compatibility note

Astro 6.4 is backward-compatible for this site. The 6.4 changes are either opt-in
(`markdown.processor`) or deprecations of top-level `markdown.*` plugin options that this
project does not use. `image.dangerouslyProcessSVG` defaults off, which does not affect us:
the festival-laurel SVGs live in `public/` and are served as-is, not processed by Astro.
**No config migration is required.**

## Method

- **Branch:** work directly on `master` (explicitly chosen).
- **Authorship:** commits authored by `monsieurmusclaira` only — no `Co-Authored-By: Claude`
  trailer (the `.mailmap` already canonicalizes the committer to `monsieurmusclaira`).
- Single `npm install` to the target versions; update `package.json` ranges; regenerate
  `package-lock.json` (Approach A — one-shot, justified by the uniformly low risk).

## Verification (same gates as the 2026-05-17 audit)

- `npm run build` → clean (0 warnings/errors), 19 pages, sitemap generated.
- `npx astro check` → 0 errors.
- `npx linkinator ./dist --recurse` → only the known external Vimeo 401.
- `npm audit` → 0 vulnerabilities.
- Built-HTML sanity check: one `<h1>` per page; sitemap present.

## Rollback

All changes are committed to `master`; reverting is a `git revert` of the upgrade commit.
Pushing is out of this agent's scope (MrMochi-only); `master` auto-deploys to GitHub Pages
only when pushed.

## Out of scope

Any major upgrade (Tailwind 4, DaisyUI 5, @astrojs/mdx 6), code refactoring, or config
migration beyond what Astro 6.4 requires (none).

## Success criteria

- Target versions installed and reflected in `package.json` / `package-lock.json`.
- All verification gates green.
- No deprecation warnings introduced by the bumped packages in the build output.
