// Pre-publish gate for the public Oikos tree. Exits non-zero on any blocker.
// Prints file names and rule names only, never the matched secret or deny-listed term itself.
//
//   node scripts/check-release.mjs [dir] [--strict]
//
// --strict also fails when gitignored local-only files (private art inputs, handoff notes,
// the deny list) are present in the tree, i.e. when checking a staging copy about to be committed.
//
// Personal deny-list terms (names, handles) live OUTSIDE the publish set: OIKOS_RELEASE_DENYLIST=<file>,
// or an untracked `.release-denylist` in the repo root, one term per line.
import { readdirSync, readFileSync, statSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildPlugin, extractArt } from './build.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const root = resolve(args.find((a) => !a.startsWith('--')) || fileURLToPath(new URL('..', import.meta.url)));
const SKIP_DIRS = new Set(['node_modules', '.git']);
// Gitignored files that may exist on a developer machine but must never be in the publish set.
const LOCAL_ONLY = [/^src\/assets\/.*\.png$/, /^src\/assets\/embedded_data\.limezu\.js$/, /^\.release-denylist$/, /^HERMES_HANDOFF\.md$/, /(^|\/)\.DS_Store$/];
const MUST_NOT_EXIST = [/^plugin\.js$/];
// The only image files allowed in the repo: README/catalog pictures, listed in THIRD_PARTY_NOTICES.md.
const IMAGE_ALLOW = new Set(['docs/hero.png', 'docs/banner.png']);
// Sprite pixels may live only inside the built bundle, never as a separate file or module.
const INLINE_IMAGE = /data:image\/[a-z]+;base64,[A-Za-z0-9+/]{200,}/;

const failures = [];
const warnings = [];
const fail = (rule, where) => failures.push(`${rule}: ${where}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(relative(root, p));
  }
  return out;
}

function pngChunks(buf) {
  const types = [];
  for (let off = 8; off + 8 <= buf.length;) {
    const len = buf.readUInt32BE(off);
    types.push(buf.toString('latin1', off + 4, off + 8));
    off += 12 + len;
  }
  return types;
}

const all = walk(root);
const localOnly = all.filter((f) => LOCAL_ONLY.some((re) => re.test(f)));
const publish = all.filter((f) => !localOnly.includes(f));
for (const f of localOnly) (strict ? fail : (r, w) => warnings.push(`${r}: ${w}`))('local-only file present (gitignored, never publish)', f);
for (const f of all) if (MUST_NOT_EXIST.some((re) => re.test(f))) fail('stale duplicate bundle (use desktop/plugin.js)', f);

// Packaging shape
if (!existsSync(join(root, 'plugin.yaml'))) fail('missing manifest', 'plugin.yaml');
if (!existsSync(join(root, 'THIRD_PARTY_NOTICES.md'))) fail('missing third-party art notice', 'THIRD_PARTY_NOTICES.md');
const bundlePath = join(root, 'desktop/plugin.js');
if (!existsSync(bundlePath)) fail('missing desktop entry (run npm run build)', 'desktop/plugin.js');
else {
  try {
    extractArt(readFileSync(bundlePath, 'utf8'), 'desktop/plugin.js');
  } catch (err) {
    fail(`release bundle must embed the 6 sprite sheets (${err.message})`, 'desktop/plugin.js');
  }
  const dir = mkdtempSync(join(tmpdir(), 'oikos-check-'));
  try {
    const outfile = join(dir, 'plugin.js');
    await buildPlugin({ mode: 'bundle', artFrom: bundlePath, outfile, quiet: true });
    if (!readFileSync(outfile).equals(readFileSync(bundlePath))) fail('bundle is stale vs src/ (run npm run build)', 'desktop/plugin.js');
  } catch (err) {
    fail(`rebuild failed (${err.message})`, 'desktop/plugin.js');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const manifest = existsSync(join(root, 'plugin.yaml')) ? readFileSync(join(root, 'plugin.yaml'), 'utf8') : '';
if (!/^license\s*:/m.test(manifest) || /^\s*"?license"?\s*:\s*"?(UNDECIDED|SEE LICENSE[^"\n]*)"?\s*,?\s*$/m.test(manifest)) fail('code licence not chosen by owner', 'plugin.yaml license');
if (!publish.some((f) => /^LICEN[CS]E(\.\w+)?$/.test(f))) fail('no LICENSE file for the code', 'repo root');

// Content scans over the publish set
const RULES = [
  ['local home path', /\/Users\/[A-Za-z]|\/home\/(?!user\/)[a-z_][\w-]*\/|[A-Z]:\\\\Users\\\\/],
  ['token-shaped string', /\bghp_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bxox[abpr]-[A-Za-z0-9-]{10,}|\bAKIA[0-9A-Z]{16}\b/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/]
];
const denyPath = process.env.OIKOS_RELEASE_DENYLIST || join(root, '.release-denylist');
const deny = existsSync(denyPath)
  ? readFileSync(denyPath, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))
  : null;
if (!deny) warnings.push('no deny list found (OIKOS_RELEASE_DENYLIST or .release-denylist); personal-name scan skipped');

for (const f of publish) {
  const buf = readFileSync(join(root, f));
  if (/\.(png|jpe?g|gif|webp|psd|aseprite|ase|tsx|tmx|zip)$/i.test(f)) {
    if (!IMAGE_ALLOW.has(f)) { fail('image/sprite/archive file outside the allowlist (sprites ship only inside the bundle)', f); continue; }
    const meta = pngChunks(buf).filter((t) => ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'].includes(t));
    if (meta.length) fail(`PNG carries metadata chunks (${[...new Set(meta)].join(',')}); strip them`, f);
    continue;
  }
  if (buf.includes(0)) { fail('binary file in publish set', f); continue; }
  const text = buf.toString('utf8');
  if (f !== 'desktop/plugin.js' && INLINE_IMAGE.test(text)) fail('inline image data outside desktop/plugin.js', f);
  for (const [rule, re] of RULES) if (re.test(text)) fail(rule, f);
  if (deny) deny.forEach((term, i) => {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) fail(`deny-list term #${i + 1}`, f);
  });
}

console.log(JSON.stringify({ root: relative(process.cwd(), root) || '.', strict, publishFiles: publish.length, denylistTerms: deny ? deny.length : 0, warnings, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
