// Embedded Multi-Biome LimeZu Sprite & Layered Character Compositor for Oikos.
// esbuild bundles the PNG imports as data URLs (--loader:.png=dataurl) for zero-server single-file serving.

import {
  ATLAS_DATA_URL as atlasDataUrl,
  BODIES_DATA_URL as bodiesDataUrl,
  EYES_DATA_URL as eyesDataUrl,
  OUTFITS_DATA_URL as outfitsDataUrl,
  HAIRS_DATA_URL as hairsDataUrl,
  ACCESSORIES_DATA_URL as accessoriesDataUrl
} from './embedded_data.js';
import manifest from './biomes_manifest.json' with { type: 'json' };

const spriteState = {
  ready: false,
  promise: null,
  atlasImg: null,
  layerImgs: {},
  charSheetCache: new Map()
};

function createCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image API unavailable'));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode embedded sprite'));
    img.src = src;
  });
}

function hashStr(s) {
  let hVal = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    hVal ^= str.charCodeAt(i);
    hVal = Math.imul(hVal, 16777619);
  }
  return hVal >>> 0;
}

export function loadPluginSprites() {
  if (spriteState.ready) return Promise.resolve(true);
  if (spriteState.promise) return spriteState.promise;
  if (typeof Image === 'undefined') return Promise.resolve(false);
  // Art-free build: no sprite data embedded, stay on the procedural fallback renderer.
  if (![atlasDataUrl, bodiesDataUrl, eyesDataUrl, outfitsDataUrl, hairsDataUrl, accessoriesDataUrl].every(Boolean)) {
    return Promise.resolve(false);
  }

  spriteState.promise = Promise.all([
    loadImg(atlasDataUrl),
    loadImg(bodiesDataUrl),
    loadImg(eyesDataUrl),
    loadImg(outfitsDataUrl),
    loadImg(hairsDataUrl),
    loadImg(accessoriesDataUrl)
  ])
    .then(([atlasImg, bodies, eyes, outfits, hairs, accessories]) => {
      spriteState.atlasImg = atlasImg;
      spriteState.layerImgs = { bodies, eyes, outfits, hairs, accessories };
      spriteState.ready = true;
      return true;
    })
    .catch(() => false);

  return spriteState.promise;
}

export function getAvatarOptions() {
  const cl = manifest.charLayers || {};
  return {
    bodies: cl.bodies?.keys || [],
    eyes: cl.eyes?.keys || [],
    outfits: cl.outfits?.keys || [],
    hairs: cl.hairs?.keys || [],
    accessories: ['none', ...(cl.accessories?.keys || [])]
  };
}

export function resolveAppearanceIndices(appearance = null, fallbackId = 'resident') {
  const cl = manifest.charLayers || {};
  const h = hashStr(fallbackId);

  const pickIdx = (layerName, val, shift) => {
    const keys = cl[layerName]?.keys || [];
    if (!keys.length) return 0;
    if (typeof val === 'number' && Number.isInteger(val) && val >= 0) return val % keys.length;
    if (typeof val === 'string') {
      const found = keys.indexOf(val);
      if (found >= 0) return found;
    }
    return (h >>> shift) % keys.length;
  };

  let accIdx = -1;
  const accKeys = cl.accessories?.keys || [];
  if (appearance && appearance.accessory && appearance.accessory !== 'none') {
    const found = accKeys.indexOf(appearance.accessory);
    if (found >= 0) accIdx = found;
    else if (typeof appearance.accessory === 'number' && appearance.accessory >= 0) {
      accIdx = appearance.accessory % accKeys.length;
    }
  } else if (!appearance && accKeys.length && ((h >>> 18) % 4 === 0)) {
    accIdx = (h >>> 20) % accKeys.length;
  }

  return {
    bodyIdx: pickIdx('bodies', appearance?.body, 0),
    eyesIdx: pickIdx('eyes', appearance?.eyes, 4),
    outfitIdx: pickIdx('outfits', appearance?.outfit, 8),
    hairIdx: pickIdx('hairs', appearance?.hair, 13),
    accIdx
  };
}

export function getCompositedCharSheet(appearance = null, fallbackId = 'resident') {
  if (!spriteState.ready) return null;
  const { bodyIdx, eyesIdx, outfitIdx, hairIdx, accIdx } = resolveAppearanceIndices(appearance, fallbackId);
  const key = `${bodyIdx}|${eyesIdx}|${outfitIdx}|${hairIdx}|${accIdx}`;
  const cached = spriteState.charSheetCache.get(key);
  if (cached) return cached;

  const canvas = createCanvas(768, 128);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;

  const drawLayer = (layerKey, idx) => {
    const img = spriteState.layerImgs[layerKey];
    if (!img || idx < 0) return;
    ctx.drawImage(img, 0, idx * 128, 768, 128, 0, 0, 768, 128);
  };

  drawLayer('bodies', bodyIdx);
  drawLayer('eyes', eyesIdx);
  drawLayer('outfits', outfitIdx);
  drawLayer('hairs', hairIdx);
  if (accIdx >= 0) drawLayer('accessories', accIdx);

  if (spriteState.charSheetCache.size > 256) {
    spriteState.charSheetCache.clear();
  }
  spriteState.charSheetCache.set(key, canvas);
  return canvas;
}

export function getSpriteAssets() {
  return {
    ready: spriteState.ready,
    manifest,
    atlasImg: spriteState.atlasImg
  };
}
