// Builds desktop/plugin.js, the single file Hermes Desktop loads.
//
// Where the sprite art comes from (OIKOS_ART):
//   bundle (default)  the six LimeZu-derived sprite sheets already embedded in the committed
//                     desktop/plugin.js (or OIKOS_ART_FROM=<file>) are carried over in memory into
//                     a fresh build of src/. Lets anyone change the code and rebuild with the art
//                     intact, and is how `npm run verify:bundle` checks the shipped bundle.
//   limezu            sheets packed from your own purchased LimeZu packs by scripts/pack-biomes.py
//                     (OIKOS_ART_MODULE=<file>, default src/assets/embedded_data.limezu.js).
//   none              no sprite art at all; the renderer uses its procedural tiles and figures.
//
// `bundle` and `limezu` feed the same canonical in-memory module, so the same sheets give a
// byte-identical bundle whichever way they arrive. This script never writes a sprite sheet to
// disk; in this repository the art only exists inside desktop/plugin.js.
//
// OIKOS_OUTFILE=<path> writes somewhere other than desktop/plugin.js (used by verify-bundle).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export const ART_KEYS = ['ATLAS', 'BODIES', 'EYES', 'OUTFITS', 'HAIRS', 'ACCESSORIES'];
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Pull the six data URLs out of an ESM module or a built bundle (both use `<KEY>_DATA_URL = "..."`).
export function extractArt(text, where) {
  const art = {};
  for (const key of ART_KEYS) {
    const re = new RegExp(`\\b${key}_DATA_URL = ("data:image\\/png;base64,[A-Za-z0-9+/=]+")`, 'g');
    const hits = [...text.matchAll(re)];
    if (hits.length !== 1) throw new Error(`${where}: expected exactly one ${key}_DATA_URL with PNG data, found ${hits.length}`);
    const url = JSON.parse(hits[0][1]);
    const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!png.subarray(0, 8).equals(PNG_SIG)) throw new Error(`${where}: ${key}_DATA_URL is not a PNG`);
    art[key] = url;
  }
  return art;
}

function canonicalArtModule(art) {
  return [
    "export const ART_SOURCE = 'limezu';",
    ...ART_KEYS.map((k) => `export const ${k}_DATA_URL = ${JSON.stringify(art[k])};`),
    ''
  ].join('\n');
}

export async function buildPlugin({
  mode = process.env.OIKOS_ART || 'bundle',
  outfile = process.env.OIKOS_OUTFILE || 'desktop/plugin.js',
  artFrom = process.env.OIKOS_ART_FROM || 'desktop/plugin.js',
  artModule = process.env.OIKOS_ART_MODULE || 'src/assets/embedded_data.limezu.js',
  quiet = false
} = {}) {
  if (!['bundle', 'limezu', 'none'].includes(mode)) throw new Error(`OIKOS_ART must be bundle|limezu|none, got ${mode}`);

  // Read the art BEFORE building: in the default mode the input and the output are the same file.
  let art = null;
  if (mode === 'bundle') {
    const from = resolve(root, artFrom);
    if (!existsSync(from)) throw new Error(`OIKOS_ART=bundle needs ${artFrom}; use OIKOS_ART=none for an art-free build.`);
    art = extractArt(readFileSync(from, 'utf8'), artFrom);
  } else if (mode === 'limezu') {
    const from = resolve(root, artModule);
    if (!existsSync(from)) throw new Error(`OIKOS_ART=limezu needs ${artModule} (run scripts/pack-biomes.py on your own packs).`);
    art = extractArt(readFileSync(from, 'utf8'), artModule);
  }

  const artAlias = {
    name: 'oikos-art',
    setup(b) {
      if (!art) return;
      b.onResolve({ filter: /\/embedded_data\.js$/ }, () => ({ path: 'embedded_data.js', namespace: 'oikos-art' }));
      b.onLoad({ filter: /.*/, namespace: 'oikos-art' }, () => ({ contents: canonicalArtModule(art), loader: 'js' }));
    }
  };

  await build({
    absWorkingDir: root,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    logLevel: quiet ? 'error' : 'info',
    legalComments: 'eof',
    entryPoints: ['src/plugin.js'],
    outfile,
    loader: { '.png': 'dataurl', '.json': 'json' },
    plugins: [artAlias],
    external: ['react', 'react/jsx-runtime', '@hermes/plugin-sdk']
  });

  const out = readFileSync(resolve(root, outfile), 'utf8');
  const embeddedImages = (out.match(/data:image\/(?:png|webp|gif|jpeg);base64,/g) || []).length;
  const expected = art ? ART_KEYS.length : 0;
  if (embeddedImages !== expected) {
    throw new Error(`${outfile} embeds ${embeddedImages} image(s); OIKOS_ART=${mode} expects ${expected}.`);
  }
  return { outfile, art: mode, embeddedImages, bytes: Buffer.byteLength(out) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildPlugin()
    .then((res) => console.log(JSON.stringify(res)))
    .catch((err) => { console.error(err.message); process.exitCode = 1; });
}
