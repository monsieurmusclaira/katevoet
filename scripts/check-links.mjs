// Guard: verify every internal href in the built output maps to a real file.
// Run manually after `npm run build`:  node scripts/check-links.mjs
// Treats "/x/" as dist/x/index.html; ignores mailto:, http(s):, protocol-relative
// and fragment-only hrefs. Exits non-zero on the first broken link found.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(distDir);
const fileSet = new Set(files);

function exists(target) {
  const resolved = normalize(join(distDir, target));
  if (fileSet.has(resolved)) return true;
  if (fileSet.has(join(resolved, 'index.html'))) return true;
  return false;
}

const htmlFiles = files.filter((f) => extname(f) === '.html');
const hrefRe = /href="([^"]+)"/g;
let broken = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(hrefRe)) {
    const href = match[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue; // external / mailto / #handled below
    const pathOnly = href.split('#')[0];
    const target = pathOnly.replace(/\/$/, '') || '/';
    if (!exists(target)) {
      console.error(`BROKEN: ${file.replace(distDir, '')} -> ${href}`);
      broken++;
    }
    // Site is built with trailingSlash: 'always' — an extension-less internal
    // href without a trailing slash (e.g. "/about") would 404 on GitHub Pages.
    if (pathOnly !== '/' && !pathOnly.endsWith('/') && extname(pathOnly) === '') {
      console.error(`BROKEN: ${file.replace(distDir, '')} -> ${href} (missing trailing slash)`);
      broken++;
    }
  }
}

if (broken > 0) {
  console.error(`${broken} broken internal link(s) found in dist`);
  process.exit(1);
}
console.log(`check-links: ${htmlFiles.length} HTML files, 0 broken internal links`);
