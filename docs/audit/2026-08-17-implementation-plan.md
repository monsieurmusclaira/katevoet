# katevoet.com — Full-site audit implementation plan

**Date:** 2026-08-17 · **Repo:** `katevoet` (Astro 6.4.6 static site → GitHub Pages, domain katevoet.com)
**Source:** four independent audits (bugs/errors/updates, SEO, UI/UX, performance), cross-verified. The two critical bugs (P0-1, P0-2) were independently re-verified against source before this plan was written.

This document is self-contained: an executing agent needs nothing beyond this file and the repo.

---

## 0. Ground rules for the executing agent

1. **Never run `git push`** in any form. Commit locally; pushing is done by the owner.
2. **Commit author must be `monsieurmusclaira <maes.victor.1@gmail.com>`** (repo-local git config is already set — verify with `git config user.name` before the first commit). **No `Co-Authored-By: Claude` or any AI-attribution trailer** in any commit message.
3. Work directly on `master` (established convention for this repo).
4. Commit in phase-sized batches (one commit per phase below is fine; split P5 into 2–3 if large). Bump `version` in `package.json` once at the end (minor bump: 3.3.0 → 3.4.0).
5. Environment quirks — read before running anything:
   - **Lighthouse cannot run on this machine** (x64 Node on Apple Silicon refuses Chrome). Do not attempt; verify with static analysis + browser preview instead.
   - **`npm run dev` may fail**: node_modules was installed under x64 node (`@rollup/rollup-darwin-x64` only). If the dev server errors under an arm64 node, either use the same node that built it, or verify against the production build: `npm run build && npm run preview`. Prefer the production build for visual verification regardless.
   - The in-app browser preview can silently collapse its viewport to 0×0 → blank screenshots and false measurements. Always `resize_window` explicitly (e.g. 1280×800 / 375×812) and sanity-check `document.documentElement.clientWidth` via JS before trusting any measurement.
   - `@astrojs/check` is deliberately **not** a committed devDependency (its dep chain carries advisories). To type-check: `npm install --no-save @astrojs/check typescript && npx astro check`, then `npm install` to prune. Target: 0 errors, 0 warnings.
6. Verification gate after **every phase**: `npm run build` must complete clean (5 pages). Final gate in §9.

---

## 1. Phase P0 — Critical bugs (do first)

### P0-1 · Lightbox is dead after any client-side navigation (CRITICAL)
`src/components/Lightbox.astro:40-48`

The `is:inline` IIFE captures `overlay`, `img`, `caption`, `counter`, `closeBtn`, `prevBtn`, `nextBtn` **once** at first load. Astro's ClientRouter swaps `document.body` wholesale on navigation and never re-runs already-seen inline scripts, so from the first soft navigation onward every ref points at a detached node. `init()` refreshes only the `images` array. Observable failure: land on `/`, click into a project, click a still → nothing appears, but `document.body.style.overflow = 'hidden'` (line ~84) still executes → **scroll-locked page with no visible UI**; only Escape recovers.

**Fix:** add `transition:persist` to the overlay root so the original element (and the captured refs) survives body swaps:

```astro
<div id="lightbox-overlay" transition:persist class="fixed inset-0 z-[100] ...">
```

Do **not** use `data-astro-rerun` (it would re-run the IIFE and stack a duplicate `document`-level click + keydown listener per navigation). Alternative if `transition:persist` misbehaves: move all `getElementById` calls inside `init()`.

**Verify (production preview):** home → click project card (soft nav — do not hard-reload) → click a still → lightbox opens, arrows/close work, Escape closes, page scrolls. Repeat after a second navigation.

### P0-2 · Mobile menu is dead on every fresh page load (CRITICAL)
`src/components/Header.astro:68-79, 91-92`

`initNav()` runs at module scope (line 91) **and** on `astro:page-load` (line 92) — and ClientRouter fires `astro:page-load` on the initial load too, so the button gets **two** click listeners on a fresh load. Each toggles `hidden`; the pair cancels out. Empirically confirmed: on a fresh 375px load, tapping the burger does nothing (`hidden` stays true). After a soft navigation the header DOM is rebuilt and only one listener binds, so it works — which is why this hid in testing. **Mobile visitors landing on any page have no navigation.**

**Fix:** replace the per-button binding with a single delegated listener bound once at module scope, and keep only `updateNav()` in the per-page hook:

```js
// runs once; survives view transitions; never double-binds
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#mobile-menu-btn');
  if (!btn) return;
  const menu = document.getElementById('mobile-menu');
  if (!menu) return;
  const hidden = menu.classList.toggle('hidden');
  btn.setAttribute('aria-expanded', String(!hidden));
  btn.setAttribute('aria-label', hidden ? 'Open menu' : 'Close menu');
});

function initNav() { updateNav(); }
initNav();
document.addEventListener('astro:page-load', initNav);
```

Additionally: close the menu on `astro:page-load` (add `document.getElementById('mobile-menu')?.classList.add('hidden')` inside `initNav`) and on `Escape` (small keydown handler, also bound once). Both are currently no-ops.

**Verify:** fresh load at 375×812 → burger opens/closes the menu; navigate to About via the menu → burger still works; Escape closes it.

### P0-3 · Vimeo embed: horizontal page scroll on mobile, half-size on desktop, no title, eager load
`src/pages/projects/les-homards-immortels.mdx:27-29` · `tailwind.config.cjs:41`

`aspect-w-16 aspect-h-9` emit **no CSS** — `@tailwindcss/aspect-ratio` is installed but never registered in `plugins`. The iframe falls back to its `width="640" height="360"` attributes: at 375px the page scrolls sideways (`scrollWidth` 640 vs 375 — the only horizontal overflow on the site); at 1280px the sole trailer renders at 50% width. It also lacks a `title` (WCAG failure) and loads the ~1MB Vimeo player eagerly below the fold.

**Fix** (native Tailwind 3 `aspect-video`; no plugin needed):

```html
<div class="hero"><div class="hero-content w-full">
  <div class="w-full aspect-video">
    <iframe src="https://player.vimeo.com/video/206725218"
      title="Les Homards Immortels — trailer, a short film by Kate Voet"
      class="w-full h-full" loading="lazy" frameborder="0"
      allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
  </div>
</div></div>
```

Remove `@tailwindcss/aspect-ratio` from `package.json` devDependencies (nothing else uses it).

**Verify:** 375px — no horizontal scroll on the page; 1280px — trailer spans the content width; iframe network request only fires near scroll-into-view.

---

## 2. Phase P1 — Dead weight & repo hygiene

### P1-1 · Delete `public/video/` (87 MB shipped, referenced by nothing)
Contains 6 encodes of one leftover clip (`SeeThrough.mp4` 31 MB, `seethrough.gif` 23 MB, …) plus posters. `grep -rn "seethrough" src/` (case-insensitive) → zero hits. Every deploy uploads it and it counts toward the GitHub Pages 1 GB cap. Delete the whole directory (recoverable from git history).

### P1-2 · Delete the stray `dist (1)/` directory
Gitignored but inside the project root, so `astro check` type-checks its minified JS — it is the source of **all 19 phantom hints**. Delete it; optionally add `"exclude": ["dist", "dist (1)"]` to `tsconfig.json`.

### P1-3 · Prune unreferenced source images (biggest dist win)
Four components share the same glob: `src/components/BaseHead.astro:19-21`, `ProjectHero.astro:5-7`, `ContentPicture.astro:6-8`, `ProjectCard.astro:5-7`:

```js
import.meta.glob('/src/assets/img/**/*.{png,jpg,jpeg,webp,avif,gif}')
```

Vite **emits an asset for every glob key** whether awaited or not. The glob matches 225 images; pages reference ~47. Result: 180.5 MB of unreferenced originals + 22.6 MB of orphaned transforms in `dist/_astro/` (96% of dist is unreachable bytes). Additionally Astro emits the untransformed original of every *referenced* image as the `src` fallback — including 2+ MB 4K PNG masters.

Steps (in order):
1. **Inventory referenced images:** grep all `src=` / `image:` / frontmatter paths across `src/pages` and `src/components`; build the list of ~47 referenced files under `src/assets/img/`.
2. **Delete every unreferenced file** in `src/assets/img/` (incl. `src/assets/EVER_SINCE_cover.png`, the whole `alonggoodbye/stills/OG/` masters dir if unreferenced, the ~120 unused `thetearsofthings/stills/webp/` files, and the duplicated `src/assets/img/leshomardsimmortels/laurels/` — the live laurels are served from `public/`).
3. **Downscale oversized masters that remain:** any referenced source wider than 1920px (the 4K PNGs) → re-encode to 1920w WebP (e.g. `npx sharp-cli` or `sips`+`cwebp`), update the referencing paths' extensions if they change, and keep aspect ratios. This shrinks the emitted `src` fallbacks and the lightbox payload (see P4-7).
4. Rebuild and confirm: `du -sh dist` should land around **15–25 MB** (from 303 MB), 5 pages, zero missing-asset references (spot-check with grep of built HTML srcsets against files present).

Do **not** widen or keep the globs "for future images" — narrowing the asset tree is the fix; the glob pattern itself can stay.

### P1-4 · Remove dead dependencies and dead code
- `package.json`: remove `sass` (no .scss/.sass files), `astro-google-analytics` (never imported — note for owner: the site currently has **no analytics at all**; wiring GA4 is a product decision, not part of this plan), `@astrojs/markdown-remark` (transitive, needn't be declared), `@astro-community/astro-embed-youtube` + delete `src/components/ContentYoutube.astro` (imported by nothing), and `@tailwindcss/aspect-ratio` (per P0-3).
- Delete `src/pages/_components.ts` (exported MDX component map, imported by nothing).
- Remove unused imports of `CreditsItem`/`FestivalsItem` from `the-tears-of-things.mdx:8-9` and `les-homards-immortels.mdx:8-9` — **unless** P5-4 adopts those components on those pages (preferred), in which case they become used.
- Delete all 9 `data-te-lightbox-init` attributes across the three project MDX files (inert leftovers from Tailwind Elements; the working hook is `data-lightbox`).
- `tailwind.config.cjs:18-20`: the top-level `container:` block is silently ignored (belongs under `theme:`) and the class is unused — delete it.

### P1-5 · GitHub Actions workflow
`.github/workflows/deploy.yml`: add

```yaml
concurrency:
  group: "pages"
  cancel-in-progress: true
```

Action versions (`checkout@v6`, `withastro/action@v6`, `deploy-pages@v5`) and `node-version: 22` are fine.

---

## 3. Phase P2 — Dependency updates

### P2-1 · Safe bumps (do now)
`astro` 6.4.6→6.4.8, `postcss` →8.5.26, `autoprefixer` →10.5.4 (all patch, in-range: `npm update astro postcss autoprefixer`). Then `npm audit fix` (non-breaking — clears postcss/svgo/vite/immutable/js-yaml/nanoid advisories). Rebuild + spot-check after.

### P2-2 · Deferred majors (owner decisions — do NOT do without approval)
- **Astro 7.2.2 + @astrojs/mdx 7.x** (must move together): the only route to clearing the three high-severity Astro XSS advisories. Practical exploitability here is ~nil (no user input, no islands, no `transition:*` directives), but `npm audit` stays red until then. **Recommend scheduling as its own follow-up task.**
- Tailwind 4 / DaisyUI 5: previously deferred by owner; unchanged recommendation. Note P4-4 (dropping DaisyUI entirely) would moot the DaisyUI half.

---

## 4. Phase P3 — SEO

### P3-1 · Rewrite the three truncated meta descriptions (HIGH)
The frontmatter `description` in all three project MDX files was machine-clipped mid-sentence with a literal `...` (e.g. "being alon..."), and it feeds `<meta name=description>`, `og:description`, and `twitter:description`. Replace (line 5 of each file):

| File | New description |
|---|---|
| `a-long-goodbye.mdx` | `A Long Goodbye is an interactive VR film by Kate Voet following Ida, a pianist living with dementia. Winner of the Venice Immersive Achievement Prize 2025.` |
| `the-tears-of-things.mdx` | `The Tears of Things (2021), a short film by Kate Voet. Unable to speak after her marriage crumbles, Ana writes her husband a diary letter about silence.` |
| `les-homards-immortels.mdx` | `Les Homards Immortels (2017), a short film by Kate Voet. Two minds meet again after a separation, alone and in search of a connection. 12 festival awards.` |

### P3-2 · Lengthen titles / add the money keyword (no page currently says "film director" in a title)

| Source | New title |
|---|---|
| `src/config.ts:1` (`SITE_TITLE`) | `Kate Voet — Belgian Film Director & Screenwriter` |
| `src/pages/index.astro:7` | use `SITE_TITLE` (it currently hardcodes the title — dedupe) |
| `src/pages/about.mdx:3` | `About Kate Voet — Belgian Film Director & Screenwriter` |
| `a-long-goodbye.mdx:3` | `A Long Goodbye — VR Film by Kate Voet \| Venice 2025` |
| `the-tears-of-things.mdx:3` | `The Tears of Things — Short Film by Kate Voet (2021)` |
| `les-homards-immortels.mdx:3` | `Les Homards Immortels — Short Film by Kate Voet (2017)` |

### P3-3 · Fix trailing slashes on project links (every card click currently 301s)
`src/components/ProjectGrid.astro:22,30,38`: `url="/projects/a-long-goodbye"` → `url="/projects/a-long-goodbye/"` (all three). Add `trailingSlash: 'always'` to `astro.config.mjs` to enforce. (Sitemap + canonicals already use the slashed form; header/footer already use `/about/`.)

### P3-4 · Structured data (HIGH-value)
Currently one thin `Person` node repeated on all 5 pages (`BaseHead.astro:33-47`), no `@id`, `url` hardcoded to homepage. Implement:

1. In `BaseHead.astro`: give `Person` `@id: "https://katevoet.com/#kate-voet"`, `url` → `/about/`, and enrich with `jobTitle: ["Film Director","Screenwriter"]`, `nationality`/Brussels address, `alumniOf` (University of Amsterdam, LUCA School of Arts, The New School), `knowsAbout`, top `award`s, and `sameAs` (the Instagram, LinkedIn and Henneman Agency URLs already on the About page).
2. Add an optional `schema` prop to `BaseHead`/`BaseLayout` (serialize any object passed into an extra `<script type="application/ld+json">`).
3. Per page, pass:
   - **Project pages: a `Movie` node each** with `@id`, `name`, `url`, `datePublished`, `genre`, `countryOfOrigin`, `description` (the full synopsis from the page), `image` (the page's og:image URL), `director: {"@id": ".../#kate-voet"}`, `actor`, `musicBy`/`editor`, `productionCompany`, `award` (all named awards from each page's frontmatter/body), `funder` (A Long Goodbye), and for Les Homards a `trailer: VideoObject` with `embedUrl: "https://player.vimeo.com/video/206725218"`. All values must come from the page's existing MDX frontmatter/body — invent nothing. **A Long Goodbye credits a co-director on-page: include that second `director` entry exactly as the name appears in the on-page credits.**
   - **Homepage: `ItemList`** of the three project URLs (positions 1–3).
   - **About: `ProfilePage`** with `mainEntity: {"@id": ".../#kate-voet"}`.
   - **Project pages: `BreadcrumbList`** (Home → Work → film).
4. Validate every page's JSON-LD with a schema validator (or at minimum `JSON.parse` each emitted block from dist).

### P3-5 · Complete the Open Graph/Twitter set
`src/components/BaseHead.astro:71-85`. Capture dimensions from the existing `getImage()` result (currently discarded) and add: `og:site_name` ("Kate Voet"), `og:locale` (`en_US`), `og:image:width`/`og:image:height` (**per-page** — the four generated images are 1200×675/675/723/600), `og:image:type`, `og:image:alt` and `twitter:image:alt` (derive from page title, e.g. `"${title} — film still"`). Optional: `og:type="video.movie"` on project pages, `"profile"` on About. Also delete the non-standard `<meta name="title">` (line 68).

**Twitter handle decision (owner):** `twitter:site`/`twitter:creator` are hardcoded to `@katevoet`, but no page links an X account. If the handle is Kate's, add it to `Person.sameAs`; if not, **delete both meta tags** (og:* + twitter:card alone render a valid card). If unverifiable, delete them — wrong attribution is worse than none.

### P3-6 · Les Homards Immortels: get the festival record out of the SVGs (HIGH)
The page has 81 crawlable words; its entire awards/festival history exists only as 13 laurel `<img>`s. Add a text Awards/Festivals section (use `FestivalsItem`, matching a-long-goodbye's pattern) listing: Filmfestival Oostende 2017, Ciné Privé 2017, Black Canvas 2018, Festival Cine La Orquídea 2018, Brussels Independent Film Festival 2018, Festival Internacional de Escuelas de Cine 2018, Hong Kong Arthouse Film Festival 2018, Venice Film Week 2018, Amsterdam Independent Film Festival 2018, UITKORT, Wunderground 2018, CUT:TO Gent 2018 (Best Cinematography — cross-check against the page), Reykjavík International Film Festival 2019 (laurel exists in `public/img/leshomardsimmortels/laurels/` but is not rendered — add it). Keep the laurels as the visual layer. Fix the copy-pasted laurel alt at `les-homards-immortels.mdx:99` (says "Oostende 2017", is Venice Film Week 2018) and the "Independant" misspellings (lines 96, 100).

### P3-7 · Homepage crawlable text (76 words today; "Belgian"/"Brussels"/"Venice" appear nowhere in body copy)
1. `src/components/Hero.astro:29`: eyebrow → `Belgian Film Director & Screenwriter`; extend the tagline to mention Brussels.
2. `src/pages/index.astro:8`: add a short intro block (60–90 words) between `<Hero />` and `<ProjectGrid />`, condensed from the About bio: Belgian director/screenwriter based in Brussels; shorts *Les Homards Immortels* (2017) and *The Tears of Things* (2021); VR film *A Long Goodbye* awarded the Venice Immersive Achievement Prize at the 82nd Venice Film Festival; currently developing two fiction features. Style it consistently with About's body copy (`prose` / `text-body`). This doubles as the homepage contact/context block (see P5-9).

### P3-8 · Custom 404 page
Add `src/pages/404.astro` using `BaseLayout`: a film still, `<h1>Page not found</h1>`, links to `/` and `/about/`, plus `<meta name="robots" content="noindex">`. (Old trimmed-project URLs currently dead-end on GitHub's generic 404.)

### P3-9 · Small SEO items
- **Favicon set:** generate `apple-touch-icon.png` (180×180) and `favicon.ico` (32×32) from `public/favicon.svg`; add both `<link>`s and `<meta name="theme-color" content="#2664aa">` to `BaseHead`.
- **Sitemap `lastmod`:** add a `serialize` fn to the sitemap integration in `astro.config.mjs` stamping build date.
- **Cross-links:** add a "More work" block at the foot of each project page linking the other two films (trailing slashes). Kills the dead-end problem (project pages currently link only home/about).
- **Alt text:** give the 3–5 hero/feature images per page distinct descriptive alts naming subject + film (pattern already exists at `Hero.astro:10`); `about.mdx:12`'s `"Film still"` must name the film. Gallery grids may keep a shared alt (but see P5-12 for the lightbox caption consequence). `ProjectCard.astro:27`: `alt={title}` duplicates the adjacent `<h3>` — use `alt=""` (decorative; the card link is already labeled).
- **social.jpg** is 730 KB — re-export at 1200×630 JPEG q80 (~150 KB target), same filename.

---

## 5. Phase P4 — Performance

### P4-1 · Laurels: lazy + optimize
`les-homards-immortels.mdx:92-103`: 13 SVGs, 177 KB raw, rendered at 192px, eager, no dimensions. Add `width="192" height="108" loading="lazy" decoding="async"` to each; run SVGO over `public/img/leshomardsimmortels/laurels/` (expect 60–80% reduction). (A `<symbol>` sprite is optional gold-plating — skip unless trivial.)

### P4-2 · Self-host fonts; delete the unused `Caveat` family
`BaseHead.astro:60-64` loads Google Fonts render-blocking across a 3-hop chain, and requests `Caveat`, which nothing in the codebase uses (verified: zero references outside the `<link>` itself). Replace with `@fontsource` packages: `@fontsource/cormorant-garamond` (300, 400, italic 300/400) + `@fontsource/montserrat` (300, 400), imported in `BaseLayout.astro`; add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the two above-the-fold faces (Cormorant 300 + Montserrat 400 — resolve the hashed URLs via the fontsource file imports). Remove the three Google Fonts `<link>`s. Text is the LCP element on every hero; expected 150–400 ms LCP gain on mobile.

### P4-3 · Replace AOS with a ~15-line IntersectionObserver
AOS costs 14.7 KB JS + 26 KB CSS on every page for exactly two effects (`fade`, `fade-up`) on ten elements, plus a full-document `refreshHard()` rescan per navigation. Replace: keep the `data-aos` attributes as hooks; in `BaseLayout`, a module script with an `IntersectionObserver` that adds an `.in-view` class (re-run registration on `astro:page-load`); ~10 lines of CSS with `@keyframes` for the two fades; honor `prefers-reduced-motion` (the current `disable: reduceMotion` guard's behavior must be preserved); remove `aos` from package.json and both imports from `BaseLayout.astro:7,36-42`.
**Include the no-JS fallback** (also fixes the audit's no-JS blank-page finding): style the hidden state via a class the script adds (`.js [data-aos]`-gated), or add `<noscript><style>[data-aos]{opacity:1!important;transform:none!important}</style></noscript>` — with a custom implementation, prefer gating on a `js`-class added to `<html>` by an inline script, which is robust by construction.

### P4-4 · Drop or prune DaisyUI (owner-approved approach: prefer drop)
DaisyUI ships ~50 KB of unpurgeable component CSS (menus, tabs, cards, btns…) of which the site uses only `.hero`/`.hero-content` (trivial flex wrappers) and the theme's color tokens (duplicated in `theme.extend.colors` already). As part of P5-1's section-rhythm work, replace `.hero`/`.hero-content` usage in the three project MDX files + about with plain Tailwind (`flex flex-col items-center` + explicit padding/max-widths), then remove `daisyui` from the config and package.json, and move the `data-theme="kate"` attribute off `<html>` (`BaseLayout.astro:19`) since nothing will consume it. Expected: stylesheet 79.6 KB → ~20 KB raw. **If this feels too invasive mid-plan, do P5-1 first and fold this in — the two touch the same lines.**

### P4-5 · `/about/` hero: cap the widths ladder
`about.mdx:23`: `widths={[800,1200,1920]}` where the 1920w candidate is a 170 KB full-res re-encode (source is only 1920px). Change to `widths={[800,1200,1600]}` and add `quality={70}`. Expect the LCP image to drop to ~55–70 KB.

### P4-6 · AVIF for gallery stills
`ContentPicture.astro:15-24` and `ProjectCard.astro`: switch `<Image>` → `<Picture formats={['avif']} fallbackFormat="webp">`. Grain-heavy film stills compress 25–35% better in AVIF. (Build time rises per-image; after P1-3's pruning the transform count is small, so net build time stays fine.)

### P4-7 · Lightbox should not download 4K masters
`Lightbox.astro:101`: `img.src = currentImg.src` fetches the largest fallback (multi-MB before P1-3, still the largest after). Use `currentImg.currentSrc || currentImg.src`, or copy the trigger's `srcset`/`sizes` onto the lightbox img.

### P4-8 · Keep (deliberate non-changes)
Record as decided, do not "optimize": `<Image>` usage/`widths`/`sizes`/eager-hero-lazy-gallery split is correct; ClientRouter + `prefetch: true` stays (small cost, snappier nav); GitHub Pages forces `max-age=600` — no cache work is worthwhile on this host.

---

## 6. Phase P5 — UI/UX

Design-language guardrails: cream `#faf8f5` / charcoal, Cormorant Garamond display, Montserrat body, generous whitespace, quiet motion. Every change below should read as *more* restrained, not busier.

### P5-1 · Project-page vertical rhythm (HIGH — biggest feel win)
Project `section.hero` blocks have 0 padding / 0 gap (measured); homepage/About use `py-24 md:py-32`. Add consistent breathing room: `py-20 md:py-28` per section (via a `main > section` rule in `global.css` or per-section classes while doing P4-4's de-DaisyUI pass), and `gap-6 md:gap-8` on stills grids to match `ProjectGrid`.

### P5-2 · A Long Goodbye closing stills: 165px thumbnails on mobile
`a-long-goodbye.mdx:113-118`: the section lacks the grid classes its siblings have. Add `grid grid-cols-1 md:grid-cols-2 gap-3` to that `hero-content` div.

### P5-3 · Project h1 to display scale
`ProjectHero.astro:45`: `text-4xl md:text-5xl` renders the film title at exactly homepage-section-h2 size (45px), vs 102px for the homepage h1. Change to `text-5xl md:text-7xl` (or `text-display` if it fits the overlay), and remove the `prose` wrapper on line 44 (its 720px `max-width` fights the layout). *Note: the current size was set in a recent fix round — this is a deliberate escalation based on measured hierarchy, not a revert.*

### P5-4 · One section-heading treatment; real h2s everywhere
"Awards"/"Festivals"/"Markets" render at 15px right-aligned gray (`FestivalsItem.astro:5`) — indistinguishable from data. About and two of three project pages have **no h2 at all** (labels are styled `<p>`s). Standardize: an eyebrow (`text-caption tracking-[0.2em] text-warmgray uppercase`) + `<h2>` at `text-2xl md:text-3xl text-charcoal` (Cormorant via global h2 rule). Apply by:
- Restyling `FestivalsItem`'s heading branch;
- `the-tears-of-things.mdx` (~lines 154, 160): replace the `<p class="text-right font-bold">Awards</p>` pattern with `FestivalsItem heading="Awards"` (component already imported);
- `les-homards-immortels.mdx`: add h2s for Credits + the new P3-6 Awards/Festivals section;
- `about.mdx` (~lines 47, 62, 68, 76): promote "Get in touch", "Representation", "Follow" to styled `<h2>`;
- Add a "Credits" h2 on all three project pages.
Also normalize the label/value emphasis convention (labels `font-light`, values `font-bold`) — `the-tears-of-things.mdx` currently inverts it between its credits and awards blocks.

### P5-5 · Credits/festival grids: stack on mobile
The `grid grid-cols-2 gap-2` pairs yield two 169px columns at 375px with 6-line wraps and 17 empty spacer `<p>`s. Change to `grid-cols-1 md:grid-cols-[minmax(0,10rem)_1fr] gap-x-6 gap-y-1`, labels `md:text-right`; drop the spacer `<p>`s (use `gap-y` groupings instead). Prefer routing through `CreditsItem`/`FestivalsItem` so it's fixed once.

### P5-6 · Header: drive color from the hero, add a scrim
`Header.astro:62` flips at `0.8 * innerHeight`, which mismatches About's `h-[70vh]` hero (~150px window of white-on-cream = invisible nav) and leaves the charcoal logo sitting on raw film stills with no backdrop. Fix: in `initNav`, observe the page's hero element (`document.querySelector('[data-hero]')` — add that attribute to the three hero components) with an `IntersectionObserver`, or compute `hero.getBoundingClientRect().bottom <= headerHeight`; and once scrolled past the hero add `bg-cream/85 backdrop-blur-sm` to `#site-header` (remove when back at top). Also fix the rAF latch at `Header.astro:83-89`: `ticking` never resets if the tab is backgrounded mid-scroll — reset it in the rAF callback *and* on `visibilitychange`, or drop the flag for a plain rAF loop reading `scrollY`.

### P5-7 · Lightbox arrows visible + keyboard entry
- `Lightbox.astro:15,22`: drop `opacity-0 hover:opacity-100` (arrows are invisible until hover → nonexistent on touch). Use `text-white/60 hover:text-white`; disabled state via a `.opacity-30 pointer-events-none` class toggle in `updateButtons()` instead of inline opacity.
- `Lightbox.astro:36`: counter `text-white/40` at 11px = 3.8:1, fails AA → `text-white/60`.
- Keyboard entry: gallery imgs are mouse-only. In `ContentPicture.astro` wrap the `data-lightbox` image in a `<button type="button" class="block w-full" aria-label="Enlarge image">` (adjust the lightbox's delegated click handler to match `button > img[data-lightbox]` or put `data-lightbox` on the button and read its child img). Verify Enter opens, focus returns on close (focus-restore logic already exists and is good).

### P5-8 · Focus visibility + skip link + active nav + tap targets
- `global.css`: add `:focus-visible { outline: 2px solid #3a5a7c; outline-offset: 3px; }` with a white variant for on-image/header contexts.
- `BaseLayout.astro:28`: `<main id="main">`; add `<a href="#main" class="sr-only focus:not-sr-only ...">Skip to content</a>` as body's first child.
- Header links: set `aria-current="page"` (compare `location.pathname` in `initNav`) + a persistent underline on the active link.
- Tap targets at 375px are 19–23px tall: add `p-2 -m-2` to `#mobile-menu-btn` and `py-2` to footer/mobile-menu links.

### P5-9 · Contact affordance + link visibility
- Footer (`Footer.astro`): show `hi@katevoet.com` as visible text (keep the mailto), and add Instagram/LinkedIn links (URLs are on the About page).
- Homepage: the P3-7 intro block doubles as context; optionally end the page with a one-line contact strip above the footer ("For enquiries — hi@katevoet.com").
- About body links (`about.mdx:63-79`) are visually identical to prose: give in-prose links a resting underline (invert `.link-underline` to default-on for prose contexts) or `text-slateblue`.

### P5-10 · Project grid: resolve the orphan third card
`ProjectGrid.astro:16`: 3 cards in `md:grid-cols-2` leaves a 535px hole. **Recommended:** make the first project (A Long Goodbye — the flagship) full-width `md:col-span-2` with a wider aspect, and the remaining two share the second row. (Alternative: `md:grid-cols-3`.) Pick one; keep hover behavior consistent.

### P5-11 · ProjectCard hover: remove the duplicate CTA
`ProjectCard.astro:46-60`: hover shows two "View Project" labels simultaneously. Keep the persistent bottom arrow CTA; reduce the hover overlay to a plain darkening scrim (delete the centered bordered button span). Also raise the gold year/genre (`:41`) legibility: deepen the bottom gradient to `from-black/80` (keeps the 9:1 ratio regardless of the still behind it).

### P5-12 · Type scale floor
`global.css:11-16` sets `html { font-size: 15px }`, dragging `.text-caption` to 11.25px. Raise base to 16px and re-check the hero clamps visually (they use vw-dominant `clamp()`, so impact is limited to text sizes); at minimum raise `.text-caption` to `0.8125rem`. Re-verify the P5-7 contrast numbers after (larger text lowers required ratios).

### P5-13 · Footer year script
`Footer.astro:31-34`: the `is:inline` year-refresh script never re-runs after soft navigation (build-year shows again). Add `data-astro-rerun` to that script tag (safe: idempotent, binds nothing).

---

## 7. Explicit owner decisions (do not resolve unilaterally)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Astro 7 + mdx 7 major (clears XSS advisories) | Do as separate follow-up |
| D2 | Tailwind 4 / DaisyUI 5 majors | Keep deferred; P4-4 removes DaisyUI instead |
| D3 | `@katevoet` Twitter handle real? | If unverifiable → delete the two meta tags |
| D4 | Analytics (currently none) | Owner call; not a perf need |
| D5 | Homepage grid layout for 3 cards (P5-10) | Flagship full-width + 2-up row |
| D6 | Homepage intro copy (P3-7) | Draft provided; owner may reword |

Everything else in this plan is pre-approved scope.

## 8. Suggested commit batching

1. `P0: fix lightbox persistence, mobile menu binding, Vimeo embed`
2. `P1: remove dead media, deps and code; prune unused source images`
3. `P2: dependency patch bumps + audit fix; workflow concurrency`
4. `P3: SEO — descriptions, titles, structured data, OG set, 404, content`
5. `P4: performance — fonts, AOS replacement, DaisyUI removal, images`
6. `P5: UI/UX — rhythm, headings, header, lightbox, focus, grid` (split if large)
7. `Bump version to 3.4.0`

## 9. Final verification checklist

- [ ] `npm run build` — clean, exactly 5 pages (+ 404.html appears with P3-8 → 6 outputs)
- [ ] `du -sh dist` ≤ ~25 MB
- [ ] `npx astro check` (via `--no-save` install) — 0 errors, 0 warnings, 0 hints from project source; `npm install` after to prune
- [ ] `npm audit` — 0 after P2-1 except the deferred-Astro-7 advisories (list them in the report)
- [ ] `git status` clean of stray files; author on every commit is `monsieurmusclaira`; no AI trailers; **nothing pushed**
- [ ] Production preview (`npm run preview`), viewport explicitly sized:
  - [ ] 375×812: no horizontal scroll on any of the 5 pages; burger menu opens/closes on a **fresh load**; menu closes after navigating
  - [ ] Soft-nav home → project → open lightbox → arrows visible and working, Escape closes, scroll restored; repeat after 2nd navigation
  - [ ] Keyboard-only: skip link appears on Tab; gallery images reachable and Enter opens lightbox; visible focus rings throughout
  - [ ] Each page: unique title/description (correct lengths, no `...`), valid JSON-LD (parse every block), og:image + width/height/alt present
  - [ ] Header never renders white-on-cream at any scroll position on About; scrim visible over stills
  - [ ] Trailer on Les Homards spans content width, has title, lazy-loads
- [ ] Screenshot evidence (desktop + mobile of at least homepage + one project page) attached to the final report
