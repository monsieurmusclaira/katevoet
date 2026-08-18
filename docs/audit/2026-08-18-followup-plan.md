# katevoet.com — Round-2 follow-up plan (post-implementation review)

**Date:** 2026-08-18 · **Context:** commits `b215861..d540349` implemented `docs/audit/2026-08-17-implementation-plan.md`. Three independent reviews (code diff, built output/SEO, live browser) verified the work. **Verdict: the implementation is solid** — both critical P0 fixes work (verified live: mobile menu on fresh load, lightbox after repeated soft navigations), dist is 12 MB, all metadata/structured data is factually accurate, all owner decisions were respected, commits are clean. This plan covers the small set of defects and polish items the reviews surfaced.

Ground rules are unchanged from §0 of the 2026-08-17 plan: **never `git push`**; author `monsieurmusclaira <maes.victor.1@gmail.com>`; **no AI attribution in commits**; work on `master`; `npm run build` clean after each group; environment quirks in that §0 still apply (no Lighthouse; verify against `npm run build` + preview, not the dev server).

Suggested batching: one commit for §1 (fixes), one for §2 (polish), then bump version to **3.4.1**.

---

## 1. Fixes (do all)

### R2-1 · Broken internal link — user-visible 404 (HIGH)
`src/pages/projects/the-tears-of-things.mdx:140` — the "More work" block links `/projects/les-homards-immortals/` (typo: **immortals** → **immortels**). Confirmed live 404; it is the only broken link on the site. One-character fix.

After fixing, add a guard so this class of bug can't ship silently: a tiny script `scripts/check-links.mjs` that reads every `dist/**/*.html`, collects internal `href="/..."` values, and exits non-zero if any doesn't map to a file in `dist` (treat `/x/` → `dist/x/index.html`; ignore `mailto:`, `http(s):`, `#`). Run it manually after build as part of §4 verification (do NOT wire it into package.json scripts or CI — keep the toolchain unchanged).

### R2-2 · Scroll-reveal animation dies after the first client-side navigation (HIGH)
`src/components/BaseHead.astro:105` adds class `js` to `<html>` via an inline script; Astro's ClientRouter replaces the root element's attributes on every soft navigation and never re-runs the script, so `.js [data-aos] { opacity: 0 }` stops applying and all reveals are dead for the rest of the session (verified live, reproduced three times). Two-line fix, both halves:
1. Add `data-astro-rerun` to that inline script tag.
2. Belt-and-braces: in the reveal script in `src/layouts/BaseLayout.astro`, make the first statement of the `astro:page-load` handler `document.documentElement.classList.add('js')`.

**Also verify the reveal system works at all in a real browser** — the review environment could not deliver IntersectionObserver callbacks, so the observer→`.in-view` path is unverified end-to-end. After the fix, in the browser preview: hard-load a project page, scroll, and confirm below-fold `[data-aos]` elements transition to visible (check `classList` gains `in-view` / computed opacity becomes 1). If elements stay at opacity 0, treat it as a critical bug in the reveal script and fix before anything else.

### R2-3 · ContentPicture collapses inside flex parents (HIGH)
`src/components/ContentPicture.astro:13` — the root `<section class="overflow-hidden">` has no width. On three pages it sits directly in `flex flex-col items-center` wrappers (`a-long-goodbye.mdx:78`, `the-tears-of-things.mdx:63`, `les-homards-immortels.mdx:74`), where a flex item shrink-wraps; the inner `w-full` image then resolves against a zero/indeterminate width. Measured 0×0 in the review pane (lead feature still on all three project pages); at best a real browser self-heals after image load with a visible 0→full-width layout shift.
Fix: `<section class="overflow-hidden w-full">`. Then verify in the preview that the feature still under each project hero renders full content width at 1280 and 375, and that gallery-grid instances are unchanged.

### R2-4 · Gallery buttons hide every image's alt from screen readers (MEDIUM)
`src/components/ContentPicture.astro:14` — `aria-label="Enlarge image"` on the wrapping `<button>` **overrides** the subtree, so all 20+ stills per page announce identically and the descriptive alts are never heard.
Fix: `aria-label={`Enlarge image: ${alt}`}`.

### R2-5 · Structured-data typing and accuracy (MEDIUM)
1. **Add `@type` to nested entities** in all three project MDX schema blocks and `Person.alumniOf` in `BaseHead.astro`: every `director`/`actor`/`musicBy`/`editor` entry → `{"@type": "Person", "name": "…"}` (keep existing `@id` refs to Kate as-is); every `productionCompany`/`funder`/`alumniOf` entry → `{"@type": "Organization", …}` (`CollegeOrUniversity` for alumniOf is fine if already typed).
2. **Les Homards `Movie.award` overstates**: only `CUT:TO Gent 2018 — Best Cinematography` is an award; the other 12 entries are festival selections. Keep only the real award in `award`; the selections stay as on-page text (optionally list festivals under `Movie.subjectOf` — or simply omit them from schema). Correct the meta description in `les-homards-immortels.mdx:5` from "12 festival awards" to "selected at 13 international festivals" (factual-accuracy correction — pre-approved).
3. **Homepage `ItemList`**: change each `itemListElement[].item` (bare URL string) to `url` on the `ListItem`.
4. **BreadcrumbList**: position 2 "Work" points at the same URL as position 1 "Home" — drop position 2 (Home → film title).
5. Re-validate: `JSON.parse` every emitted block in dist after rebuild.

### R2-6 · Repeated "Film record" eyebrow (MEDIUM)
`src/components/FestivalsItem.astro:6` hardcodes the eyebrow `Film record` above **every** section heading — it renders 5× on a-long-goodbye. Make it a prop (`const { heading, eyebrow, festivalname } = Astro.props`) rendered only when passed, and set sensible per-section values at the call sites (e.g. Credits → "The team", Awards → "Recognition", Festivals → "Selections", Markets → "Industry", With the support of → "Funding") — or pass none and let the h2 stand alone. Also fix `about.mdx:78-79` where the eyebrow duplicates the h2 text ("Representation" above "Representation") — drop or vary that eyebrow.

## 2. Polish (do all; small)

- **R2-7** `src/pages/about.mdx:5`: meta description is 172 chars (SERP truncation) — trim to ≤160 (e.g. drop "the 82nd").
- **R2-8** `src/components/BaseHead.astro:120,131`: `og:image:alt` template appends "— film still" unconditionally ("Page not found — Kate Voet — film still"). Only append it when the page passed a project image (e.g. when `pageType === 'video.movie'` / an `image` prop exists and the page is a project); otherwise use the bare title.
- **R2-9** 404 header flash: the header ships white text server-side and only turns charcoal via JS; on `/404` (no hero) it's white-on-cream until hydration. Render charcoal initially when the page has no `[data-hero]` (e.g. a prop on `Header`/`BaseLayout` set by `404.astro`, or default charcoal + flip to white when a hero IS present — the latter inverts the flash to dark-on-image, which is the less-bad direction; pick one, verify both hero and non-hero pages at scroll 0).
- **R2-10** Lightbox arrows wash out over bright stills (`Lightbox.astro` chevrons, `stroke-width="1"`, overlapping the image edge): raise to `stroke-width="1.5"` and add a subtle backing (e.g. `rounded-full bg-charcoal/40 backdrop-blur-sm` on the button). Keep the disabled-state class logic as is.
- **R2-11** Project hero synopsis readability on pale stills: deepen the scrim mid/bottom stops in `ProjectHero.astro:38` slightly (e.g. `via-black/30 to-black/75`) — verify on Les Homards and A Long Goodbye at 375px that the white copy is comfortably readable and dark stills don't go muddy.
- **R2-12** Delete `public/svg/arrowdown.svg` (only unreferenced asset in dist).
- **R2-13** `package.json`: raise declared floors to match tested versions (`astro` `^6.4.8`, plus postcss/autoprefixer to their installed versions). Run `npm install` after so the lockfile stays consistent.
- **R2-14** Commit the `.claude/launch.json` addition (the `katevoet-preview` entry) so the tree is clean — include it in the polish commit.

## 3. Out of scope — owner items (do NOT act)

- Co-director's name now appears in A Long Goodbye's Movie schema. It matches the on-page credits exactly (per the original plan's instruction) — flagged for the owner's awareness only; no action.
- Astro 7 major (D1) remains deferred; `npm audit` shows 4 advisories, all fixed only by astro@7.
- Analytics (D4) still absent by choice.

## 4. Verification checklist (after both commits)

- [ ] `npm run build` clean, 6 outputs; `du -sh dist` ≈ 12 MB
- [ ] `node scripts/check-links.mjs` → zero broken internal links (specifically: no `immortals` anywhere: `grep -ri immortals src dist` → empty)
- [ ] Preview at 1280×800 + 375×812 (explicitly resize; sanity-check `clientWidth`):
  - [ ] Feature still under each project hero renders full content width on all three project pages, both viewports
  - [ ] Hard-load a project page → scroll → below-fold sections animate in; then soft-nav to another project → sections still animate (the `.js` class survives; check `document.documentElement.classList` after nav)
  - [ ] Lightbox arrows discernible over the brightest A Long Goodbye still (screenshot)
  - [ ] 404 page: header text readable at scroll 0
- [ ] Every emitted JSON-LD block parses; Les Homards `award` contains only CUT:TO; spot-check one `actor` entry has `@type: Person`
- [ ] `git status` clean; both commits authored `monsieurmusclaira`, no AI trailers; version 3.4.1; **nothing pushed**
