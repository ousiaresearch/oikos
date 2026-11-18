// Source-tree sprite data stub: deliberately empty. The six LimeZu-derived sprite sheets are never
// kept in the source tree. `npm run build` substitutes a real module in memory (art carried over from
// the committed desktop/plugin.js, or packed from your own LimeZu purchase with OIKOS_ART=limezu);
// see scripts/build.mjs and THIRD_PARTY_NOTICES.md. Loaded as-is (tests, OIKOS_ART=none builds),
// every URL is empty, loadPluginSprites() resolves false, and the renderer draws its procedural
// fallback tiles and figures.
export const ART_SOURCE = 'none';
export const ATLAS_DATA_URL = '';
export const BODIES_DATA_URL = '';
export const EYES_DATA_URL = '';
export const OUTFITS_DATA_URL = '';
export const HAIRS_DATA_URL = '';
export const ACCESSORIES_DATA_URL = '';
