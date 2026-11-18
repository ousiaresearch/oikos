// Checks that the committed desktop/plugin.js is exactly what src/ builds to.
//
// It rebuilds src/ into a temporary file with the sprite sheets taken (in memory) from the
// committed bundle, then compares bytes. A match proves the bundle's CODE is the reviewed source
// built with the locked esbuild. It cannot prove where the sprite sheets came from: those are
// only reproducible from the purchased LimeZu packs (scripts/pack-biomes.py); see the README.
//
//   node scripts/verify-bundle.mjs            (or: npm run verify:bundle)
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ART_KEYS, buildPlugin, extractArt } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const committedPath = join(root, 'desktop/plugin.js');
const committed = readFileSync(committedPath);
const dir = mkdtempSync(join(tmpdir(), 'oikos-verify-'));
try {
  const outfile = join(dir, 'plugin.js');
  await buildPlugin({ mode: 'bundle', artFrom: committedPath, outfile, quiet: true });
  const rebuilt = readFileSync(outfile);
  const art = extractArt(committed.toString('utf8'), 'desktop/plugin.js');
  const sheets = Object.fromEntries(ART_KEYS.map((k) => {
    const png = Buffer.from(art[k].slice(art[k].indexOf(',') + 1), 'base64');
    return [k.toLowerCase(), { sha256: sha(png), width: png.readUInt32BE(16), height: png.readUInt32BE(20) }];
  }));
  const result = {
    committed: { bytes: committed.length, sha256: sha(committed) },
    rebuilt: { bytes: rebuilt.length, sha256: sha(rebuilt) },
    identical: committed.equals(rebuilt),
    embeddedSheets: sheets
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.identical) {
    console.error('desktop/plugin.js does not match a fresh build of src/; run `npm run build` and review the diff.');
    process.exitCode = 1;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
