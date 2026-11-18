// Native 32px/Tile World Renderer, Foot-Y Depth Sorter, Hit-Testing & Minimap Radar for Oikos.

import { WORLD_TILES, SECTOR_TILES, sectorAtTile } from './world-layout.js';
import {
  TILE_SIZE,
  TILE,
  STATION_VISUALS,
  getBiomeTile,
  getSectorBuildings,
  getSectorScenery,
  getSectorTransitStop,
  getTrafficVehicles
} from './world-map.js';
import { getSpriteAssets, getCompositedCharSheet } from './assets/embedded.js';

export { TILE_SIZE };
export const ZOOM_LEVELS = Object.freeze([0.5, 0.75, 1.0, 1.5]);

const RENDER_CHUNK_TILES = 32;
const CHUNK_CACHE = new Map();
let lastChunkAssetsReady = false;

export function computeSolarShadow(timeMode = 'auto', phase = null) {
  const effective = phase || (timeMode === 'auto' ? 'day' : timeMode);
  if (effective === 'night') return { dx: 4, dy: 3, alpha: 0.38 };
  if (effective === 'dusk') return { dx: 12, dy: 5, alpha: 0.32 };
  return { dx: 6, dy: 4, alpha: 0.26 };
}

function createOffscreenChunkCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

const SEASON_TINTS = Object.freeze({
  season_autumn: 'rgba(217, 119, 6, 0.14)',
  season_winter: 'rgba(186, 230, 253, 0.20)',
  season_spring: 'rgba(244, 114, 182, 0.10)'
});

export function worldToScreen(wx, wy, camera, canvasW, canvasH) {
  const zoom = camera.zoom || 1;
  return {
    sx: (wx - camera.x) * TILE_SIZE * zoom + canvasW / 2,
    sy: (wy - camera.y) * TILE_SIZE * zoom + canvasH / 2
  };
}

export function screenToWorld(sx, sy, camera, canvasW, canvasH) {
  const zoom = camera.zoom || 1;
  return {
    wx: camera.x + (sx - canvasW / 2) / (TILE_SIZE * zoom),
    wy: camera.y + (sy - canvasH / 2) / (TILE_SIZE * zoom)
  };
}

function getInteriorMetrics(room, canvasW, canvasH) {
  const roomPxW = room.cols * TILE_SIZE;
  const roomPxH = room.rows * TILE_SIZE;
  const scale = Math.max(0.6, Math.min((canvasW - 48) / roomPxW, (canvasH - 48) / roomPxH, 1.6));
  const ox = (canvasW - roomPxW * scale) / 2;
  const oy = (canvasH - roomPxH * scale) / 2;
  return { scale, ox, oy, roomPxW, roomPxH };
}

export function hitTestWorld(snap, camera, canvas, clientX, clientY) {
  if (!snap || !canvas) return null;
  const rect = typeof canvas.getBoundingClientRect === 'function'
    ? canvas.getBoundingClientRect()
    : { left: 0, top: 0, width: canvas.width, height: canvas.height };
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  const sx = (clientX - rect.left) * scaleX;
  const sy = (clientY - rect.top) * scaleY;

  if (snap.activeInterior) {
    const room = snap.activeInterior;
    const { scale, ox, oy } = getInteriorMetrics(room, canvas.width, canvas.height);
    const ix = (sx - ox) / (TILE_SIZE * scale);
    const iy = (sy - oy) / (TILE_SIZE * scale);

    for (const e of snap.entities) {
      if (e.interiorId !== room.id) continue;
      if (Math.hypot(ix - e.x, (iy + 0.45) - e.y) <= 0.9) {
        return { kind: 'entity', entity: e, tileX: ix, tileY: iy };
      }
    }
    if (ix >= 7.3 && ix <= 10.7 && iy >= 10.4 && iy <= room.rows) {
      return { kind: 'exit_interior', tileX: 8.5, tileY: 11 };
    }
    for (const st of room.stations) {
      if (Math.hypot(ix - st.x, iy - st.y) <= 1.5) {
        return { kind: 'station', station: st, tileX: st.x, tileY: st.y };
      }
    }
    const tileX = Math.max(1, Math.min(room.cols - 2, Math.floor(ix)));
    const tileY = Math.max(1, Math.min(room.rows - 2, Math.floor(iy)));
    return { kind: 'tile', tileX, tileY, interior: true };
  }

  const { wx, wy } = screenToWorld(sx, sy, camera, canvas.width, canvas.height);

  // 1. Check outdoor entities first
  let bestEntity = null;
  let bestEntDist = Infinity;
  for (const e of snap.entities) {
    if (e.interiorId) continue;
    const d = Math.hypot(wx - e.x, (wy + 0.45) - e.y);
    if (d <= 0.85 && d < bestEntDist) {
      bestEntDist = d;
      bestEntity = e;
    }
  }
  if (bestEntity) {
    return { kind: 'entity', entity: bestEntity, tileX: wx, tileY: wy };
  }

  // 2. Check interactive stations in unlocked sectors
  let bestStation = null;
  let bestStDist = Infinity;
  for (const st of snap.worldSpec.stations) {
    const d = Math.hypot(wx - st.x, wy - st.y);
    if (d <= 1.4 && d < bestStDist) {
      bestStDist = d;
      bestStation = st;
    }
  }
  if (bestStation) {
    return { kind: 'station', station: bestStation, tileX: bestStation.x, tileY: bestStation.y };
  }

  // 3. Check unlocked buildings (click/dblclick to inspect or enter interior)
  const hitSec = sectorAtTile(wx, wy);
  const secObj = snap.worldSpec.sectors.find((s) => s.id === hitSec.id);
  if (secObj && secObj.unlocked) {
    for (const b of getSectorBuildings(secObj.id)) {
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y - 1 && wy <= b.y + b.h) {
        return { kind: 'building', building: b, tileX: b.x + b.w / 2, tileY: b.y + b.h };
      }
    }
  }

  // 4. Fallback to world tile coordinate
  const tileX = Math.max(0, Math.min(WORLD_TILES - 1, Math.floor(wx)));
  const tileY = Math.max(0, Math.min(WORLD_TILES - 1, Math.floor(wy)));
  const sector = snap.worldSpec.sectors.find((s) => s.id === sectorAtTile(tileX, tileY).id) || null;
  return { kind: 'tile', tileX, tileY, sector };
}

function tileHash(gx, gy) {
  return ((gx * 73 + gy * 37) ^ (gx * 13 + gy * 7)) & 0xff;
}

function drawAtlasTile(ctx, assets, key, px, py) {
  const r = assets.manifest.rects[key];
  if (!r || !assets.atlasImg) return false;
  ctx.drawImage(assets.atlasImg, r.x, r.y, r.w, r.h, px, py, TILE_SIZE, TILE_SIZE);
  return true;
}

function drawSingleTile(ctx, assets, tileType, gx, gy, tickCount) {
  const px = gx * TILE_SIZE;
  const py = gy * TILE_SIZE;
  const h = tileHash(gx, gy);
  const ready = assets.ready && assets.atlasImg;

  switch (tileType) {
    case TILE.GRASS:
    case TILE.GRASS_FLOWER: {
      const grassKey = tileType === TILE.GRASS_FLOWER
        ? (h % 2 === 0 ? 'grass_flower_1' : 'grass_flower_2')
        : (h % 3 === 0 ? 'tile_grass_2' : 'tile_grass');
      if (!ready || !drawAtlasTile(ctx, assets, grassKey, px, py)) {
        ctx.fillStyle = (gx + gy) % 2 === 0 ? '#46923c' : '#408936';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        if (tileType === TILE.GRASS_FLOWER) {
          ctx.fillStyle = h % 2 === 0 ? '#fde047' : '#ffffff';
          ctx.fillRect(px + 10, py + 12, 3, 3);
          ctx.fillRect(px + 21, py + 20, 3, 3);
        }
      }
      break;
    }

    case TILE.SIDEWALK: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_sidewalk', px, py)) {
        ctx.fillStyle = '#c8c4bc';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      // Subtle crisp paver joint border
      ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
      ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
      ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
      break;
    }

    case TILE.ROAD: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_asphalt', px, py)) {
        ctx.fillStyle = '#333840';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      const lx = ((gx % SECTOR_TILES) + SECTOR_TILES) % SECTOR_TILES;
      const ly = ((gy % SECTOR_TILES) + SECTOR_TILES) % SECTOR_TILES;
      // Centerline lane dashes on 3-tile avenues
      if ((ly === 43 || ly === 85 || ly === 64) && gx % 2 === 0) {
        ctx.fillStyle = '#eab308';
        ctx.fillRect(px + 6, py + 15, 18, 2);
      } else if ((lx === 39 || lx === 89 || lx === 64) && gy % 2 === 0) {
        ctx.fillStyle = '#eab308';
        ctx.fillRect(px + 15, py + 6, 2, 18);
      }
      break;
    }

    case TILE.CROSSWALK: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_asphalt', px, py)) {
        ctx.fillStyle = '#333840';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      const ly = ((gy % SECTOR_TILES) + SECTOR_TILES) % SECTOR_TILES;
      const isEW = (ly >= 42 && ly <= 44) || (ly >= 84 && ly <= 86);
      ctx.fillStyle = '#e2e8f0';
      if (isEW) {
        for (let i = 3; i < TILE_SIZE - 2; i += 8) {
          ctx.fillRect(px + i, py + 4, 4, TILE_SIZE - 8);
        }
      } else {
        for (let i = 3; i < TILE_SIZE - 2; i += 8) {
          ctx.fillRect(px + 4, py + i, TILE_SIZE - 8, 4);
        }
      }
      break;
    }

    case TILE.PARK_PATH: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_park_path', px, py)) {
        ctx.fillStyle = '#c8b496';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#a38e70';
        for (let y = 0; y < TILE_SIZE; y += 8) ctx.fillRect(px, py + y, TILE_SIZE, 1);
      }
      break;
    }

    case TILE.PARK_PLAZA: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_plaza', px, py)) {
        ctx.fillStyle = '#dad3c5';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      ctx.fillStyle = 'rgba(15, 23, 42, 0.10)';
      ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
      ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
      break;
    }

    case TILE.WATER: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_water', px, py)) {
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      const phase = Math.floor(tickCount / 4 + gx * 2 + gy) % 6;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
      ctx.fillRect(px + 3 + phase * 2, py + 8, 10, 2);
      ctx.fillRect(px + 14 - phase * 2, py + 22, 11, 2);
      break;
    }

    case TILE.SAND: {
      ctx.fillStyle = (gx + gy) % 2 === 0 ? '#f3d9a4' : '#ebd098';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#d9b97c';
      ctx.fillRect(px + (h % 18) + 4, py + ((h >> 3) % 18) + 5, 4, 2);
      if (h % 13 === 0) {
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(px + 18, py + 12, 3, 2);
      }
      break;
    }

    case TILE.WOOD_DECK: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_wood', px, py)) {
        ctx.fillStyle = '#92400e';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 7; y < TILE_SIZE; y += 8) ctx.fillRect(px, py + y, TILE_SIZE, 1);
      break;
    }

    case TILE.TATAMI: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_tatami', px, py)) {
        ctx.fillStyle = '#b4b86b';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      ctx.strokeStyle = 'rgba(63, 98, 18, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      break;
    }

    case TILE.MARBLE: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_marble', px, py)) {
        const even = (gx + gy) % 2 === 0;
        ctx.fillStyle = even ? '#f1ece1' : '#dcd4c4';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
      ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
      break;
    }

    case TILE.TECH_FLOOR: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_tech', px, py)) {
        ctx.fillStyle = (gx + gy) % 2 === 0 ? '#1e293b' : '#263348';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      if (h % 9 === 0) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.fillRect(px + 14, py + 14, 4, 4);
      }
      break;
    }

    case TILE.FENCE: {
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_grass', px, py)) {
        ctx.fillStyle = '#408936';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      if (!ready || !drawAtlasTile(ctx, assets, 'tile_fence', px, py)) {
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(px, py + 10, TILE_SIZE, 14);
      }
      break;
    }

    case TILE.FLOWERBED: {
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#a8a29e';
      ctx.fillRect(px, py, TILE_SIZE, 2);
      ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
      const colors = ['#ef4444', '#facc15', '#ec4899', '#a855f7'];
      for (let fy = 6; fy <= 22; fy += 8) {
        for (let fx = 6; fx <= 22; fx += 8) {
          ctx.fillStyle = '#15803d';
          ctx.fillRect(px + fx - 1, py + fy, 6, 5);
          ctx.fillStyle = colors[(fx + fy + gx + gy) % colors.length];
          ctx.fillRect(px + fx, py + fy - 1, 4, 4);
        }
      }
      break;
    }

    case TILE.INT_WALL: {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px, py, TILE_SIZE, 9);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(px, py + 9, TILE_SIZE, 2);
      ctx.fillStyle = '#334155';
      ctx.fillRect(px, py + 11, TILE_SIZE, 13);
      ctx.fillStyle = '#475569';
      ctx.fillRect(px + 3, py + 13, TILE_SIZE - 6, 9);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(px, py + 24, TILE_SIZE, 5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(px, py + 29, TILE_SIZE, 3);
      break;
    }

    case TILE.RUG: {
      ctx.fillStyle = '#881337';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#9f1239';
      ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(px + 12, py + 8, 8, 16);
      ctx.fillRect(px + 8, py + 12, 16, 8);
      break;
    }

    case TILE.EXIT_MAT: {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', px + 16, py + 19);
      ctx.textAlign = 'left';
      break;
    }

    default:
      ctx.fillStyle = '#475569';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  }
}

function getOrBuildChunk(cx, cy, sector, unlocked, assets) {
  const readyFlag = Boolean(assets.ready && assets.atlasImg);
  if (readyFlag !== lastChunkAssetsReady) {
    CHUNK_CACHE.clear();
    lastChunkAssetsReady = readyFlag;
  }
  const key = `${cx},${cy},${unlocked ? 1 : 0}`;
  if (CHUNK_CACHE.has(key)) return CHUNK_CACHE.get(key);

  const pxSize = RENDER_CHUNK_TILES * TILE_SIZE;
  const c = createOffscreenChunkCanvas(pxSize, pxSize);
  if (!c) return null;
  const cCtx = c.getContext('2d');
  if (!cCtx) return null;
  cCtx.imageSmoothingEnabled = false;

  const startTX = cx * RENDER_CHUNK_TILES;
  const startTY = cy * RENDER_CHUNK_TILES;
  for (let ly = 0; ly < RENDER_CHUNK_TILES; ly++) {
    for (let lx = 0; lx < RENDER_CHUNK_TILES; lx++) {
      const gx = startTX + lx;
      const gy = startTY + ly;
      const px = lx * TILE_SIZE;
      const py = ly * TILE_SIZE;

      if (!unlocked) {
        cCtx.fillStyle = ((gx + gy) & 1) === 0 ? '#0c1322' : '#0f172a';
        cCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        if (gx % 4 === 0 || gy % 4 === 0) {
          cCtx.fillStyle = 'rgba(51, 65, 85, 0.35)';
          if (gx % 4 === 0) cCtx.fillRect(px, py, 1, TILE_SIZE);
          if (gy % 4 === 0) cCtx.fillRect(px, py, TILE_SIZE, 1);
        }
      } else {
        cCtx.save();
        cCtx.translate(-startTX * TILE_SIZE, -startTY * TILE_SIZE);
        drawSingleTile(cCtx, assets, getBiomeTile(sector.id, gx, gy), gx, gy, 0);
        cCtx.restore();
      }

      if (gx % SECTOR_TILES === 0) {
        cCtx.fillStyle = 'rgba(250, 204, 21, 0.25)';
        cCtx.fillRect(px, py, 2, TILE_SIZE);
      }
      if (gy % SECTOR_TILES === 0) {
        cCtx.fillStyle = 'rgba(250, 204, 21, 0.25)';
        cCtx.fillRect(px, py, TILE_SIZE, 2);
      }
    }
  }

  if (CHUNK_CACHE.size > 72) {
    CHUNK_CACHE.delete(CHUNK_CACHE.keys().next().value);
  }
  CHUNK_CACHE.set(key, c);
  return c;
}

function drawVisibleTiles(ctx, snap, camera, canvasW, canvasH, tickCount, assets) {
  const topLeft = screenToWorld(0, 0, camera, canvasW, canvasH);
  const botRight = screenToWorld(canvasW, canvasH, camera, canvasW, canvasH);
  const minTX = Math.max(0, Math.floor(topLeft.wx) - 1);
  const maxTX = Math.min(WORLD_TILES - 1, Math.ceil(botRight.wx) + 1);
  const minTY = Math.max(0, Math.floor(topLeft.wy) - 1);
  const maxTY = Math.min(WORLD_TILES - 1, Math.ceil(botRight.wy) + 1);

  const sectorById = new Map(snap.worldSpec.sectors.map((s) => [s.id, s]));
  const minCX = Math.floor(minTX / RENDER_CHUNK_TILES);
  const maxCX = Math.floor(maxTX / RENDER_CHUNK_TILES);
  const minCY = Math.floor(minTY / RENDER_CHUNK_TILES);
  const maxCY = Math.floor(maxTY / RENDER_CHUNK_TILES);

  let usedCache = true;
  for (let cy = minCY; cy <= maxCY; cy++) {
    for (let cx = minCX; cx <= maxCX; cx++) {
      const sInfo = sectorAtTile(cx * RENDER_CHUNK_TILES, cy * RENDER_CHUNK_TILES);
      const sec = sectorById.get(sInfo.id);
      const chunkCanvas = getOrBuildChunk(cx, cy, sInfo, Boolean(sec?.unlocked), assets);
      if (chunkCanvas) {
        ctx.drawImage(chunkCanvas, cx * RENDER_CHUNK_TILES * TILE_SIZE, cy * RENDER_CHUNK_TILES * TILE_SIZE);
      } else {
        usedCache = false;
      }
    }
  }

  if (!usedCache) {
    for (let gy = minTY; gy <= maxTY; gy++) {
      for (let gx = minTX; gx <= maxTX; gx++) {
        const sInfo = sectorAtTile(gx, gy);
        const sec = sectorById.get(sInfo.id);
        if (!sec || !sec.unlocked) {
          ctx.fillStyle = ((gx + gy) & 1) === 0 ? '#0c1322' : '#0f172a';
          ctx.fillRect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else {
          drawSingleTile(ctx, assets, getBiomeTile(sec.id, gx, gy), gx, gy, tickCount);
        }
      }
    }
  }

  // Animated water shimmer & Kyoto koi fish pass on top of cached tiles
  for (let gy = minTY; gy <= maxTY; gy++) {
    for (let gx = minTX; gx <= maxTX; gx++) {
      const sInfo = sectorAtTile(gx, gy);
      const sec = sectorById.get(sInfo.id);
      if (!sec?.unlocked) continue;
      if (getBiomeTile(sec.id, gx, gy) !== TILE.WATER) continue;
      const px = gx * TILE_SIZE;
      const py = gy * TILE_SIZE;
      const phase = Math.floor(tickCount / 4 + gx * 2 + gy) % 6;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.fillRect(px + 3 + phase * 2, py + 8, 9, 2);
      ctx.fillRect(px + 14 - phase * 2, py + 22, 10, 2);

      // Animated koi fish swimming gently in Kyoto koi pond
      if (sec.id === 'kyoto' && (gx + gy * 3) % 11 === 0) {
        const swim = Math.sin((tickCount * 0.08) + gx) * 6;
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(Math.round(px + 12 + swim), py + 14, 7, 3);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(Math.round(px + 15 + swim), py + 14, 2, 3);
      }
    }
  }

  return { minTX, maxTX, minTY, maxTY };
}

function drawBuilding(ctx, assets, b, isNight, solarShadow, isHovered = false, showLabels = false, occupantCount = 0, ownerResident = null, isSelectedHome = false) {
  const px = b.x * TILE_SIZE;
  const py = b.y * TILE_SIZE;
  const pw = b.w * TILE_SIZE;
  const ph = b.h * TILE_SIZE;

  // Directional solar ground shadow beneath the building footprint
  ctx.fillStyle = `rgba(2, 6, 23, ${solarShadow.alpha})`;
  ctx.fillRect(px + solarShadow.dx, py + ph - 6 + solarShadow.dy, pw, 12);

  // Pure LimeZu building sprite (zero procedural box overlays behind it)
  const r = assets.ready && assets.manifest?.rects?.[b.spriteKey];
  if (r && assets.atlasImg) {
    const dw = pw;
    const dh = Math.round(r.h * (dw / r.w));
    const dx = Math.round(px);
    const dy = Math.round(py + ph - dh);
    ctx.drawImage(assets.atlasImg, r.x, r.y, r.w, r.h, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
    ctx.fillRect(px, py, pw, ph);
  }

  if (isHovered) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.88)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
  }

  // Subtle warm doorway spill at dusk/night
  if (isNight && typeof ctx.createRadialGradient === 'function') {
    const gx = px + pw / 2;
    const gy = py + ph - 4;
    const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, 34);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.32)');
    grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clean doorway badge (prominent on hover or Labels mode; quiet architectural nameplate otherwise)
  const label = isHovered
    ? `🚪 ${(b.shortName || b.name || '').toUpperCase().slice(0, 12)}`
    : (b.shortName || b.name || '').toUpperCase().slice(0, 14);
  if (label) {
    const prominent = isHovered || showLabels;
    ctx.font = prominent ? 'bold 9px monospace' : 'bold 8.5px monospace';
    const signW = Math.min(pw - 4, Math.ceil(ctx.measureText(label).width) + 12);
    const signX = Math.round(px + (pw - signW) / 2);
    const signY = Math.round(py + ph - 8);
    ctx.fillStyle = isHovered
      ? 'rgba(15, 23, 42, 0.96)'
      : prominent
        ? 'rgba(11, 17, 32, 0.90)'
        : 'rgba(11, 17, 32, 0.72)';
    ctx.fillRect(signX, signY, signW, 13);
    ctx.strokeStyle = isHovered
      ? '#facc15'
      : prominent
        ? 'rgba(250, 204, 21, 0.55)'
        : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(signX + 0.5, signY + 0.5, signW - 1, 12);
    ctx.fillStyle = prominent ? '#fef08a' : '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText(label, px + pw / 2, signY + 9.5);
    ctx.textAlign = 'left';
  }

  if (ownerResident && (isSelectedHome || isHovered || showLabels)) {
    const ownerTag = `🏠 ${String(ownerResident.name || '').slice(0, 10)}`;
    ctx.font = 'bold 8.5px monospace';
    const ow = Math.min(pw - 42, Math.ceil(ctx.measureText(ownerTag).width) + 10);
    const ox = Math.round(px + 4);
    const oy = Math.round(py + 6);
    ctx.fillStyle = isSelectedHome ? 'rgba(120, 53, 15, 0.94)' : 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(ox, oy, ow, 13);
    ctx.strokeStyle = isSelectedHome ? '#facc15' : (ownerResident.color || 'rgba(148, 163, 184, 0.6)');
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, ow - 1, 12);
    ctx.fillStyle = isSelectedHome ? '#fef08a' : '#f1f5f9';
    ctx.fillText(ownerTag, ox + 4, oy + 9.5);
  }

  if (occupantCount > 0) {
    const occText = `👤 ${occupantCount}`;
    ctx.font = 'bold 9px monospace';
    const ox = Math.round(px + pw - 36);
    const oy = Math.round(py + 6);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(ox, oy, 32, 14);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, 31, 13);
    ctx.fillStyle = '#bae6fd';
    ctx.textAlign = 'center';
    ctx.fillText(occText, ox + 16, oy + 10);
    ctx.textAlign = 'left';
  }
}

function drawSceneryItem(ctx, assets, item, solarShadow) {
  const px = item.x * TILE_SIZE;
  const py = item.y * TILE_SIZE;
  const targetW = item.w * TILE_SIZE;
  const targetH = item.h * TILE_SIZE;

  const sk = item.spriteKey;
  const isCanopyTree = sk === 'conservatory_tree' || sk === 'tree_sycamore_2' || sk === 'woodland_tree' || sk === 'coastal_palm';
  const isStreetTree = !isCanopyTree && (sk.includes('tree') || sk.includes('palm'));
  const isLamp = sk.includes('lamp');
  const isHeroProp = sk.includes('fountain') || sk.includes('cart') || sk.includes('bus_stop') || sk.includes('statue');

  const fitW = isCanopyTree ? 74 : isStreetTree ? 54 : isLamp ? 20 : targetW;
  const fitH = isCanopyTree ? 92 : isStreetTree ? 72 : isLamp ? 48 : targetH;
  const maxScale = isCanopyTree ? 1.45 : (isStreetTree || isHeroProp) ? 1.35 : 1.25;

  ctx.fillStyle = `rgba(2, 6, 23, ${solarShadow.alpha})`;
  ctx.beginPath();
  ctx.ellipse(
    px + TILE_SIZE / 2 + solarShadow.dx * 0.45,
    py + TILE_SIZE - 2 + solarShadow.dy * 0.35,
    Math.max(8, fitW * 0.38),
    isCanopyTree ? 6.5 : 5,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const r = assets.ready && assets.manifest?.rects?.[sk];
  if (r && assets.atlasImg) {
    const scale = Math.min(fitW / r.w, fitH / r.h, maxScale);
    const dw = Math.max(4, Math.round(r.w * scale));
    const dh = Math.max(4, Math.round(r.h * scale));
    const dx = Math.round(px + (TILE_SIZE - dw) / 2);
    const dy = Math.round(py + TILE_SIZE - dh);
    ctx.drawImage(assets.atlasImg, r.x, r.y, r.w, r.h, dx, dy, dw, dh);
  }
}

function drawStationSprite(ctx, assets, st, isHovered, isTargeted, tickCount, solarShadow, artifactCount = 0) {
  const vis = st.spriteKey
    ? { spriteKey: st.spriteKey, w: st.w || 2, h: st.h || 2 }
    : (STATION_VISUALS[st.id] || { spriteKey: 'bench_h', w: 2, h: 2 });
  const px = st.x * TILE_SIZE;
  const py = st.y * TILE_SIZE;
  const padW = Math.max(44, Math.min(80, vis.w * TILE_SIZE));
  const padH = Math.max(44, Math.min(80, vis.h * TILE_SIZE));

  // Natural solar ellipse shadow (zero neon debug rectangle)
  ctx.fillStyle = `rgba(2, 6, 23, ${solarShadow.alpha})`;
  ctx.beginPath();
  ctx.ellipse(px + solarShadow.dx * 0.3, py + padH * 0.34 + solarShadow.dy * 0.25, padW * 0.35, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isHovered || isTargeted) {
    ctx.strokeStyle = isHovered ? '#facc15' : '#38bdf8';
    ctx.lineWidth = isHovered ? 2.5 : 1.75;
    ctx.beginPath();
    ctx.ellipse(px, py + padH * 0.34, padW * 0.42, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const r = assets.ready && assets.manifest?.rects?.[vis.spriteKey];
  if (r && assets.atlasImg) {
    const scale = Math.min((padW - 2) / r.w, (padH - 2) / r.h, 1.35);
    const dw = Math.max(16, Math.round(r.w * scale));
    const dh = Math.max(16, Math.round(r.h * scale));
    const dx = Math.round(px - dw / 2);
    const dy = Math.round(py + padH * 0.38 - dh);
    ctx.drawImage(assets.atlasImg, r.x, r.y, r.w, r.h, dx, dy, dw, dh);
  }

  // Animated fountain spray & campfire sparks
  if (vis.spriteKey.includes('fountain')) {
    const bob = Math.sin(tickCount * 0.25) * 3;
    ctx.fillStyle = 'rgba(186, 230, 253, 0.78)';
    ctx.fillRect(Math.round(px - 2), Math.round(py - 10 + bob), 4, 4);
  } else if (vis.spriteKey.includes('campfire')) {
    const flicker = (tickCount % 6) < 3 ? 0 : -2;
    ctx.fillStyle = 'rgba(251, 146, 60, 0.85)';
    ctx.fillRect(Math.round(px - 3), Math.round(py - 4 + flicker), 3, 3);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.9)';
    ctx.fillRect(Math.round(px + 1), Math.round(py - 6 - flicker), 2, 2);
  }

  if (artifactCount > 0) {
    const badgeText = `📌 ${artifactCount}`;
    ctx.font = 'bold 9px monospace';
    const bw = Math.ceil(ctx.measureText(badgeText).width) + 8;
    const bx = Math.round(px + 8);
    const by = Math.round(py - 28);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(bx, by, bw, 14);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 13);
    ctx.fillStyle = '#fef08a';
    ctx.fillText(badgeText, bx + 4, by + 10);
  }
}

function drawTrafficVehicle(ctx, assets, v, solarShadow) {
  const px = v.x * TILE_SIZE;
  const py = v.y * TILE_SIZE;
  const fitW = v.w * TILE_SIZE;
  const fitH = v.h * TILE_SIZE;
  const isVertical = v.dir === 'up' || v.dir === 'down';

  ctx.fillStyle = `rgba(2, 6, 23, ${solarShadow.alpha + 0.08})`;
  ctx.beginPath();
  ctx.ellipse(
    px + solarShadow.dx * 0.35,
    py + (isVertical ? 4 : 12),
    isVertical ? Math.max(12, fitW * 0.42) : fitW * 0.42,
    isVertical ? Math.max(18, fitH * 0.38) : 7,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const r = assets.ready && assets.manifest?.rects?.[v.spriteKey];
  if (r && assets.atlasImg) {
    const scale = Math.min(fitW / r.w, fitH / r.h, 1.15);
    const dw = Math.round(r.w * scale);
    const dh = Math.round(r.h * scale);
    const dy = isVertical ? Math.round(py - dh / 2) : Math.round(py + 14 - dh);
    ctx.drawImage(assets.atlasImg, r.x, r.y, r.w, r.h, Math.round(px - dw / 2), dy, dw, dh);
  } else {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(Math.round(px - fitW / 2), Math.round(py - fitH / 2), fitW, fitH);
  }
}

function drawCharacterSprite(ctx, assets, e, tickCount, isSelected, isHovered, solarShadow) {
  const px = e.x * TILE_SIZE;
  const py = e.y * TILE_SIZE;

  ctx.fillStyle = `rgba(2, 6, 23, ${solarShadow.alpha + 0.08})`;
  ctx.beginPath();
  ctx.ellipse(px + solarShadow.dx * 0.3, py + 10 + solarShadow.dy * 0.25, 10, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isSelected || isHovered || e.kind === 'hermes_agent') {
    ctx.strokeStyle = isSelected ? '#facc15' : isHovered ? '#38bdf8' : '#fde047';
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.beginPath();
    ctx.ellipse(px, py + 10, 13, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const charSheet = getCompositedCharSheet(e.appearance, e.id);
  const moving = Boolean(e.moving) || Math.hypot((e.targetX ?? e.x) - e.x, (e.targetY ?? e.y) - e.y) > 0.08;
  if (charSheet) {
    const dirIdx = e.dir === 'right' ? 0 : e.dir === 'up' ? 1 : e.dir === 'left' ? 2 : 3;
    const animRow = moving ? 1 : 0;
    const frame = moving
      ? Math.floor(e.walkPhase ?? (tickCount / 2)) % 6
      : Math.floor(tickCount / 6) % 6;
    const col = dirIdx * 6 + frame;
    const dw = 28;
    const dh = 56;
    ctx.drawImage(charSheet, col * 32, animRow * 64, 32, 64, Math.round(px - dw / 2), Math.round(py + 10 - dh), dw, dh);
  } else {
    ctx.fillStyle = e.color || '#38bdf8';
    ctx.fillRect(Math.round(px - 8), Math.round(py - 28), 16, 36);
  }

  if ((e.prop === 'book' || e.prop === 'smartphone') && assets.ready && assets.atlasImg) {
    const pKey = e.prop === 'book' ? 'prop_book' : 'prop_phone';
    const r = assets.manifest?.rects?.[pKey];
    if (r) {
      ctx.drawImage(assets.atlasImg, r.x, r.y, r.w, r.h, Math.round(px + 8), Math.round(py - 28), 16, 32);
    }
  }
}

function drawScreenOverlays(ctx, snap, camera, canvasW, canvasH, tickCount, assets, interaction, bounds) {
  const { hovered, selectedEntityId, showLabels = false } = interaction || {};
  const zoom = camera.zoom || 1;
  const { minTX, maxTX, minTY, maxTY } = bounds;
  const selEnt = snap.entities.find((e) => e.id === selectedEntityId);
  const targetedStationId = selEnt?.targetStationId || null;

  // Transit stop markers across unlocked districts (visible with Labels or during transit trip)
  const showTransit = Boolean(showLabels || selEnt?.path?.some((wp) => wp.transitHop));
  if (showTransit) {
    for (const sec of snap.worldSpec.sectors) {
      if (!sec.unlocked) continue;
      const ts = getSectorTransitStop(sec.id);
      if (ts.x < minTX - 2 || ts.x > maxTX + 2 || ts.y < minTY - 2 || ts.y > maxTY + 2) continue;
      const { sx, sy } = worldToScreen(ts.x, ts.y, camera, canvasW, canvasH);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(Math.round(sx - 11), Math.round(sy - 11), 22, 18);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(sx - 11) + 0.5, Math.round(sy - 11) + 0.5, 21, 17);
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('🚇', Math.round(sx), Math.round(sy + 2));
    }
  }

  // Floating station pills (hover/targeted/showLabels) + 📌 Pinned Artifact badges
  const artifactStationSet = new Set((snap.artifacts || []).map((a) => a.stationId));
  for (const st of snap.worldSpec.stations) {
    if (st.x < minTX - 3 || st.x > maxTX + 3 || st.y < minTY - 3 || st.y > maxTY + 3) continue;
    const isHov = hovered?.kind === 'station' && hovered.station.id === st.id;
    const isTgt = targetedStationId === st.id;
    const { sx, sy } = worldToScreen(st.x, st.y, camera, canvasW, canvasH);

    if (artifactStationSet.has(st.id)) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(Math.round(sx - 10), Math.round(sy - 26 * zoom), 20, 16);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(sx - 10) + 0.5, Math.round(sy - 26 * zoom) + 0.5, 19, 15);
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('📌', sx, Math.round(sy - 26 * zoom + 12));
    }

    if (!isHov && !isTgt && !showLabels) continue;
    const lbl = st.label;
    ctx.font = 'bold 10px monospace';
    const tw = Math.ceil(ctx.measureText(lbl).width) + 12;
    const px = Math.round(sx - tw / 2);
    const py = Math.round(sy + 28 * zoom);
    ctx.fillStyle = isHov ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(px, py, tw, 16);
    ctx.strokeStyle = isHov ? '#facc15' : isTgt ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, tw - 1, 15);
    ctx.fillStyle = isHov ? '#fef08a' : '#f1f5f9';
    ctx.textAlign = 'center';
    ctx.fillText(lbl, sx, py + 11);
  }

  // Character name tags, subagent tethers, floating emojis & speech bubbles in crisp screen space
  for (const e of snap.entities) {
    if (e.interiorId) continue;
    if (e.x < minTX - 2 || e.x > maxTX + 2 || e.y < minTY - 2 || e.y > maxTY + 2) continue;
    const sec = snap.worldSpec.sectors.find((s) => s.id === e.sectorId);
    if (sec && !sec.unlocked) continue;
    const { sx, sy } = worldToScreen(e.x, e.y, camera, canvasW, canvasH);

    if (e.kind === 'subagent' && e.parentId) {
      const parent = snap.entities.find((p) => p.id === e.parentId);
      if (parent && !parent.interiorId) {
        const { sx: psx, sy: psy } = worldToScreen(parent.x, parent.y, camera, canvasW, canvasH);
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(psx, psy - 16 * zoom);
        ctx.lineTo(sx, sy - 16 * zoom);
        ctx.stroke();
        ctx.restore();
      }
    }

    const nameTxt = e.name.slice(0, 16);
    const isSel = e.id === selectedEntityId;
    ctx.font = 'bold 10px monospace';
    const nw = Math.ceil(ctx.measureText(nameTxt).width) + 12;
    const nx = Math.round(sx - nw / 2);
    const ny = Math.round(sy - 56 * zoom - 12);

    ctx.fillStyle = isSel ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.76)';
    ctx.fillRect(nx, ny, nw, 15);
    ctx.strokeStyle = isSel
      ? '#facc15'
      : e.kind === 'subagent'
        ? '#38bdf8'
        : e.kind === 'hermes_agent'
          ? '#fde047'
          : 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(nx + 0.5, ny + 0.5, nw - 1, 14);
    ctx.fillStyle = isSel ? '#fde047' : (e.kind === 'subagent' ? '#7dd3fc' : '#ffffff');
    ctx.textAlign = 'center';
    ctx.fillText(nameTxt, sx, ny + 11);

    const displayBadge = e.activeEmoji || e.weatherProp;
    if (displayBadge) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(Math.round(sx + 14), Math.round(sy - 48 * zoom), 22, 18);
      ctx.strokeStyle = e.activeEmoji ? '#facc15' : '#38bdf8';
      ctx.strokeRect(Math.round(sx + 14) + 0.5, Math.round(sy - 48 * zoom) + 0.5, 21, 17);
      ctx.font = '12px sans-serif';
      ctx.fillText(displayBadge, Math.round(sx + 25), Math.round(sy - 48 * zoom + 13));
    }

    if (e.speech) {
      const sp = e.speech.slice(0, 26);
      ctx.font = '10px sans-serif';
      const sw = Math.ceil(ctx.measureText(sp).width) + 14;
      const bx = Math.round(sx - sw / 2);
      const by = ny - 22;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.fillRect(bx, by, sw, 18);
      ctx.strokeStyle = '#fde68a';
      ctx.strokeRect(bx + 0.5, by + 0.5, sw - 1, 17);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.moveTo(sx - 4, by + 18);
      ctx.lineTo(sx + 4, by + 18);
      ctx.lineTo(sx, by + 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillText(sp, sx, by + 12.5);
    }
  }
  ctx.textAlign = 'left';

  if (snap.activeGathering) {
    const gSt = snap.worldSpec.stations.find((s) => s.id === snap.activeGathering.stationId);
    if (gSt && gSt.x >= minTX - 4 && gSt.x <= maxTX + 4 && gSt.y >= minTY - 4 && gSt.y <= maxTY + 4) {
      const { sx, sy } = worldToScreen(gSt.x, gSt.y, camera, canvasW, canvasH);
      const pulse = 20 + Math.sin(tickCount * 0.18) * 5;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, pulse * zoom, 0, Math.PI * 2);
      ctx.stroke();

      const gText = `🎉 ${snap.activeGathering.title} (${snap.activeGathering.invitedIds.length} invited)`;
      ctx.font = 'bold 10px monospace';
      const gw = Math.ceil(ctx.measureText(gText).width) + 14;
      const gx = Math.round(sx - gw / 2);
      const gy = Math.round(sy - 42 * zoom);
      ctx.fillStyle = 'rgba(120, 53, 15, 0.92)';
      ctx.fillRect(gx, gy, gw, 17);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1;
      ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, 16);
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(gText, sx, gy + 12);
      ctx.textAlign = 'left';
    }
  }

  for (const proj of (snap.civicProjects || [])) {
    if (!proj.completed) continue;
    const sec = snap.worldSpec.sectors.find((s) => s.id === proj.sectorId && s.unlocked);
    if (!sec) continue;
    const lx = sec.bounds.x0 + proj.lx;
    const ly = sec.bounds.y0 + proj.ly;
    if (lx < minTX - 4 || lx > maxTX + 4 || ly < minTY - 4 || ly > maxTY + 4) continue;
    const { sx, sy } = worldToScreen(lx, ly, camera, canvasW, canvasH);
    const text = `${proj.icon} ${proj.name}`;
    ctx.font = 'bold 9.5px monospace';
    const pw = Math.ceil(ctx.measureText(text).width) + 14;
    const px = Math.round(sx - pw / 2);
    const py = Math.round(sy - 30 * zoom);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(px, py, pw, 16);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, 15);
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center';
    ctx.fillText(text, sx, py + 11.5);
    ctx.textAlign = 'left';
  }

  if (snap.weather === 'rain') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 36; i++) {
      const rx = ((i * 79 + tickCount * 5) % (canvasW + 40)) - 20;
      const ry = ((i * 61 + tickCount * 11) % (canvasH + 40)) - 20;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 5, ry + 14);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.42)';
    for (let i = 0; i < 12; i++) {
      const px = ((i * 113 + Math.floor(tickCount / 10) * 41) % canvasW);
      const py = ((i * 97 + Math.floor(tickCount / 10) * 29) % canvasH);
      const rad = ((tickCount + i * 3) % 10) * 0.7;
      ctx.beginPath();
      ctx.ellipse(px, py, 2 + rad, 1 + rad * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (snap.weather === 'mist') {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.12)';
    for (let i = 0; i < 4; i++) {
      const my = ((i * 170 + 30) % Math.max(80, canvasH - 40));
      const mx = Math.sin(tickCount * 0.02 + i) * 35;
      ctx.fillRect(mx - 40, my, canvasW + 80, 44);
    }
  } else if (snap.weather === 'breeze') {
    ctx.fillStyle = 'rgba(251, 207, 232, 0.75)';
    for (let i = 0; i < 18; i++) {
      const lx = ((i * 89 + tickCount * 2.6) % (canvasW + 30)) - 15;
      const ly = ((i * 67 + Math.sin(tickCount * 0.08 + i) * 18 + tickCount * 0.9) % (canvasH + 30)) - 15;
      ctx.fillRect(Math.round(lx), Math.round(ly), 4, 3);
    }
  }

  if (snap.activeSeason && SEASON_TINTS[snap.activeSeason]) {
    ctx.fillStyle = SEASON_TINTS[snap.activeSeason];
    ctx.fillRect(0, 0, canvasW, canvasH);
    const pColor = snap.activeSeason === 'season_winter'
      ? 'rgba(241, 245, 249, 0.75)'
      : snap.activeSeason === 'season_autumn'
        ? 'rgba(245, 158, 11, 0.75)'
        : 'rgba(249, 168, 212, 0.75)';
    ctx.fillStyle = pColor;
    for (let i = 0; i < 22; i++) {
      const px = ((i * 97 + tickCount * (1.2 + (i % 3) * 0.4)) % (canvasW + 40)) - 20;
      const py = ((i * 53 + tickCount * (2 + (i % 4) * 0.5)) % (canvasH + 40)) - 20;
      ctx.fillRect(Math.round(px), Math.round(py), 3, 3);
    }
  }

  if (snap.lighting && snap.lighting.tint) {
    ctx.fillStyle = snap.lighting.tint;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const drawGlow = (wx, wy, radiusPx) => {
      const { sx, sy } = worldToScreen(wx, wy, camera, canvasW, canvasH);
      if (sx < -radiusPx || sx > canvasW + radiusPx || sy < -radiusPx || sy > canvasH + radiusPx) return;
      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, radiusPx);
      grad.addColorStop(0, 'rgba(254, 240, 138, 0.42)');
      grad.addColorStop(0.55, 'rgba(251, 191, 36, 0.14)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, radiusPx, 0, Math.PI * 2);
      ctx.fill();
    };

    for (const st of snap.worldSpec.stations) {
      if (st.x < minTX - 3 || st.x > maxTX + 3 || st.y < minTY - 3 || st.y > maxTY + 3) continue;
      drawGlow(st.x, st.y, 48 * zoom);
    }
    const camSec = sectorAtTile(camera.x, camera.y);
    for (const item of getSectorScenery(camSec.id)) {
      if (item.spriteKey === 'midtown_lamp' || item.spriteKey === 'lamp_modern') {
        drawGlow(item.x + 0.5, item.y - 0.3, 44 * zoom);
      }
    }
  }

  const centerSecInfo = sectorAtTile(camera.x, camera.y);
  const centerSec = snap.worldSpec.sectors.find((s) => s.id === centerSecInfo.id);
  if (centerSec && !centerSec.unlocked) {
    const bw = Math.min(canvasW - 40, 420);
    const bx = Math.round((canvasW - bw) / 2);
    const by = Math.round(canvasH / 2 - 34);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(bx, by, bw, 68);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 67);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`🔒 LOCKED SECTOR: ${centerSec.name.toUpperCase()}`, canvasW / 2, by + 26);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Open Packs in the menu bar to unlock "${centerSec.packId}"`, canvasW / 2, by + 48);
    ctx.textAlign = 'left';
  }
}

function renderInteriorRoom(ctx, w, hPx, snap, tickCount, assets, interaction) {
  const room = snap.activeInterior;
  const { scale, ox, oy, roomPxW, roomPxH } = getInteriorMetrics(room, w, hPx);
  const shadow = computeSolarShadow('day');
  const selectedId = interaction.selectedEntityId ?? snap.selectedEntityId;
  const selEnt = snap.entities.find((e) => e.id === selectedId);

  ctx.save();
  ctx.translate(Math.round(ox), Math.round(oy));
  ctx.scale(scale, scale);

  // Room outer frame shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
  ctx.fillRect(8, 10, roomPxW, roomPxH);

  for (let y = 0; y < room.rows; y++) {
    for (let x = 0; x < room.cols; x++) {
      drawSingleTile(ctx, assets, room.grid[y][x], x, y, tickCount);
    }
  }

  ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, roomPxW, roomPxH);

  const drawables = [];
  for (const st of room.stations) {
    const isHov = interaction.hovered?.kind === 'station' && interaction.hovered.station.id === st.id;
    const isTgt = selEnt?.targetStationId === st.id;
    drawables.push({
      footY: (st.y + 0.6) * TILE_SIZE,
      layer: 1,
      draw: () => drawStationSprite(ctx, assets, st, isHov, isTgt, tickCount, shadow)
    });
  }

  for (const e of snap.entities) {
    if (e.interiorId !== room.id) continue;
    const isSel = e.id === selectedId;
    const isHov = interaction.hovered?.kind === 'entity' && interaction.hovered.entity.id === e.id;
    drawables.push({
      footY: e.y * TILE_SIZE + 10,
      layer: 2,
      draw: () => drawCharacterSprite(ctx, assets, e, tickCount, isSel, isHov, shadow)
    });
  }

  drawables.sort((a, b) => (a.footY - b.footY) || (a.layer - b.layer));
  for (const d of drawables) d.draw();

  ctx.restore();

  // Room title & station pills in crisp screen space
  const roomTitle = room.ownerName
    ? `🏠 ${room.ownerName}'s Home · ${room.name} (${room.layoutStyle})`
    : room.name;
  ctx.fillStyle = 'rgba(11, 17, 32, 0.88)';
  ctx.font = 'bold 12px monospace';
  const headerW = Math.min(w - 40, Math.ceil(ctx.measureText(roomTitle).width) + 28);
  const hx = Math.round((w - headerW) / 2);
  const hy = Math.max(10, Math.round(oy - 28));
  ctx.fillRect(hx, hy, headerW, 22);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
  ctx.strokeRect(hx + 0.5, hy + 0.5, headerW - 1, 21);
  ctx.fillStyle = '#fef08a';
  ctx.textAlign = 'center';
  ctx.fillText(roomTitle, w / 2, hy + 15);

  for (const st of room.stations) {
    const isHov = interaction.hovered?.kind === 'station' && interaction.hovered.station.id === st.id;
    const isTgt = selEnt?.targetStationId === st.id;
    if (!isHov && !isTgt && !interaction.showLabels) continue;
    const sx = ox + st.x * TILE_SIZE * scale;
    const sy = oy + st.y * TILE_SIZE * scale + 26 * scale;
    ctx.font = 'bold 10px monospace';
    const tw = Math.ceil(ctx.measureText(st.label).width) + 12;
    ctx.fillStyle = isHov ? 'rgba(15, 23, 42, 0.96)' : 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(Math.round(sx - tw / 2), Math.round(sy), tw, 16);
    ctx.strokeStyle = isHov ? '#facc15' : 'rgba(148, 163, 184, 0.45)';
    ctx.strokeRect(Math.round(sx - tw / 2) + 0.5, Math.round(sy) + 0.5, tw - 1, 15);
    ctx.fillStyle = isHov ? '#fef08a' : '#f1f5f9';
    ctx.fillText(st.label, sx, Math.round(sy) + 11);
  }

  for (const e of snap.entities) {
    if (e.interiorId !== room.id) continue;
    const sx = ox + e.x * TILE_SIZE * scale;
    const sy = oy + e.y * TILE_SIZE * scale;
    const ny = Math.round(sy - 56 * scale - 10);
    ctx.font = 'bold 10px monospace';
    const nw = Math.ceil(ctx.measureText(e.name).width) + 12;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(Math.round(sx - nw / 2), ny, nw, 15);
    ctx.strokeStyle = e.id === selectedId ? '#facc15' : 'rgba(148,163,184,0.45)';
    ctx.strokeRect(Math.round(sx - nw / 2) + 0.5, ny + 0.5, nw - 1, 14);
    ctx.fillStyle = '#fde047';
    ctx.fillText(e.name, sx, ny + 11);

    if (e.activeEmoji) {
      ctx.font = '13px sans-serif';
      ctx.fillText(e.activeEmoji, sx + 22, ny + 14);
    }
    if (e.speech) {
      const sp = e.speech.slice(0, 26);
      ctx.font = '10px sans-serif';
      const sw = Math.ceil(ctx.measureText(sp).width) + 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.fillRect(Math.round(sx - sw / 2), ny - 21, sw, 17);
      ctx.fillStyle = '#fef3c7';
      ctx.fillText(sp, sx, ny - 9);
    }
  }
  ctx.textAlign = 'left';
}

export function renderWorldCanvas(canvas, snap, tickCount, camera = { x: 192, y: 192, zoom: 1 }, interaction = {}) {
  if (!canvas || !snap) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const hPx = canvas.height;
  const zoom = camera.zoom || 1;
  const assets = getSpriteAssets();

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, w, hPx);

  if (snap.activeInterior) {
    renderInteriorRoom(ctx, w, hPx, snap, tickCount, assets, interaction);
    return;
  }

  ctx.save();
  ctx.translate(Math.round(w / 2), Math.round(hPx / 2));
  ctx.scale(zoom, zoom);
  ctx.translate(-Math.round(camera.x * TILE_SIZE), -Math.round(camera.y * TILE_SIZE));

  const bounds = drawVisibleTiles(ctx, snap, camera, w, hPx, tickCount, assets);
  const { minTX, maxTX, minTY, maxTY } = bounds;
  const isNight = Boolean(snap.lighting?.isNight);
  const solarShadow = computeSolarShadow(snap.timeMode, snap.lighting?.phase);
  const selectedId = interaction.selectedEntityId ?? snap.selectedEntityId;
  const selEnt = snap.entities.find((e) => e.id === selectedId);

  const buildingOccupancy = new Map();
  const homeOwnerByBuilding = new Map();
  for (const e of snap.entities) {
    const rawBId = e.occupiedBuildingId || (e.interiorId ? String(e.interiorId).replace(/^int_/, '') : null);
    if (rawBId) buildingOccupancy.set(rawBId, (buildingOccupancy.get(rawBId) || 0) + 1);
    if (e.kind === 'resident' && e.homeBuildingId) homeOwnerByBuilding.set(e.homeBuildingId, e);
  }

  const drawables = [];
  for (const sec of snap.worldSpec.sectors) {
    if (!sec.unlocked) continue;
    const b = sec.bounds;
    if (b.x1 < minTX - 6 || b.x0 > maxTX + 6 || b.y1 < minTY - 6 || b.y0 > maxTY + 6) continue;

    for (const bldg of getSectorBuildings(sec.id)) {
      if (bldg.x + bldg.w < minTX - 2 || bldg.x > maxTX + 2 || bldg.y + bldg.h < minTY - 2 || bldg.y > maxTY + 2) continue;
      const isBldgHov = interaction.hovered?.kind === 'building' && interaction.hovered.building.id === bldg.id;
      const occ = buildingOccupancy.get(bldg.id) || 0;
      const ownerRes = homeOwnerByBuilding.get(bldg.id) || null;
      const isSelHome = Boolean(ownerRes && ownerRes.id === selectedId);
      drawables.push({
        footY: (bldg.y + bldg.h) * TILE_SIZE,
        layer: 1,
        draw: () => drawBuilding(ctx, assets, bldg, isNight, solarShadow, isBldgHov, Boolean(interaction.showLabels), occ, ownerRes, isSelHome)
      });
    }

    for (const prop of getSectorScenery(sec.id)) {
      if (prop.x < minTX - 3 || prop.x > maxTX + 3 || prop.y < minTY - 3 || prop.y > maxTY + 3) continue;
      drawables.push({
        footY: (prop.y + 1) * TILE_SIZE,
        layer: 2,
        draw: () => drawSceneryItem(ctx, assets, prop, solarShadow)
      });
    }
  }

  // Live moving avenue vehicles (yield at crosswalks)
  for (const v of getTrafficVehicles(tickCount, snap.worldSpec, snap.entities)) {
    if (v.x < minTX - 4 || v.x > maxTX + 4 || v.y < minTY - 4 || v.y > maxTY + 4) continue;
    drawables.push({
      footY: (v.y + 0.5) * TILE_SIZE,
      layer: 2,
      draw: () => drawTrafficVehicle(ctx, assets, v, solarShadow)
    });
  }

  const artifactCountByStation = new Map();
  for (const art of (snap.artifacts || [])) {
    if (art?.stationId) {
      artifactCountByStation.set(art.stationId, (artifactCountByStation.get(art.stationId) || 0) + 1);
    }
  }

  for (const st of snap.worldSpec.stations) {
    if (st.x < minTX - 3 || st.x > maxTX + 3 || st.y < minTY - 3 || st.y > maxTY + 3) continue;
    const isHov = interaction.hovered?.kind === 'station' && interaction.hovered.station.id === st.id;
    const isTgt = selEnt?.targetStationId === st.id;
    const artCount = artifactCountByStation.get(st.id) || 0;
    drawables.push({
      footY: (st.y + 0.6) * TILE_SIZE,
      layer: 2,
      draw: () => drawStationSprite(ctx, assets, st, isHov, isTgt, tickCount, solarShadow, artCount)
    });
  }

  for (const e of snap.entities) {
    if (e.interiorId) continue;
    if (e.x < minTX - 2 || e.x > maxTX + 2 || e.y < minTY - 2 || e.y > maxTY + 2) continue;
    const sec = snap.worldSpec.sectors.find((s) => s.id === e.sectorId);
    if (sec && !sec.unlocked) continue;
    const isSel = e.id === selectedId;
    const isHov = interaction.hovered?.kind === 'entity' && interaction.hovered.entity.id === e.id;
    drawables.push({
      footY: e.y * TILE_SIZE + 10,
      layer: 3,
      draw: () => drawCharacterSprite(ctx, assets, e, tickCount, isSel, isHov, solarShadow)
    });
  }

  drawables.sort((a, b) => (a.footY - b.footY) || (a.layer - b.layer));
  for (const d of drawables) d.draw();

  if (interaction.hovered?.kind === 'tile') {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(interaction.hovered.tileX * TILE_SIZE, interaction.hovered.tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  ctx.restore();

  drawScreenOverlays(ctx, snap, camera, w, hPx, tickCount, assets, {
    hovered: interaction.hovered,
    selectedEntityId: selectedId,
    showLabels: Boolean(interaction.showLabels)
  }, bounds);
}

export function renderMinimapCanvas(canvas, snap, camera) {
  if (!canvas || !snap) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const scale = w / WORLD_TILES;
  ctx.clearRect(0, 0, w, h);

  for (const s of snap.worldSpec.sectors) {
    const x = s.bounds.x0 * scale;
    const y = s.bounds.y0 * scale;
    const size = SECTOR_TILES * scale;
    ctx.fillStyle = s.unlocked ? s.groundColor : '#0f172a';
    ctx.fillRect(x, y, size, size);
    if (!s.unlocked) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.fillRect(x, y, size, size);
    }
    ctx.strokeStyle = s.unlocked ? 'rgba(226, 232, 240, 0.3)' : 'rgba(71, 85, 105, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Water bodies, buildings, mini avenue lines & stations
    if (s.unlocked) {
      ctx.fillStyle = '#1d4ed8';
      if (s.id === 'coastal') {
        ctx.fillRect(x, y, 26 * scale, size);
        ctx.fillRect(x + 12 * scale, y + 54 * scale, 34 * scale, 34 * scale);
      } else if (s.id === 'kyoto') {
        ctx.fillRect(x + 36 * scale, y + 67 * scale, 18 * scale, 13 * scale);
      } else if (s.id === 'woodland') {
        ctx.fillRect(x + 74 * scale, y + 64 * scale, 24 * scale, 20 * scale);
      } else if (s.id === 'conservatory') {
        ctx.fillRect(x + 58 * scale, y + 66 * scale, 8 * scale, 6 * scale);
      }

      ctx.fillStyle = 'rgba(51, 65, 85, 0.72)';
      ctx.fillRect(x + 38 * scale, y, 3 * scale, size);
      ctx.fillRect(x + 88 * scale, y, 3 * scale, size);
      ctx.fillRect(x, y + 42 * scale, size, 3 * scale);
      ctx.fillRect(x, y + 84 * scale, size, 3 * scale);

      ctx.fillStyle = 'rgba(226, 232, 240, 0.44)';
      for (const b of getSectorBuildings(s.id)) {
        ctx.fillRect(b.x * scale, b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
      }

      ctx.fillStyle = 'rgba(167, 139, 250, 0.9)';
      for (const st of s.stations) {
        ctx.fillRect(st.x * scale - 1, st.y * scale - 1, 2, 2);
      }
    }
  }

  for (const e of snap.entities) {
    const isSel = e.id === snap.selectedEntityId;
    const ex = e.interiorId ? (e.outdoorX ?? 192) : e.x;
    const ey = e.interiorId ? (e.outdoorY ?? 192) : e.y;
    ctx.fillStyle = isSel ? '#facc15' : (e.kind === 'subagent' ? '#38bdf8' : (e.kind === 'hermes_agent' ? '#fde047' : '#38bdf8'));
    ctx.beginPath();
    ctx.arc(ex * scale, ey * scale, isSel ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Current camera focal reticle
  if (camera) {
    const cx = camera.x * scale;
    const cy = camera.y * scale;
    const boxR = Math.max(8, 22 / (camera.zoom || 1)) * scale;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - boxR, cy - boxR, boxR * 2, boxR * 2);
  }
}
