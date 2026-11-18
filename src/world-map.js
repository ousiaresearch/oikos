// Multi-Biome Tilemap, Pure-Sprite Buildings, High-Density Scenery, Sidewalk Pathfinder & Unlocked Camera Bounds.

import { WORLD_TILES, BIOME_SECTORS, SECTOR_TILES, SECTOR_COLS, SECTOR_ROWS, getSectorBounds, sectorAtTile } from './world-layout.js';

export const TILE_SIZE = 32;

export const TILE = Object.freeze({
  GRASS: 1,
  GRASS_FLOWER: 2,
  SIDEWALK: 3,
  ROAD: 4,
  CROSSWALK: 5,
  PARK_PATH: 6,
  PARK_PLAZA: 7,
  WATER: 8,
  SAND: 9,
  WOOD_DECK: 10,
  TATAMI: 11,
  MARBLE: 12,
  TECH_FLOOR: 13,
  FENCE: 14,
  FLOWERBED: 15,
  INT_WALL: 16,
  RUG: 17,
  EXIT_MAT: 18
});

export const STATION_VISUALS = Object.freeze({
  st_broadcast_desk: { spriteKey: 'desk_computer', w: 3, h: 2, padColor: '#0f172a' },
  st_synth_booth: { spriteKey: 'modular_synth', w: 2, h: 2, padColor: '#1e1b4b' },
  st_rooftop_drone: { spriteKey: 'turnstile', w: 2, h: 2, padColor: '#0c4a6e' },

  st_metro_concourse: { spriteKey: 'subway_stairs', w: 3, h: 3, padColor: '#334155' },
  st_boutique_vinyl: { spriteKey: 'turntable', w: 2, h: 2, padColor: '#312e81' },
  st_market_hall: { spriteKey: 'season_flower_cart', w: 2, h: 2, padColor: '#78350f' },

  st_tatami_study: { spriteKey: 'tea_table', w: 2, h: 2, padColor: '#a16207' },
  st_tea_pavilion: { spriteKey: 'counter_bar', w: 2, h: 2, padColor: '#7c2d12' },
  st_koi_bridge: { spriteKey: 'bench_park', w: 3, h: 1, padColor: '#78350f' },

  st_tiki_bar: { spriteKey: 'coastal_bar', w: 3, h: 3, padColor: '#92400e' },
  st_beach_pergola: { spriteKey: 'coastal_umbrella', w: 3, h: 3, padColor: '#0369a1' },
  st_marina_pier: { spriteKey: 'bench_h', w: 2, h: 2, padColor: '#78350f' },

  st_midtown_desk: { spriteKey: 'desk_computer', w: 3, h: 2, padColor: '#1e293b' },
  st_midtown_whiteboard: { spriteKey: 'library_bookshelf', w: 2, h: 2, padColor: '#1e293b' },
  st_midtown_espresso: { spriteKey: 'bistro_table', w: 2, h: 2, padColor: '#78350f' },
  st_midtown_plaza: { spriteKey: 'conservatory_fountain', w: 3, h: 4, padColor: '#334155' },

  st_library_stacks: { spriteKey: 'library_bookshelf', w: 2, h: 2, padColor: '#4c1d95' },
  st_museum_gallery: { spriteKey: 'rittenhouse_statue', w: 3, h: 4, padColor: '#475569' },
  st_glasshouse: { spriteKey: 'flowerbed', w: 2, h: 2, padColor: '#14532d' },

  st_duck_girl: { spriteKey: 'conservatory_fountain', w: 3, h: 4, padColor: '#475569' },
  st_parc_bistro: { spriteKey: 'bistro_table', w: 2, h: 2, padColor: '#78350f' },
  st_curtis_stage: { spriteKey: 'grand_piano', w: 2, h: 2, padColor: '#3b0764' },

  st_cabin_hearth: { spriteKey: 'fireplace', w: 2, h: 2, padColor: '#7f1d1d' },
  st_campfire_ring: { spriteKey: 'woodland_campfire', w: 2, h: 2, padColor: '#9a3412' },
  st_fishing_dock: { spriteKey: 'bench_h', w: 2, h: 2, padColor: '#78350f' },

  st_worksite_bay: { spriteKey: 'desk_computer', w: 3, h: 2, padColor: '#27272a' },
  st_med_bay: { spriteKey: 'medical_bed', w: 2, h: 2, padColor: '#064e3b' },
  st_outpost_range: { spriteKey: 'turnstile', w: 2, h: 2, padColor: '#7f1d1d' },

  st_broadcast_uplink: { spriteKey: 'desk_computer', w: 2, h: 2, padColor: '#0f172a' },
  st_broadcast_lounge: { spriteKey: 'bistro_table_2', w: 2, h: 2, padColor: '#1e1b4b' },
  st_metro_north_kiosk: { spriteKey: 'library_bookshelf', w: 2, h: 2, padColor: '#334155' },
  st_metro_south_bistro: { spriteKey: 'bistro_table', w: 2, h: 2, padColor: '#78350f' },
  st_kyoto_shodo: { spriteKey: 'tea_table', w: 2, h: 2, padColor: '#a16207' },
  st_kyoto_south_garden: { spriteKey: 'bench_park', w: 2, h: 2, padColor: '#3f6212' },
  st_coastal_north_deck: { spriteKey: 'coastal_umbrella', w: 2, h: 2, padColor: '#0369a1' },
  st_coastal_south_gelato: { spriteKey: 'bistro_table_2', w: 2, h: 2, padColor: '#92400e' },
  st_midtown_roasters_patio: { spriteKey: 'bistro_table', w: 2, h: 2, padColor: '#78350f' },
  st_midtown_south_atrium: { spriteKey: 'library_bookshelf', w: 2, h: 2, padColor: '#1e293b' },
  st_conservatory_orchid: { spriteKey: 'flowerbed', w: 2, h: 2, padColor: '#14532d' },
  st_conservatory_south_lawn: { spriteKey: 'bench_park', w: 2, h: 2, padColor: '#166534' },
  st_rittenhouse_atelier: { spriteKey: 'rittenhouse_statue', w: 2, h: 3, padColor: '#475569' },
  st_rittenhouse_recital_court: { spriteKey: 'bistro_table_2', w: 2, h: 2, padColor: '#78350f' },
  st_woodland_north_camp: { spriteKey: 'woodland_campfire', w: 2, h: 2, padColor: '#9a3412' },
  st_woodland_south_trail: { spriteKey: 'bench_h', w: 2, h: 2, padColor: '#78350f' },
  st_civic_north_reactor: { spriteKey: 'desk_computer', w: 2, h: 2, padColor: '#27272a' },
  st_civic_south_depot: { spriteKey: 'bistro_table', w: 2, h: 2, padColor: '#44403c' }
});

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function sectorBaseTile(sectorId, lx, ly) {
  if (sectorId === 'coastal') return lx < 26 ? TILE.WATER : TILE.SAND;
  if (sectorId === 'broadcast') return TILE.SIDEWALK;
  return ((lx * 11 + ly * 17) & 7) === 0 ? TILE.GRASS_FLOWER : TILE.GRASS;
}

export function getBiomeTile(sectorIdOrGx, gxOrGy, maybeGy) {
  let sectorId;
  let gx;
  let gy;
  if (typeof sectorIdOrGx === 'string') {
    sectorId = sectorIdOrGx;
    gx = gxOrGy;
    gy = maybeGy;
  } else {
    gx = sectorIdOrGx;
    gy = gxOrGy;
    sectorId = sectorAtTile(gx, gy).id;
  }

  const lx = ((gx % SECTOR_TILES) + SECTOR_TILES) % SECTOR_TILES;
  const ly = ((gy % SECTOR_TILES) + SECTOR_TILES) % SECTOR_TILES;

  // Perimeter avenues linking neighboring sectors continuously
  const onNSRoad = (lx >= 38 && lx <= 40) || (lx >= 88 && lx <= 90);
  const onEWRoad = (ly >= 42 && ly <= 44) || (ly >= 84 && ly <= 86);
  const onCenterSpine = ((lx >= 63 && lx <= 65) && (ly < 46 || ly > 82))
    || ((ly >= 63 && ly <= 65) && (lx < 42 || lx > 86));

  if (onNSRoad || onEWRoad || onCenterSpine) {
    const nearCrossX = (lx >= 62 && lx <= 66) && (ly === 42 || ly === 43 || ly === 44 || ly === 84 || ly === 85 || ly === 86);
    const nearCrossY = (ly >= 62 && ly <= 66) && (lx === 38 || lx === 39 || lx === 40 || lx === 88 || lx === 89 || lx === 90);
    if (nearCrossX || nearCrossY) return TILE.CROSSWALK;
    return TILE.ROAD;
  }

  // Sidewalks bordering all avenues & perimeter ring roads
  const nearNSRoad = (lx >= 36 && lx <= 42) || (lx >= 86 && lx <= 92);
  const nearEWRoad = (ly >= 40 && ly <= 46) || (ly >= 82 && ly <= 88);
  const nearSpine = ((lx >= 61 && lx <= 67) && (ly < 48 || ly > 80))
    || ((ly >= 61 && ly <= 67) && (lx < 44 || lx > 84));
  if (nearNSRoad || nearEWRoad || nearSpine) {
    return TILE.SIDEWALK;
  }

  // Keep coastal surf clean along western shoreline
  if (sectorId === 'coastal' && lx < 26) {
    return TILE.WATER;
  }

  // Biome-matched building courtyard aprons & long doorstep walkway connectors
  const sectorBuildings = RAW_SECTOR_BUILDINGS[sectorId];
  const apronTile = (sectorId === 'kyoto' || sectorId === 'woodland' || sectorId === 'coastal')
    ? TILE.WOOD_DECK
    : (sectorId === 'conservatory' || sectorId === 'rittenhouse' || sectorId === 'metro')
      ? TILE.MARBLE
      : (sectorId === 'broadcast' || sectorId === 'civic_works')
        ? TILE.TECH_FLOOR
        : TILE.PARK_PLAZA;
  if (sectorBuildings) {
    for (let i = 0; i < sectorBuildings.length; i++) {
      const b = sectorBuildings[i];
      const doorX = b.lx + Math.floor(b.w / 2);
      if (lx >= doorX - 1 && lx <= doorX && ly >= b.ly + b.h && ly <= b.ly + b.h + 12) {
        return TILE.SIDEWALK;
      }
      if (lx >= b.lx - 1 && lx <= b.lx + b.w && ly >= b.ly - 1 && ly <= b.ly + b.h + 2) {
        return apronTile;
      }
    }
  }

  switch (sectorId) {
    case 'midtown': {
      if (inRect(lx, ly, 55, 55, 73, 75)) {
        if ((lx === 55 || lx === 73 || ly === 55 || ly === 75) && !(lx >= 62 && lx <= 66) && !(ly >= 62 && ly <= 66)) {
          return TILE.FLOWERBED;
        }
        return TILE.PARK_PLAZA;
      }
      if (inRect(lx, ly, 45, 48, 83, 80)) {
        if (Math.abs(lx - 64) <= 2 || Math.abs(ly - 64) <= 2) return TILE.PARK_PATH;
        return TILE.SIDEWALK;
      }
      break;
    }

    case 'conservatory': {
      if (inRect(lx, ly, 58, 66, 66, 72)) return TILE.WATER;
      if (inRect(lx, ly, 56, 64, 68, 74)) return TILE.MARBLE;
      if (inRect(lx, ly, 48, 50, 84, 78)) {
        const onFenceEdge = lx === 48 || lx === 84 || ly === 50 || ly === 78;
        const onGate = Math.abs(lx - 64) <= 2 || Math.abs(ly - 64) <= 2;
        if (onFenceEdge && !onGate) return TILE.FENCE;
        if (ly === 54 || ly === 76) return TILE.FLOWERBED;
        if (inRect(lx, ly, 52, 56, 80, 74)) return TILE.MARBLE;
        return TILE.PARK_PATH;
      }
      break;
    }

    case 'kyoto': {
      if (inRect(lx, ly, 40, 72, 46, 76)) return TILE.WOOD_DECK;
      if (inRect(lx, ly, 36, 67, 54, 80)) return TILE.WATER;
      if (inRect(lx, ly, 52, 50, 78, 70)) {
        if (lx === 52 || lx === 78 || ly === 50 || ly === 70) return TILE.WOOD_DECK;
        return TILE.TATAMI;
      }
      if (Math.abs(lx - 64) <= 1 && inRect(ly, 46, 82)) return TILE.PARK_PATH;
      if (Math.abs(ly - 68) <= 1 && inRect(lx, 46, 80)) return TILE.PARK_PATH;
      if (inRect(lx, ly, 45, 49, 82, 80)) return TILE.GRASS_FLOWER;
      break;
    }

    case 'woodland': {
      if (inRect(lx, ly, 72, 77, 86, 79)) return TILE.WOOD_DECK;
      if (inRect(lx, ly, 74, 64, 98, 84)) return TILE.WATER;
      if (Math.hypot(lx - 68, ly - 70) <= 5.5) return TILE.PARK_PATH;
      if (inRect(lx, ly, 54, 52, 64, 60)) return TILE.WOOD_DECK;
      if (Math.abs(lx - 68) <= 1 && inRect(ly, 46, 82)) return TILE.PARK_PATH;
      if (Math.abs(ly - 70) <= 1 && inRect(lx, 46, 73)) return TILE.PARK_PATH;
      break;
    }

    case 'coastal': {
      if (inRect(lx, ly, 30, 75, 48, 77)) return TILE.WOOD_DECK;
      if (inRect(lx, ly, 12, 54, 46, 88)) return TILE.WATER;
      if (inRect(lx, ly, 46, 48, 84, 82)) {
        if (inRect(lx, ly, 46, 52, 50, 80)) return TILE.WOOD_DECK;
        if (inRect(lx, ly, 54, 55, 62, 62)) return TILE.WOOD_DECK;
        return TILE.SAND;
      }
      break;
    }

    case 'broadcast': {
      if (inRect(lx, ly, 57, 33, 71, 41)) return TILE.PARK_PLAZA;
      if (inRect(lx, ly, 44, 48, 82, 76)) {
        if (lx === 44 || lx === 82 || ly === 48 || ly === 76) return TILE.SIDEWALK;
        return TILE.TECH_FLOOR;
      }
      break;
    }

    case 'metro': {
      if (inRect(lx, ly, 44, 46, 84, 78)) {
        if (inRect(lx, ly, 58, 58, 70, 70)) return TILE.MARBLE;
        if (ly === 52 || ly === 74) return TILE.PARK_PATH;
        return TILE.PARK_PLAZA;
      }
      break;
    }

    case 'rittenhouse': {
      if (inRect(lx, ly, 45, 47, 83, 81)) {
        const onBorder = lx === 45 || lx === 83 || ly === 47 || ly === 81;
        const onGate = Math.abs(lx - 64) <= 2 || Math.abs(ly - 62) <= 2;
        if (onBorder && !onGate) return TILE.FENCE;
        if (inRect(lx, ly, 58, 56, 70, 68)) return TILE.PARK_PLAZA;
        if (Math.abs(lx - 64) <= 1 || Math.abs(ly - 62) <= 1) return TILE.PARK_PATH;
        if (Math.abs((lx - 64) - (ly - 62)) <= 1 || Math.abs((lx - 64) + (ly - 62)) <= 1) return TILE.PARK_PATH;
        if ((lx === 56 || lx === 72) && (ly >= 54 && ly <= 70)) return TILE.FLOWERBED;
        return ((lx + ly) % 5 === 0) ? TILE.GRASS_FLOWER : TILE.GRASS;
      }
      break;
    }

    case 'civic_works': {
      if (inRect(lx, ly, 44, 48, 66, 78)) return TILE.TECH_FLOOR;
      if (inRect(lx, ly, 67, 48, 88, 80)) {
        if (ly === 52 || ly === 74) return TILE.FLOWERBED;
        return lx >= 82 ? TILE.PARK_PLAZA : TILE.MARBLE;
      }
      break;
    }
  }

  // Outer-block Pocket Plazas, Cross-Walkways & Landscaped Courtyards across all 9 outer/side lots
  const inLakeExclusion = (sectorId === 'woodland' && inRect(lx, ly, 74, 64, 98, 84))
    || (sectorId === 'coastal' && (lx < 28 || inRect(lx, ly, 12, 54, 46, 88)));
  if (!inLakeExclusion) {
    // Pocket plazas centered in NW (22,25), NE (105,25), SW (22,103), SE (105,103)
    const drawPocketPlaza = (cx, cy) => {
      if (inRect(lx, ly, cx - 3, cy - 3, cx + 3, cy + 3)) {
        const edge = lx === cx - 3 || lx === cx + 3 || ly === cy - 3 || ly === cy + 3;
        if (edge && lx !== cx && ly !== cy) return TILE.FLOWERBED;
        return apronTile;
      }
      return null;
    };
    const pNW = drawPocketPlaza(22, 25); if (pNW) return pNW;
    const pNE = drawPocketPlaza(105, 25); if (pNE) return pNE;
    const pSW = drawPocketPlaza(22, 103); if (pSW) return pSW;
    const pSE = drawPocketPlaza(105, 103); if (pSE) return pSE;

    // Cross-lot walkways linking outer buildings to avenues
    if (inRect(lx, ly, 8, 8, 35, 39) && (ly === 25 || lx === 22)) return TILE.PARK_PATH;
    if (inRect(lx, ly, 93, 8, 120, 39) && (ly === 25 || lx === 105)) return TILE.PARK_PATH;
    if (inRect(lx, ly, 8, 89, 35, 120) && (ly === 103 || lx === 22)) return TILE.PARK_PATH;
    if (inRect(lx, ly, 93, 89, 120, 120) && (ly === 103 || lx === 105)) return TILE.PARK_PATH;
    if (inRect(lx, ly, 43, 8, 85, 39) && ly === 25) return TILE.PARK_PATH;
    if (inRect(lx, ly, 43, 89, 85, 120) && ly === 103) return TILE.PARK_PATH;
    if (inRect(lx, ly, 8, 47, 35, 81) && (lx === 21 || ly === 74)) return TILE.PARK_PATH;
    if (inRect(lx, ly, 93, 47, 120, 81) && (lx === 105 || ly === 74)) return TILE.PARK_PATH;
    if (inRect(lx, ly, 54, 21, 59, 27) || inRect(lx, ly, 69, 21, 74, 27)) return apronTile;
    if (inRect(lx, ly, 54, 101, 59, 107) || inRect(lx, ly, 69, 101, 74, 107)) return apronTile;
  }

  return sectorBaseTile(sectorId, lx, ly);
}

// 14 to 16 Complete LimeZu Pure-Sprite Buildings per Sector across ALL inner & outer lots
const RAW_SECTOR_BUILDINGS = {
  midtown: [
    { name: 'Midtown Espresso Roastery', shortName: 'ESPRESSO', lx: 45, ly: 47, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'Rittenhouse Commons Lofts', shortName: 'COMMONS', lx: 75, ly: 47, w: 7, h: 6, spriteKey: 'midtown_condo' },
    { name: 'Hermes Studio Tower', shortName: 'STUDIO HQ', lx: 45, ly: 69, w: 6, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Vinyl & Press Annex', shortName: 'PRESS', lx: 75, ly: 69, w: 7, h: 7, spriteKey: 'metro_music' },
    { name: 'North Market Corner', shortName: 'MARKET', lx: 46, ly: 32, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'Walnut Street Gelato', shortName: 'GELATO', lx: 72, ly: 32, w: 7, h: 7, spriteKey: 'bldg_ice_cream' },
    { name: 'Liberty Post & Exchange', shortName: 'POST', lx: 94, ly: 50, w: 7, h: 7, spriteKey: 'bldg_post_office' },
    { name: 'Westside Brick Roasters', shortName: 'ROASTERS', lx: 10, ly: 12, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Northwest Pocket Villa', shortName: 'NW VILLA', lx: 26, ly: 28, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'Midtown North Foundry', shortName: 'NORTH LAB', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'Chestnut Heights Tower', shortName: 'CHESTNUT', lx: 72, ly: 12, w: 7, h: 7, spriteKey: 'bldg_condo_tall' },
    { name: 'Northeast Grocers', shortName: 'GROCERS', lx: 95, ly: 12, w: 7, h: 7, spriteKey: 'bldg_market_2' },
    { name: 'Sansom Corner Residences', shortName: 'SANSOM', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'midtown_condo' },
    { name: 'Southside Creamery', shortName: 'CREAMERY', lx: 14, ly: 70, w: 7, h: 7, spriteKey: 'bldg_ice_cream' },
    { name: 'Southwest Conservatory', shortName: 'ATRIUM', lx: 10, ly: 91, w: 7, h: 7, spriteKey: 'bldg_greenhouse' },
    { name: 'SE Avenue Studios', shortName: 'STUDIOS', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'metro_music' }
  ],
  conservatory: [
    { name: 'Grand Conservatory Hall', shortName: 'CONSERVATORY', lx: 50, ly: 48, w: 8, h: 6, spriteKey: 'bldg_greenhouse' },
    { name: 'Botanical Apothecary', shortName: 'BOTANICA', lx: 72, ly: 48, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'Athenaeum Library North', shortName: 'ARCHIVE', lx: 46, ly: 32, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'Museum Fine Arts Wing', shortName: 'GALLERY', lx: 72, ly: 32, w: 7, h: 7, spriteKey: 'bldg_villa_2' },
    { name: 'Herbarium Cottage', shortName: 'HERBARIUM', lx: 25, ly: 52, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Gardeners Supply Guild', shortName: 'GARDEN CO.', lx: 94, ly: 52, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'Orchid Glass Pavilion', shortName: 'ORCHID', lx: 10, ly: 12, w: 7, h: 7, spriteKey: 'bldg_greenhouse' },
    { name: 'Scholar Brick Cloister', shortName: 'CLOISTER', lx: 26, ly: 28, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Arboretum Seed Exchange', shortName: 'SEEDS', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'Folio Print & Bindery', shortName: 'BINDERY', lx: 72, ly: 12, w: 7, h: 7, spriteKey: 'bldg_post_office' },
    { name: 'East Botanical Villa', shortName: 'EAST VILLA', lx: 95, ly: 12, w: 7, h: 7, spriteKey: 'bldg_villa_2' },
    { name: 'Curator Rowhouse', shortName: 'CURATOR', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'midtown_condo' },
    { name: 'Tea & Sorbet Annex', shortName: 'SORBET', lx: 14, ly: 70, w: 7, h: 7, spriteKey: 'bldg_ice_cream' },
    { name: 'South Reading Commons', shortName: 'COMMONS', lx: 46, ly: 90, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'Southeast Fern House', shortName: 'FERN HOUSE', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'bldg_greenhouse' }
  ],
  kyoto: [
    { name: 'Kyoto Timber Minka', shortName: 'MINKA', lx: 64, ly: 47, w: 7, h: 7, spriteKey: 'kyoto_house' },
    { name: 'Matcha Tea Gatehouse', shortName: 'TEA HOUSE', lx: 47, ly: 52, w: 6, h: 6, spriteKey: 'midtown_cafe' },
    { name: 'North Shrine Villa', shortName: 'PAVILION', lx: 46, ly: 32, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'Lantern Craft Market', shortName: 'LANTERN', lx: 72, ly: 32, w: 7, h: 7, spriteKey: 'bldg_market_2' },
    { name: 'Zen Scholar Residence', shortName: 'RESIDENCE', lx: 94, ly: 52, w: 7, h: 7, spriteKey: 'kyoto_house' },
    { name: 'Koi Garden Villa', shortName: 'KOI VILLA', lx: 72, ly: 90, w: 7, h: 7, spriteKey: 'bldg_villa_2' },
    { name: 'Northwest Cedar Ryokan', shortName: 'RYOKAN', lx: 10, ly: 12, w: 7, h: 7, spriteKey: 'kyoto_house' },
    { name: 'Bamboo Sweet Shop', shortName: 'WAGASHI', lx: 26, ly: 28, w: 7, h: 7, spriteKey: 'bldg_ice_cream' },
    { name: 'Calligraphy Hall', shortName: 'SHODO', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'bldg_villa_2' },
    { name: 'Kyoto Incense Guild', shortName: 'INCENSE', lx: 72, ly: 12, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'East Hills Machiya', shortName: 'MACHIYA', lx: 95, ly: 12, w: 7, h: 7, spriteKey: 'kyoto_house' },
    { name: 'Silk & Timber Studio', shortName: 'SILK LOFT', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'woodland_cabin' },
    { name: 'South Pond Bakery', shortName: 'BAKERY', lx: 10, ly: 91, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'South Courtyard Archive', shortName: 'KYOTO PRESS', lx: 46, ly: 90, w: 7, h: 7, spriteKey: 'bldg_post_office' },
    { name: 'Southeast Tea Barn', shortName: 'SENCHA', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'kyoto_house' }
  ],
  woodland: [
    { name: 'Lakeside Timber Lodge', shortName: 'LODGE', lx: 46, ly: 48, w: 7, h: 7, spriteKey: 'woodland_cabin' },
    { name: 'Ranger Canvas Outpost', shortName: 'OUTPOST', lx: 74, ly: 50, w: 5, h: 5, spriteKey: 'woodland_tent' },
    { name: 'Pinecrest Camper Retreat', shortName: 'CAMPER', lx: 46, ly: 33, w: 7, h: 6, spriteKey: 'bldg_camper' },
    { name: 'Woodland Outfitter Store', shortName: 'OUTFITTER', lx: 72, ly: 32, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'Birchwood Cabin East', shortName: 'CABIN II', lx: 94, ly: 50, w: 7, h: 7, spriteKey: 'woodland_cabin' },
    { name: 'Trailhead Trading Post', shortName: 'TRADING', lx: 25, ly: 50, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'Northern Pine Cabin', shortName: 'PINE CABIN', lx: 10, ly: 12, w: 7, h: 7, spriteKey: 'woodland_cabin' },
    { name: 'Scout Tent Clearing', shortName: 'CAMP WEST', lx: 26, ly: 28, w: 5, h: 5, spriteKey: 'woodland_tent' },
    { name: 'Fern Creek Greenhouse', shortName: 'FERNERY', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'bldg_greenhouse' },
    { name: 'Forest Airstream Hub', shortName: 'TRAILER', lx: 72, ly: 12, w: 7, h: 6, spriteKey: 'bldg_camper' },
    { name: 'East Ridge Ranger Hall', shortName: 'RANGER HQ', lx: 95, ly: 12, w: 7, h: 7, spriteKey: 'woodland_cabin' },
    { name: 'Cedar Post Station', shortName: 'CEDAR POST', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'bldg_post_office' },
    { name: 'Southwest Lake House', shortName: 'LAKEHOUSE', lx: 10, ly: 91, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'South Trail Cafe', shortName: 'TRAIL CAFE', lx: 46, ly: 90, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'Southeast Woodshop', shortName: 'WOODSHOP', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'bldg_hardware' }
  ],
  coastal: [
    { name: 'Coral Harbormaster Inn', shortName: 'HARBOR INN', lx: 66, ly: 49, w: 7, h: 6, spriteKey: 'bldg_villa_2' },
    { name: 'Boardwalk Bandstand', shortName: 'STAGE', lx: 50, ly: 66, w: 7, h: 5, spriteKey: 'bldg_beach_stage' },
    { name: 'Surf & Sundae Shack', shortName: 'SUNDAE', lx: 72, ly: 32, w: 7, h: 7, spriteKey: 'bldg_ice_cream' },
    { name: 'Seaside Bait & Tackle', shortName: 'MARINA CO.', lx: 48, ly: 32, w: 7, h: 7, spriteKey: 'bldg_market_2' },
    { name: 'Coastal Post & Charts', shortName: 'CHARTS', lx: 94, ly: 52, w: 7, h: 7, spriteKey: 'bldg_post_office' },
    { name: 'Beachside Bakery', shortName: 'BAKERY', lx: 72, ly: 90, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'Dune Cottage North', shortName: 'DUNE HOUSE', lx: 28, ly: 12, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'Surf Camper Cove', shortName: 'SURF VAN', lx: 28, ly: 28, w: 7, h: 6, spriteKey: 'bldg_camper' },
    { name: 'Harbor Oyster Market', shortName: 'OYSTERS', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'Pelican Point Condos', shortName: 'PELICAN', lx: 72, ly: 12, w: 7, h: 7, spriteKey: 'midtown_condo' },
    { name: 'East Pier Amphitheater', shortName: 'PIER STAGE', lx: 95, ly: 12, w: 7, h: 5, spriteKey: 'bldg_beach_stage' },
    { name: 'Sailmaker Workshop', shortName: 'SAILS', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'Driftwood Espresso', shortName: 'DRIFTWOOD', lx: 106, ly: 70, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'South Sands Suites', shortName: 'SANDS', lx: 46, ly: 90, w: 7, h: 7, spriteKey: 'bldg_villa_2' },
    { name: 'SE Gelato Boardwalk', shortName: 'GELATO CO.', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'bldg_ice_cream' }
  ],
  broadcast: [
    { name: 'Synth Lab Broadcast HQ', shortName: 'BROADCAST', lx: 46, ly: 64, w: 7, h: 7, spriteKey: 'bldg_condo_tall' },
    { name: 'Acoustic Recording Deck', shortName: 'SYNTH LAB', lx: 72, ly: 48, w: 7, h: 7, spriteKey: 'metro_music' },
    { name: 'Signal Tower North', shortName: 'SIGNAL HQ', lx: 46, ly: 32, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Hardware R&D Foundry', shortName: 'HARDWARE', lx: 74, ly: 32, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'Telemetry Control Hub', shortName: 'TELEMETRY', lx: 25, ly: 50, w: 7, h: 7, spriteKey: 'midtown_condo' },
    { name: 'Studio Espresso Bar', shortName: 'GREENROOM', lx: 94, ly: 50, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'Orbital Uplink Annex', shortName: 'UPLINK', lx: 10, ly: 12, w: 7, h: 7, spriteKey: 'bldg_post_office' },
    { name: 'Frequency Test Loft', shortName: 'FREQ LOFT', lx: 26, ly: 28, w: 7, h: 7, spriteKey: 'bldg_condo_tall' },
    { name: 'Data Center East', shortName: 'DATACENTER', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'midtown_condo' },
    { name: 'Laser Synth Gallery', shortName: 'MODULAR', lx: 72, ly: 12, w: 7, h: 7, spriteKey: 'metro_music' },
    { name: 'Patch Cable Exchange', shortName: 'CABLE MART', lx: 95, ly: 12, w: 7, h: 7, spriteKey: 'bldg_market_2' },
    { name: 'Neon Control Towers', shortName: 'NEON HQ', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Nightshift Snack Bar', shortName: 'SNACK LAB', lx: 14, ly: 70, w: 7, h: 7, spriteKey: 'bldg_ice_cream' },
    { name: 'South Antenna Flats', shortName: 'FLATS', lx: 46, ly: 90, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'SE Acoustic Press', shortName: 'VINYL LAB', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'metro_music' }
  ],
  metro: [
    { name: 'Central Terminal Arcade', shortName: 'TERMINAL', lx: 56, ly: 46, w: 8, h: 6, spriteKey: 'bldg_post_office' },
    { name: 'Wax & Vinyl Corner', shortName: 'VINYL ROW', lx: 44, ly: 56, w: 7, h: 7, spriteKey: 'metro_music' },
    { name: 'Artisanal Bakehouse', shortName: 'BAKEHOUSE', lx: 76, ly: 62, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'Fresh Food Market Hall', shortName: 'FOOD HALL', lx: 46, ly: 32, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'Night Market Annex', shortName: 'BAZAAR', lx: 72, ly: 32, w: 7, h: 7, spriteKey: 'bldg_market_2' },
    { name: 'Concourse Towers', shortName: 'TOWERS', lx: 94, ly: 50, w: 7, h: 7, spriteKey: 'bldg_condo_tall' },
    { name: 'Union Flats West', shortName: 'UNION WEST', lx: 10, ly: 12, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Subway Plaza Books', shortName: 'KIOSK HQ', lx: 26, ly: 28, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'Arcade Row Lofts', shortName: 'ARCADE', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'midtown_condo' },
    { name: 'Gelateria Centrale', shortName: 'GELATERIA', lx: 72, ly: 12, w: 7, h: 7, spriteKey: 'bldg_ice_cream' },
    { name: 'East Platform Inn', shortName: 'PLATFORM', lx: 95, ly: 12, w: 7, h: 7, spriteKey: 'bldg_villa_2' },
    { name: 'Transit Hardware Depot', shortName: 'TRANSIT CO', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'Southwest Night Bistro', shortName: 'METRO CAFE', lx: 10, ly: 91, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'South Market Pavilion', shortName: 'PAVILION', lx: 46, ly: 90, w: 7, h: 7, spriteKey: 'bldg_market_2' },
    { name: 'SE Atrium Flats', shortName: 'ATRIUM', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'bldg_condo_tall' }
  ],
  rittenhouse: [
    { name: 'Parc Brasserie & Terrace', shortName: 'PARC BISTRO', lx: 72, ly: 32, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'Curtis Institute Hall', shortName: 'CURTIS HALL', lx: 46, ly: 32, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'Barclay Rowhouses', shortName: 'BARCLAY', lx: 25, ly: 50, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Walnut Fine Books', shortName: 'BOOKSHOP', lx: 94, ly: 50, w: 7, h: 7, spriteKey: 'metro_music' },
    { name: 'Rittenhouse Residences', shortName: 'THE DORCHESTER', lx: 46, ly: 90, w: 7, h: 7, spriteKey: 'bldg_condo_tall' },
    { name: 'Square Creamery', shortName: 'CREAMERY', lx: 72, ly: 90, w: 7, h: 7, spriteKey: 'bldg_ice_cream' },
    { name: 'Sansom Brownstones', shortName: 'SANSOM ROW', lx: 10, ly: 12, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Art Club Atelier', shortName: 'ATELIER', lx: 26, ly: 28, w: 7, h: 7, spriteKey: 'bldg_villa_2' },
    { name: 'Di Bruno Gourmet', shortName: 'DI BRUNO', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'Walnut Conservatory', shortName: 'FLORA HALL', lx: 72, ly: 12, w: 7, h: 7, spriteKey: 'bldg_greenhouse' },
    { name: 'Philadelphia Exchange', shortName: 'EXCHANGE', lx: 95, ly: 12, w: 7, h: 7, spriteKey: 'bldg_post_office' },
    { name: 'Locust Townhomes', shortName: 'LOCUST', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'midtown_condo' },
    { name: 'Spruce Pastry Shop', shortName: 'PATISSERIE', lx: 14, ly: 70, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'Southwest Rowhouses', shortName: 'PINE ROW', lx: 10, ly: 91, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'Southeast Chamber Wing', shortName: 'RECITAL', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'bldg_villa_2' }
  ],
  civic_works: [
    { name: 'Foundry Operations Bay', shortName: 'FOUNDRY', lx: 46, ly: 48, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'Recovery Spa & Clinic', shortName: 'MED-BAY SPA', lx: 69, ly: 48, w: 7, h: 7, spriteKey: 'bldg_villa_2' },
    { name: 'Civic Postal Depot', shortName: 'DEPOT', lx: 46, ly: 32, w: 7, h: 7, spriteKey: 'bldg_post_office' },
    { name: 'Engineering Dorms', shortName: 'QUARTERS', lx: 72, ly: 32, w: 7, h: 7, spriteKey: 'midtown_condo' },
    { name: 'Hydroponic Greenhouse', shortName: 'BIO-LAB', lx: 94, ly: 50, w: 7, h: 7, spriteKey: 'bldg_greenhouse' },
    { name: 'Red-Team Supply Mart', shortName: 'SUPPLY', lx: 25, ly: 50, w: 7, h: 7, spriteKey: 'bldg_market_1' },
    { name: 'West Reactor Foundry', shortName: 'REACTOR', lx: 10, ly: 12, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'Field Triage Outpost', shortName: 'TRIAGE', lx: 26, ly: 28, w: 7, h: 7, spriteKey: 'bldg_villa_1' },
    { name: 'North Commissary', shortName: 'COMMISSARY', lx: 46, ly: 12, w: 7, h: 7, spriteKey: 'bldg_market_2' },
    { name: 'Telemetry Barracks', shortName: 'BARRACKS', lx: 72, ly: 12, w: 7, h: 7, spriteKey: 'bldg_condo_brick' },
    { name: 'Security Control Bunk', shortName: 'SECURITY', lx: 95, ly: 12, w: 7, h: 7, spriteKey: 'bldg_condo_tall' },
    { name: 'Botanical Cleanroom', shortName: 'CLEANROOM', lx: 110, ly: 28, w: 7, h: 7, spriteKey: 'bldg_greenhouse' },
    { name: 'Med-Bay Espresso Annex', shortName: 'REHAB CAFE', lx: 14, ly: 70, w: 7, h: 7, spriteKey: 'midtown_cafe' },
    { name: 'South Motor Pool', shortName: 'MOTOR POOL', lx: 46, ly: 90, w: 7, h: 7, spriteKey: 'bldg_hardware' },
    { name: 'SE Logistics Wing', shortName: 'LOGISTICS', lx: 95, ly: 91, w: 7, h: 7, spriteKey: 'bldg_post_office' }
  ]
};

const RAW_SECTOR_SCENERY = {
  midtown: [
    { spriteKey: 'bench_park', lx: 58, ly: 59, w: 2.2, h: 1 },
    { spriteKey: 'bench_park', lx: 69, ly: 59, w: 2.2, h: 1 },
    { spriteKey: 'bistro_table_2', lx: 60, ly: 73, w: 1.4, h: 1.5 },
    { spriteKey: 'bistro_table', lx: 68, ly: 73, w: 1.4, h: 1.5 },
    { spriteKey: 'bus_stop', lx: 56, ly: 41, w: 2.2, h: 1.8 },
    { spriteKey: 'mailbox', lx: 53, ly: 46, w: 1.2, h: 1.5 },
    { spriteKey: 'news_box', lx: 73, ly: 46, w: 1.2, h: 1.5 },
    { spriteKey: 'statue_goat', lx: 22, ly: 24, w: 1.6, h: 2 },
    { spriteKey: 'season_flower_cart', lx: 105, ly: 25, w: 2, h: 2 },
    { spriteKey: 'fountain_grand', lx: 22, ly: 103, w: 3, h: 3 },
    { spriteKey: 'bistro_table', lx: 105, ly: 103, w: 1.4, h: 1.5 }
  ],
  conservatory: [
    { spriteKey: 'fountain_grand', lx: 62, ly: 68, w: 3, h: 3 },
    { spriteKey: 'bench_park', lx: 54, ly: 72, w: 2.2, h: 1 },
    { spriteKey: 'statue_goat', lx: 70, ly: 72, w: 1.6, h: 2 },
    { spriteKey: 'flowerbed', lx: 53, ly: 54, w: 1.8, h: 1 },
    { spriteKey: 'flowerbed', lx: 73, ly: 54, w: 1.8, h: 1 },
    { spriteKey: 'fountain_grand', lx: 22, ly: 25, w: 3, h: 3 },
    { spriteKey: 'season_flower_cart', lx: 105, ly: 25, w: 2, h: 2 },
    { spriteKey: 'bench_park', lx: 22, ly: 103, w: 2.2, h: 1 },
    { spriteKey: 'statue_goat', lx: 105, ly: 103, w: 1.6, h: 2 }
  ],
  kyoto: [
    { spriteKey: 'bench_h', lx: 68, ly: 66, w: 1.6, h: 1.2 },
    { spriteKey: 'flowerbed', lx: 56, ly: 74, w: 1.8, h: 1 },
    { spriteKey: 'bench_park', lx: 60, ly: 72, w: 2.2, h: 1 },
    { spriteKey: 'season_flower_cart', lx: 22, ly: 25, w: 2, h: 2 },
    { spriteKey: 'bench_h', lx: 105, ly: 25, w: 1.6, h: 1.2 },
    { spriteKey: 'flowerbed', lx: 22, ly: 103, w: 1.8, h: 1 },
    { spriteKey: 'bench_park', lx: 105, ly: 103, w: 2.2, h: 1 }
  ],
  woodland: [
    { spriteKey: 'bench_h', lx: 64, ly: 69, w: 1.6, h: 1.2 },
    { spriteKey: 'bistro_table', lx: 56, ly: 63, w: 1.4, h: 1.4 },
    { spriteKey: 'bench_park', lx: 52, ly: 72, w: 2.2, h: 1 },
    { spriteKey: 'woodland_campfire', lx: 22, ly: 25, w: 1.6, h: 1.4 },
    { spriteKey: 'bench_h', lx: 105, ly: 25, w: 1.6, h: 1.2 },
    { spriteKey: 'woodland_campfire', lx: 22, ly: 103, w: 1.6, h: 1.4 },
    { spriteKey: 'bench_park', lx: 105, ly: 103, w: 2.2, h: 1 }
  ],
  coastal: [
    { spriteKey: 'coastal_umbrella', lx: 65, ly: 68, w: 2, h: 2.4 },
    { spriteKey: 'coastal_umbrella', lx: 71, ly: 73, w: 2, h: 2.4 },
    { spriteKey: 'bistro_table', lx: 53, ly: 58, w: 1.4, h: 1.4 },
    { spriteKey: 'bistro_table_2', lx: 64, ly: 74, w: 1.4, h: 1.4 },
    { spriteKey: 'coastal_umbrella', lx: 105, ly: 25, w: 2, h: 2.4 },
    { spriteKey: 'coastal_umbrella', lx: 105, ly: 103, w: 2, h: 2.4 },
    { spriteKey: 'bistro_table', lx: 100, ly: 76, w: 1.4, h: 1.4 }
  ],
  broadcast: [
    { spriteKey: 'bus_stop', lx: 52, ly: 41, w: 2.2, h: 1.8 },
    { spriteKey: 'bench_h', lx: 56, ly: 74, w: 1.6, h: 1.2 },
    { spriteKey: 'bistro_table', lx: 74, ly: 70, w: 1.4, h: 1.4 },
    { spriteKey: 'turnstile', lx: 22, ly: 25, w: 1.6, h: 2 },
    { spriteKey: 'bench_park', lx: 105, ly: 25, w: 2.2, h: 1 },
    { spriteKey: 'news_box', lx: 22, ly: 103, w: 1.2, h: 1.5 },
    { spriteKey: 'bistro_table_2', lx: 105, ly: 103, w: 1.4, h: 1.5 }
  ],
  metro: [
    { spriteKey: 'bench_park', lx: 58, ly: 72, w: 2.2, h: 1 },
    { spriteKey: 'news_box', lx: 54, ly: 64, w: 1.2, h: 1.5 },
    { spriteKey: 'bus_stop', lx: 48, ly: 41, w: 2.2, h: 1.8 },
    { spriteKey: 'bistro_table_2', lx: 72, ly: 68, w: 1.4, h: 1.5 },
    { spriteKey: 'turnstile', lx: 22, ly: 25, w: 1.6, h: 2 },
    { spriteKey: 'season_flower_cart', lx: 105, ly: 25, w: 2, h: 2 },
    { spriteKey: 'bistro_table', lx: 22, ly: 103, w: 1.4, h: 1.5 },
    { spriteKey: 'news_box', lx: 105, ly: 103, w: 1.2, h: 1.5 }
  ],
  rittenhouse: [
    { spriteKey: 'statue_goat', lx: 58, ly: 62, w: 1.6, h: 2 },
    { spriteKey: 'bench_park', lx: 59, ly: 57, w: 2.2, h: 1 },
    { spriteKey: 'bench_park', lx: 69, ly: 57, w: 2.2, h: 1 },
    { spriteKey: 'bistro_table_2', lx: 78, ly: 64, w: 1.4, h: 1.5 },
    { spriteKey: 'flowerbed', lx: 52, ly: 66, w: 1.8, h: 1 },
    { spriteKey: 'fountain_grand', lx: 22, ly: 25, w: 3, h: 3 },
    { spriteKey: 'statue_goat', lx: 105, ly: 25, w: 1.6, h: 2 },
    { spriteKey: 'season_flower_cart', lx: 22, ly: 103, w: 2, h: 2 },
    { spriteKey: 'bench_park', lx: 105, ly: 103, w: 2.2, h: 1 }
  ],
  civic_works: [
    { spriteKey: 'bench_h', lx: 70, ly: 70, w: 1.6, h: 1.2 },
    { spriteKey: 'mailbox', lx: 54, ly: 41, w: 1.2, h: 1.5 },
    { spriteKey: 'bus_stop', lx: 72, ly: 41, w: 2.2, h: 1.8 },
    { spriteKey: 'hydrant', lx: 22, ly: 25, w: 1.1, h: 1.3 },
    { spriteKey: 'bench_park', lx: 105, ly: 25, w: 2.2, h: 1 },
    { spriteKey: 'turnstile', lx: 22, ly: 103, w: 1.6, h: 2 },
    { spriteKey: 'bistro_table', lx: 105, ly: 103, w: 1.4, h: 1.4 }
  ]
};

const BUILDING_CACHE = new Map();
const SCENERY_CACHE = new Map();
const INTERIOR_CACHE = new Map();
const HOME_OWNER_BY_BUILDING = new Map();

export function hashString(str) {
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function registerHomeOwners(residents = []) {
  HOME_OWNER_BY_BUILDING.clear();
  INTERIOR_CACHE.clear();
  if (!Array.isArray(residents)) return;
  for (let i = 0; i < residents.length; i += 1) {
    const r = residents[i];
    if (!r || !r.homeBuildingId) continue;
    HOME_OWNER_BY_BUILDING.set(r.homeBuildingId, {
      id: r.id,
      name: r.name,
      persona: r.persona,
      preferredKind: r.preferredKind,
      skills: r.skills ? { ...r.skills } : undefined,
      inventory: Array.isArray(r.inventory) ? [...r.inventory] : [],
      color: r.color,
      index: i
    });
  }
}

export function getBuildingOwner(buildingId) {
  return HOME_OWNER_BY_BUILDING.get(buildingId) || null;
}

export function getSectorBuildings(sectorId) {
  if (BUILDING_CACHE.has(sectorId)) return BUILDING_CACHE.get(sectorId);
  const sector = BIOME_SECTORS.find((s) => s.id === sectorId);
  if (!sector) return [];
  const { x0, y0 } = getSectorBounds(sector);
  const list = (RAW_SECTOR_BUILDINGS[sectorId] || []).map((b, idx) => ({
    ...b,
    id: `${sectorId}_bldg_${idx}`,
    sectorId,
    x: x0 + b.lx,
    y: y0 + b.ly
  }));
  BUILDING_CACHE.set(sectorId, list);
  return list;
}

function isPublicCafeFirst(b, idx) {
  return idx === 0 && /espresso|bistro|cafe|bakehouse/i.test(String(b?.name || ''));
}

function scoreResidentialFit(b, idx) {
  if (isPublicCafeFirst(b, idx)) return -50;
  let score = idx === 0 ? -40 : 0;
  const nm = String(b?.name || '').toLowerCase();
  if (/(loft|villa|condo|residence|rowhouse|townhome|minka|machiya|ryokan|quarters|flats|house|cabin|cottage|dorm|inn|suite)/.test(nm)) {
    score += 30;
  } else if (/(studio|atelier|study|gallery|sanctuary|pavilion)/.test(nm)) {
    score += 18;
  } else if (/(market|grocers|post|supply|hardware|depot|commissary|hq|hall|conservatory|espresso|cafe|bistro|bakery)/.test(nm)) {
    score -= 10;
  } else {
    score += 5;
  }
  return score;
}

function orderBuildingsForHomes(sectorId, seedIndex = 0) {
  const bldgs = getSectorBuildings(sectorId);
  if (!bldgs.length) return [];
  const offset = Math.abs(Number(seedIndex) || 0) % bldgs.length;
  const rotated = bldgs.map((b, i) => {
    const idx = (i + offset) % bldgs.length;
    return { b: bldgs[idx], idx, score: scoreResidentialFit(bldgs[idx], idx) };
  });
  rotated.sort((a, c) => c.score - a.score);
  return rotated.map((x) => x.b);
}

export function allocateUniqueHomeBuilding(sectorId, claimedBuildingIds = new Set(), seedIndex = 0, unlockedSectorIds = null) {
  const sectorOrder = [sectorId];
  if (unlockedSectorIds && unlockedSectorIds.size > 0) {
    for (const id of unlockedSectorIds) {
      if (!sectorOrder.includes(id)) sectorOrder.push(id);
    }
  }
  for (const s of BIOME_SECTORS) {
    if (!sectorOrder.includes(s.id)) sectorOrder.push(s.id);
  }

  for (const secId of sectorOrder) {
    const ordered = orderBuildingsForHomes(secId, seedIndex);
    for (const b of ordered) {
      if (!claimedBuildingIds.has(b.id)) {
        claimedBuildingIds.add(b.id);
        return b;
      }
    }
  }

  const fallbackPool = getSectorBuildings(sectorId);
  const baseBldg = fallbackPool[Math.abs(Number(seedIndex) || 0) % Math.max(1, fallbackPool.length)];
  if (!baseBldg) return null;
  const suiteId = `${baseBldg.id}_suite_${seedIndex}`;
  claimedBuildingIds.add(suiteId);
  return {
    ...baseBldg,
    id: suiteId,
    name: `${baseBldg.name} Suite ${seedIndex + 1}`,
    shortName: `${baseBldg.shortName} #${seedIndex + 1}`
  };
}

export function getDefaultHomeBuilding(sectorId, index = 0) {
  return allocateUniqueHomeBuilding(sectorId, new Set(), index);
}

export function isBuildingFootprint(gx, gy) {
  const sec = sectorAtTile(gx, gy);
  const buildings = getSectorBuildings(sec.id);
  for (const b of buildings) {
    if (gx >= b.x && gx < b.x + b.w && gy >= b.y && gy < b.y + b.h) {
      return true;
    }
  }
  return false;
}

const TREE_PALETTE = {
  midtown: ['conservatory_tree', 'street_tree', 'street_tree_2'],
  conservatory: ['conservatory_tree', 'tree_sycamore_2', 'street_tree'],
  kyoto: ['conservatory_tree', 'woodland_tree', 'tree_sycamore_2'],
  woodland: ['woodland_tree', 'conservatory_tree', 'tree_sycamore_2'],
  coastal: ['coastal_palm', 'coastal_palm', 'street_tree_2'],
  broadcast: ['street_tree', 'street_tree_2', 'conservatory_tree'],
  metro: ['street_tree_2', 'street_tree', 'conservatory_tree'],
  rittenhouse: ['tree_sycamore_2', 'conservatory_tree', 'street_tree'],
  civic_works: ['street_tree', 'woodland_tree', 'street_tree_2']
};

export function getSectorScenery(sectorId) {
  if (SCENERY_CACHE.has(sectorId)) return SCENERY_CACHE.get(sectorId);
  const sector = BIOME_SECTORS.find((s) => s.id === sectorId);
  if (!sector) return [];
  const { x0, y0 } = getSectorBounds(sector);
  const buildings = getSectorBuildings(sectorId);
  const used = new Set();
  const list = [];

  const isFree = (lx, ly, allowRoad = false) => {
    if (lx < 4 || lx >= SECTOR_TILES - 4 || ly < 4 || ly >= SECTOR_TILES - 4) return false;
    const key = `${Math.round(lx)},${Math.round(ly)}`;
    if (used.has(key)) return false;
    const gx = x0 + Math.round(lx);
    const gy = y0 + Math.round(ly);
    for (const b of buildings) {
      if (gx >= b.x - 1 && gx <= b.x + b.w && gy >= b.y - 1 && gy <= b.y + b.h) return false;
    }
    for (const st of sector.stations) {
      if (Math.abs(gx - st.x) <= 2 && Math.abs(gy - st.y) <= 2) return false;
    }
    const t = getBiomeTile(sectorId, gx, gy);
    if (t === TILE.WATER || t === TILE.FENCE || t === TILE.TATAMI) return false;
    if (!allowRoad && (t === TILE.ROAD || t === TILE.CROSSWALK)) return false;
    return true;
  };

  const pushProp = (spriteKey, lx, ly, w, h, allowRoad = false) => {
    if (!isFree(lx, ly, allowRoad)) return false;
    used.add(`${Math.round(lx)},${Math.round(ly)}`);
    list.push({
      id: `${sectorId}_prop_${list.length}`,
      sectorId,
      spriteKey,
      lx,
      ly,
      x: x0 + lx,
      y: y0 + ly,
      w,
      h
    });
    return true;
  };

  // 1. Handcrafted sector focal props & outer pocket-park centerpieces
  for (const item of RAW_SECTOR_SCENERY[sectorId] || []) {
    pushProp(item.spriteKey, item.lx, item.ly, item.w, item.h, Boolean(item.onRoad));
  }

  // 2. Automatic building forecourt & backyard props (2-3 props flanking every building)
  for (const b of buildings) {
    const sk = b.spriteKey;
    const isCafe = sk === 'midtown_cafe' || sk === 'bldg_ice_cream' || sk === 'bldg_market_1' || sk === 'bldg_market_2';
    const isCivic = sk === 'bldg_post_office' || sk === 'bldg_hardware' || sk === 'bldg_condo_tall';
    if (isCafe) {
      pushProp('bistro_table', b.lx - 1, b.ly + b.h + 1, 1.4, 1.5);
      pushProp('bistro_table_2', b.lx + b.w, b.ly + b.h + 1, 1.4, 1.5);
      pushProp('trashbin', b.lx + b.w + 1, b.ly + b.h, 1.1, 1.2);
    } else if (isCivic) {
      pushProp('mailbox', b.lx - 1, b.ly + b.h + 1, 1.2, 1.5);
      pushProp('news_box', b.lx + b.w, b.ly + b.h + 1, 1.2, 1.5);
      pushProp('bench_h', b.lx + Math.floor(b.w / 2), b.ly - 1, 1.6, 1.2);
    } else {
      pushProp('flowerbed', b.lx - 1, b.ly + b.h + 1, 1.8, 1);
      pushProp('bench_h', b.lx + b.w, b.ly + b.h + 1, 1.6, 1.2);
      pushProp('flowerbed', b.lx + Math.floor(b.w / 2), b.ly - 1, 1.8, 1);
    }
  }

  // 3. Continuous avenue & outer-block streetlamps
  const lampKey = (sectorId === 'broadcast' || sectorId === 'civic_works') ? 'lamp_modern' : 'midtown_lamp';
  for (let ly = 12; ly <= 116; ly += 10) {
    pushProp(lampKey, 37, ly, 0.7, 1.6);
    pushProp(lampKey, 91, ly, 0.7, 1.6);
    pushProp(lampKey, 21, ly, 0.7, 1.6);
    pushProp(lampKey, 106, ly, 0.7, 1.6);
  }
  for (let lx = 12; lx <= 116; lx += 10) {
    if (Math.abs(lx - 39) < 3 || Math.abs(lx - 89) < 3) continue;
    pushProp(lampKey, lx, 41, 0.7, 1.6);
    pushProp(lampKey, lx, 87, 0.7, 1.6);
    pushProp(lampKey, lx, 24, 0.7, 1.6);
    pushProp(lampKey, lx, 102, 0.7, 1.6);
  }

  // 4. Full-grid canopy tree boulevards & outer pocket-park groves (NW, NE, SW, SE, Center)
  const trees = TREE_PALETTE[sectorId] || TREE_PALETTE.midtown;
  let treeIdx = 0;
  for (let lx = 8; lx <= 120; lx += 9) {
    pushProp(trees[treeIdx++ % trees.length], lx, 9, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], lx, 29, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], lx, 46, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], lx, 82, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], lx, 98, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], lx, 117, 1.8, 2.4);
  }
  for (let ly = 10; ly <= 118; ly += 9) {
    pushProp(trees[treeIdx++ % trees.length], 9, ly, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], 34, ly, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], 43, ly, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], 85, ly, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], 93, ly, 1.8, 2.4);
    pushProp(trees[treeIdx++ % trees.length], 118, ly, 1.8, 2.4);
  }

  // 5. Outer & center street furniture (hydrants, bins, benches, flowerbeds, news boxes, carts)
  const urbanExtras = ['hydrant', 'trashbin', 'flowerbed', 'bench_h', 'bistro_table', 'news_box', 'mailbox'];
  for (let idx = 0; idx < 32; idx++) {
    const key = urbanExtras[idx % urbanExtras.length];
    const lx = 10 + ((idx * 13) % 108);
    const ly = [25, 40, 88, 103][idx % 4];
    pushProp(key, lx, ly, 1.1, 1.2);
  }
  const parkBenches = [
    [19, 24], [25, 24], [102, 24], [108, 24],
    [19, 102], [25, 102], [102, 102], [108, 102],
    [56, 22], [71, 22], [56, 102], [71, 102]
  ];
  for (let i = 0; i < parkBenches.length; i++) {
    pushProp(i % 2 === 0 ? 'bench_park' : 'flowerbed', parkBenches[i][0], parkBenches[i][1], 1.8, 1.1);
  }

  SCENERY_CACHE.set(sectorId, list);
  return list;
}

const CROSSWALK_LX = [39, 64, 89];
const CROSSWALK_LY = [43, 64, 85];

export function getTrafficVehicles(tickCount, worldSpec, entities = []) {
  const sectors = worldSpec?.sectors || [];
  const vehicles = [];
  const t = Number(tickCount) || 0;

  for (let sIdx = 0; sIdx < sectors.length; sIdx++) {
    const s = sectors[sIdx];
    if (!s.unlocked) continue;
    const { x0, y0 } = s.bounds;

    const specs = [
      { id: `${s.id}_bus`, axis: 'ew', spriteKey: 'bus_septa', ly: 43, dir: 1, speed: 0.24, phase: sIdx * 23, w: 4, h: 2.2 },
      { id: `${s.id}_car_e`, axis: 'ew', spriteKey: sIdx % 2 === 0 ? 'car_blue' : 'car_red', ly: 43, dir: 1, speed: 0.24, phase: (64 + sIdx * 23) % SECTOR_TILES, w: 2.8, h: 1.6 },
      { id: `${s.id}_car_w`, axis: 'ew', spriteKey: sIdx % 2 === 0 ? 'car_taxi' : 'car_green', ly: 85, dir: -1, speed: 0.28, phase: 32 + sIdx * 19, w: 2.8, h: 1.6 },
      { id: `${s.id}_car_s`, axis: 'ns', spriteKey: sIdx % 2 === 0 ? 'car_red_down' : 'car_blue_down', lx: 39, dir: 1, speed: 0.25, phase: 16 + sIdx * 21, w: 1.6, h: 2.6 },
      { id: `${s.id}_car_n`, axis: 'ns', spriteKey: sIdx % 2 === 0 ? 'car_green_up' : 'car_taxi_up', lx: 89, dir: -1, speed: 0.26, phase: 72 + sIdx * 13, w: 1.6, h: 2.6 }
    ];

    const sectorEwVehicles = [];
    for (const sp of specs) {
      const travel = (t * sp.speed + sp.phase) % SECTOR_TILES;
      const rawCoord = sp.dir > 0 ? travel : (SECTOR_TILES - 1 - travel);
      let yielding = false;

      if (sp.axis === 'ew') {
        let wx = x0 + rawCoord;
        const wy = y0 + sp.ly;
        for (const cLx of CROSSWALK_LX) {
          const crossX = x0 + cLx;
          const pedBlocking = entities.some((e) => !e.interiorId && Math.hypot(e.x - crossX, e.y - wy) <= 2.5);
          if (!pedBlocking) continue;
          if (sp.dir > 0 && wx >= crossX - 3.4 && wx <= crossX + 1.2) {
            wx = crossX - 3.4;
            yielding = true;
            break;
          }
          if (sp.dir < 0 && wx <= crossX + 3.4 && wx >= crossX - 1.2) {
            wx = crossX + 3.4;
            yielding = true;
            break;
          }
        }
        const vObj = {
          id: sp.id,
          sectorId: s.id,
          spriteKey: sp.spriteKey,
          x: wx,
          y: wy,
          w: sp.w,
          h: sp.h,
          dir: sp.dir > 0 ? 'right' : 'left',
          yielding
        };
        sectorEwVehicles.push(vObj);
        vehicles.push(vObj);
      } else {
        const wx = x0 + sp.lx;
        let wy = y0 + rawCoord;
        for (const cLy of CROSSWALK_LY) {
          const crossY = y0 + cLy;
          const pedBlocking = entities.some((e) => !e.interiorId && Math.hypot(e.x - wx, e.y - crossY) <= 2.5);
          const ewBlocking = sectorEwVehicles.some((ev) => Math.hypot(ev.x - wx, ev.y - crossY) <= 3.8);
          if (!pedBlocking && !ewBlocking) continue;
          if (sp.dir > 0 && wy >= crossY - 3.4 && wy <= crossY + 1.2) {
            wy = crossY - 3.4;
            yielding = true;
            break;
          }
          if (sp.dir < 0 && wy <= crossY + 3.4 && wy >= crossY - 1.2) {
            wy = crossY + 3.4;
            yielding = true;
            break;
          }
        }
        vehicles.push({
          id: sp.id,
          sectorId: s.id,
          spriteKey: sp.spriteKey,
          x: wx,
          y: wy,
          w: sp.w,
          h: sp.h,
          dir: sp.dir > 0 ? 'down' : 'up',
          yielding
        });
      }
    }
  }

  return vehicles;
}

function resolveInteriorArchetype(building) {
  const nm = building.name.toLowerCase();
  if (nm.includes('clinic') || nm.includes('spa') || nm.includes('triage') || nm.includes('cleanroom') || nm.includes('bio-lab')) {
    return 'clinic_spa';
  }
  if (building.sectorId === 'kyoto' || /\btea\b/.test(nm) || nm.includes('ryokan') || nm.includes('shodo')) {
    return 'kyoto_tea_shodo';
  }
  if (nm.includes('espresso') || nm.includes('bakery') || nm.includes('gelato') || nm.includes('bistro') || nm.includes('creamery') || nm.includes('greenroom') || nm.includes('sundae') || nm.includes('patisserie') || nm.includes('bakehouse') || nm.includes('snack')) {
    return 'cafe_bistro';
  }
  if (nm.includes('music') || nm.includes('synth') || nm.includes('broadcast') || /\bpress\b/.test(nm) || nm.includes('studio') || nm.includes('telemetry') || nm.includes('curtis') || nm.includes('stage') || nm.includes('vinyl') || nm.includes('recital')) {
    return 'music_broadcast';
  }
  if (building.sectorId === 'conservatory' || nm.includes('library') || nm.includes('museum') || nm.includes('flora') || nm.includes('greenhouse') || nm.includes('book')) {
    return 'conservatory_rotunda';
  }
  if (building.sectorId === 'woodland' || nm.includes('cabin') || nm.includes('lodge') || nm.includes('timber') || nm.includes('boathouse')) {
    return 'woodland_lodge';
  }
  return 'residential_atelier';
}

const ARCHETYPE_SPECS = {
  cafe_bistro: {
    floor: TILE.WOOD_DECK,
    rugRect: [3, 6, 10, 9],
    stations: [
      { key: 'bar', label: 'Espresso Counter', kind: 'rest', spriteKey: 'counter_bar', x: 4, y: 3, w: 3, h: 2 },
      { key: 'maker', label: 'Pour-Over Station', kind: 'rest', spriteKey: 'coffee_maker', x: 9, y: 2.5, w: 2, h: 2 },
      { key: 'table', label: 'Window Bistro Table', kind: 'social', spriteKey: 'bistro_table_2', x: 13.5, y: 4.5, w: 2, h: 2 },
      { key: 'shelf', label: 'Reading Rack', kind: 'read', spriteKey: 'library_bookshelf', x: 13.5, y: 8.5, w: 2, h: 2 }
    ]
  },
  music_broadcast: {
    floor: TILE.TECH_FLOOR,
    rugRect: [4, 4, 13, 8],
    stations: [
      { key: 'desk', label: 'Workstation Desk', kind: 'work', spriteKey: 'desk_computer', x: 4, y: 3, w: 3, h: 2 },
      { key: 'synth', label: 'Modular Synth Rack', kind: 'work', spriteKey: 'modular_synth', x: 9.5, y: 2.8, w: 2, h: 2 },
      { key: 'vinyl', label: 'Turntable Booth', kind: 'leisure', spriteKey: 'turntable', x: 14, y: 3.5, w: 2, h: 2 },
      { key: 'piano', label: 'Concert Piano', kind: 'leisure', spriteKey: 'grand_piano', x: 4, y: 8, w: 2, h: 2 }
    ]
  },
  clinic_spa: {
    floor: TILE.MARBLE,
    rugRect: [7, 4, 10, 7],
    stations: [
      { key: 'bed', label: 'Recovery Berth', kind: 'rest', spriteKey: 'medical_bed', x: 4, y: 3.5, w: 2, h: 2 },
      { key: 'tub', label: 'Hinoki Soaking Tub', kind: 'rest', spriteKey: 'hinoki_tub', x: 9, y: 3, w: 2, h: 2 },
      { key: 'tea', label: 'Herbal Tea Table', kind: 'think', spriteKey: 'tea_table', x: 13.5, y: 4.5, w: 2, h: 2 },
      { key: 'bench', label: 'Quiet Lounge', kind: 'social', spriteKey: 'bench_park', x: 13.5, y: 8.5, w: 3, h: 1 }
    ]
  },
  kyoto_tea_shodo: {
    floor: TILE.TATAMI,
    rugRect: [7, 3, 10, 8],
    stations: [
      { key: 'tea', label: 'Matcha Tea Table', kind: 'rest', spriteKey: 'tea_table', x: 8.5, y: 5, w: 2, h: 2 },
      { key: 'tub', label: 'Cedar Hinoki Bath', kind: 'rest', spriteKey: 'hinoki_tub', x: 3.5, y: 3, w: 2, h: 2 },
      { key: 'shodo', label: 'Shodo Scroll Alcove', kind: 'read', spriteKey: 'library_bookshelf', x: 14, y: 3, w: 2, h: 2 },
      { key: 'engawa', label: 'Engawa Reflection Bench', kind: 'think', spriteKey: 'bench_h', x: 13.5, y: 8, w: 2, h: 2 }
    ]
  },
  conservatory_rotunda: {
    floor: TILE.MARBLE,
    rugRect: [6, 3, 11, 8],
    stations: [
      { key: 'statue', label: 'Rotunda Bust & Atrium', kind: 'think', spriteKey: 'rittenhouse_statue', x: 8.5, y: 3.5, w: 2, h: 3 },
      { key: 'stacks', label: 'Rare Folio Stacks', kind: 'read', spriteKey: 'library_bookshelf', x: 3.5, y: 3, w: 2, h: 2 },
      { key: 'flora', label: 'Orchid Planter Bed', kind: 'leisure', spriteKey: 'flowerbed', x: 13.5, y: 4, w: 2, h: 1.5 },
      { key: 'study', label: 'Scholar Desk', kind: 'work', spriteKey: 'desk_computer', x: 3.8, y: 8, w: 3, h: 2 }
    ]
  },
  woodland_lodge: {
    floor: TILE.WOOD_DECK,
    rugRect: [6, 4, 11, 7],
    stations: [
      { key: 'hearth', label: 'Stone Timber Hearth', kind: 'social', spriteKey: 'fireplace', x: 8.5, y: 2.5, w: 2, h: 2 },
      { key: 'table', label: 'Drafting Table', kind: 'think', spriteKey: 'tea_table', x: 4, y: 3.5, w: 2, h: 2 },
      { key: 'shelf', label: 'Field Guide Shelf', kind: 'read', spriteKey: 'library_bookshelf', x: 14, y: 3.5, w: 2, h: 2 },
      { key: 'bench', label: 'Fireside Settee', kind: 'rest', spriteKey: 'bench_park', x: 13.2, y: 8, w: 3, h: 1.2 }
    ]
  },
  residential_atelier: {
    floor: TILE.WOOD_DECK,
    rugRect: [5, 4, 12, 7],
    stations: [
      { key: 'hearth', label: 'Warm Hearth', kind: 'social', spriteKey: 'fireplace', x: 8.5, y: 2.5, w: 2, h: 2 },
      { key: 'books', label: 'Reference Stacks', kind: 'read', spriteKey: 'library_bookshelf', x: 3.5, y: 3, w: 2, h: 2 },
      { key: 'study', label: 'Reflection Table', kind: 'think', spriteKey: 'tea_table', x: 13.5, y: 4, w: 2, h: 2 },
      { key: 'desk', label: 'Architect Desk', kind: 'work', spriteKey: 'desk_computer', x: 4, y: 8, w: 3, h: 2 }
    ]
  }
};

const HOME_LAYOUT_PLANS = Object.freeze([
  { id: 'scholar_atrium', label: 'Scholar Atrium', floor: TILE.MARBLE, accent: TILE.WOOD_DECK, accentRect: [2, 2, 7, 5], rugRects: [[5, 3, 12, 6], [3, 7, 7, 9]] },
  { id: 'synthesist_loft', label: 'Synthesist Loft', floor: TILE.TECH_FLOOR, accent: TILE.MARBLE, accentRect: [10, 2, 15, 6], rugRects: [[3, 3, 7, 6], [10, 7, 14, 9]] },
  { id: 'grand_parlour', label: 'Grand Parlour', floor: TILE.WOOD_DECK, accent: TILE.MARBLE, accentRect: [6, 1, 11, 3], rugRects: [[4, 4, 13, 8]] },
  { id: 'zen_engawa', label: 'Zen Engawa Suite', floor: TILE.TATAMI, accent: TILE.WOOD_DECK, accentRect: [13, 2, 15, 9], rugRects: [[5, 3, 10, 8]] },
  { id: 'artisan_workshop', label: 'Artisan Workshop', floor: TILE.WOOD_DECK, accent: TILE.TECH_FLOOR, accentRect: [2, 2, 8, 9], rugRects: [[10, 4, 14, 7], [3, 4, 6, 7]] },
  { id: 'conservatory_salon', label: 'Conservatory Salon', floor: TILE.MARBLE, accent: TILE.PARK_PLAZA, accentRect: [5, 2, 12, 5], rugRects: [[4, 6, 8, 9], [10, 6, 14, 9]] },
  { id: 'harbor_studio', label: 'Harbor Watch Studio', floor: TILE.WOOD_DECK, accent: TILE.SAND, accentRect: [10, 2, 15, 8], rugRects: [[3, 3, 8, 7]] },
  { id: 'chamber_hall', label: 'Chamber Recital Hall', floor: TILE.MARBLE, accent: TILE.WOOD_DECK, accentRect: [3, 2, 14, 4], rugRects: [[6, 5, 11, 9]] }
]);

const HOME_STATION_SLOTS = Object.freeze([
  { x: 3.5, y: 3.0 },
  { x: 8.5, y: 2.6 },
  { x: 13.8, y: 3.0 },
  { x: 3.8, y: 5.5 },
  { x: 13.8, y: 5.5 },
  { x: 4.0, y: 8.2 },
  { x: 13.5, y: 8.2 },
  { x: 6.2, y: 3.2 },
  { x: 11.2, y: 3.2 },
  { x: 6.2, y: 8.0 }
]);

function buildPersonalizedHomeRoom(buildingId, found, owner, cols, rows) {
  const seed = hashString(`${owner.id}:${buildingId}:${owner.index || 0}`);
  const plan = HOME_LAYOUT_PLANS[(Number(owner.index ?? seed)) % HOME_LAYOUT_PLANS.length];
  const shiftX = (seed >>> 2) % 2;
  const shiftY = (seed >>> 3) % 2;
  const [ax0, ay0, ax1, ay1] = plan.accentRect;

  const shiftedRugs = plan.rugRects.map(([x0, y0, x1, y1], rIdx) => {
    const sx = rIdx === 0 ? shiftX : 0;
    const sy = rIdx === 0 ? shiftY : 0;
    return [
      Math.max(2, Math.min(cols - 5, x0 + sx)),
      Math.max(2, Math.min(rows - 4, y0 + sy)),
      Math.max(3, Math.min(cols - 3, x1 + sx)),
      Math.max(3, Math.min(rows - 3, y1 + sy))
    ];
  });

  const grid = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) return TILE.INT_WALL;
      for (const [rx0, ry0, rx1, ry1] of shiftedRugs) {
        if (x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1) return TILE.RUG;
      }
      if (x >= ax0 && x <= ax1 && y >= ay0 && y <= ay1) return plan.accent;
      return plan.floor;
    })
  );
  grid[11][8] = TILE.EXIT_MAT;
  grid[11][9] = TILE.EXIT_MAT;

  // Deterministic permutation of the 10 slots so every citizen gets unique layout geometry
  const order = HOME_STATION_SLOTS.map((_, i) => i);
  let rng = (seed ^ ((owner.index || 0) + 1) * 2654435761) >>> 0;
  for (let i = order.length - 1; i > 0; i -= 1) {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    const j = rng % (i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  const chosenSlots = order.slice(0, 4);

  const primaryByPref = {
    think: { label: 'Contemplation Desk', kind: 'think', spriteKey: 'tea_table' },
    work: { label: 'Workstation Console', kind: 'work', spriteKey: 'desk_computer' },
    read: { label: 'Private Library', kind: 'read', spriteKey: 'library_bookshelf' },
    social: { label: 'Salon Table', kind: 'social', spriteKey: 'bistro_table_2' },
    leisure: { label: 'Synth & Sound Lounge', kind: 'leisure', spriteKey: 'modular_synth' },
    rest: { label: 'Quiet Retreat', kind: 'rest', spriteKey: 'hinoki_tub' },
    idle: { label: 'Atrium Niche', kind: 'think', spriteKey: 'rittenhouse_statue' }
  };
  const restChoices = [
    { label: 'Espresso Corner', spriteKey: 'coffee_maker' },
    { label: 'Cedar Hearth', spriteKey: 'fireplace' },
    { label: 'Soaking Retreat', spriteKey: 'hinoki_tub' },
    { label: 'Tea Counter', spriteKey: 'counter_bar' },
    { label: 'Recovery Berth', spriteKey: 'medical_bed' }
  ];
  const curioChoices = [
    { label: 'Listening Corner', spriteKey: 'turntable' },
    { label: 'Botanical Corner', spriteKey: 'flowerbed' },
    { label: 'Sculpture Plinth', spriteKey: 'rittenhouse_statue' },
    { label: 'Window Settee', spriteKey: 'bench_park' },
    { label: 'Bistro Nook', spriteKey: 'bistro_table' }
  ];

  const sk = owner.skills || { research: 1, engineering: 1, hospitality: 1, synthesis: 1 };
  const topSkill = Object.entries(sk).sort((a, b) => b[1] - a[1])[0]?.[0] || 'research';
  const masteryBySkill = {
    research: { label: 'Archival Stacks', kind: 'read', spriteKey: 'library_bookshelf' },
    engineering: { label: 'Systems Bench', kind: 'work', spriteKey: 'modular_synth' },
    hospitality: { label: 'Conservatory Table', kind: 'social', spriteKey: 'bistro_table_2' },
    synthesis: { label: 'Synthesis Piano', kind: 'think', spriteKey: 'grand_piano' }
  };

  const pSpec = primaryByPref[owner.preferredKind] || primaryByPref.think;
  const rSpec = restChoices[seed % restChoices.length];
  const mSpec = masteryBySkill[topSkill] || masteryBySkill.research;
  const cSpec = curioChoices[(seed >>> 4) % curioChoices.length];

  const firstName = String(owner.name || 'Citizen').split(' ')[0];
  const stationDefs = [
    { key: 'primary', ...pSpec, title: `${firstName}'s ${pSpec.label}`, w: 2, h: 2 },
    { key: 'sanctuary', ...rSpec, kind: 'rest', title: `${firstName}'s ${rSpec.label}`, w: 2, h: 2 },
    { key: 'mastery', ...mSpec, title: `${firstName}'s ${mSpec.label}`, w: 2, h: 2 },
    { key: 'curio', ...cSpec, kind: 'social', title: `${firstName}'s ${cSpec.label}`, w: 2, h: 2 }
  ];

  const stations = stationDefs.map((def, idx) => {
    const slot = HOME_STATION_SLOTS[chosenSlots[idx]];
    return {
      id: `${buildingId}_${def.key}`,
      label: def.title,
      kind: def.kind,
      spriteKey: def.spriteKey,
      x: slot.x,
      y: slot.y,
      w: def.w,
      h: def.h
    };
  });

  const sig = [
    plan.id,
    shiftedRugs.map((r) => r.join(',')).join(';'),
    chosenSlots.join('-'),
    stations.map((s) => s.spriteKey).join('+'),
    owner.id
  ].join('|');

  return {
    id: `int_${buildingId}`,
    buildingId,
    archetype: plan.id,
    ownerId: owner.id,
    ownerName: owner.name,
    layoutStyle: plan.label,
    layoutSignature: sig,
    name: `${firstName}'s ${found.name}`,
    shortName: `${firstName}'s ${found.shortName}`,
    sectorId: found.sectorId,
    cols,
    rows,
    spawn: { x: 9, y: 9.5 },
    exit: { x: 8.5, y: 11 },
    grid,
    stations
  };
}

export function getBuildingInterior(buildingId) {
  if (!buildingId) return null;
  if (INTERIOR_CACHE.has(buildingId)) return INTERIOR_CACHE.get(buildingId);

  const physId = String(buildingId).replace(/_suite_\d+$/, '');
  let found = null;
  for (const s of BIOME_SECTORS) {
    const match = getSectorBuildings(s.id).find((b) => b.id === physId || b.id === buildingId);
    if (match) {
      found = match;
      break;
    }
  }
  if (!found) return null;

  const cols = 18;
  const rows = 12;
  const owner = HOME_OWNER_BY_BUILDING.get(buildingId);
  if (owner) {
    const ownedRoom = buildPersonalizedHomeRoom(buildingId, found, owner, cols, rows);
    INTERIOR_CACHE.set(buildingId, ownedRoom);
    return ownedRoom;
  }

  const archetype = resolveInteriorArchetype(found);
  const spec = ARCHETYPE_SPECS[archetype] || ARCHETYPE_SPECS.residential_atelier;
  const bHash = physId.endsWith('_0') ? 0 : hashString(physId);
  const shiftX = bHash === 0 ? 0 : (bHash % 3) - 1;
  const shiftY = bHash === 0 ? 0 : ((bHash >>> 2) % 2);
  const [rx0, ry0, rx1, ry1] = spec.rugRect;

  const grid = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) return TILE.INT_WALL;
      if (x >= Math.max(2, rx0 + shiftX) && x <= Math.min(cols - 3, rx1 + shiftX)
        && y >= Math.max(2, ry0 + shiftY) && y <= Math.min(rows - 3, ry1 + shiftY)) {
        return TILE.RUG;
      }
      return spec.floor;
    })
  );
  grid[11][8] = TILE.EXIT_MAT;
  grid[11][9] = TILE.EXIT_MAT;

  const stations = spec.stations.map((st) => ({
    ...st,
    id: `${buildingId}_${st.key}`
  }));

  const room = {
    id: `int_${buildingId}`,
    buildingId,
    archetype,
    ownerId: null,
    ownerName: null,
    layoutStyle: archetype,
    layoutSignature: `${archetype}|${physId}`,
    name: found.name,
    shortName: found.shortName,
    sectorId: found.sectorId,
    cols,
    rows,
    spawn: { x: 9, y: 9.5 },
    exit: { x: 8.5, y: 11 },
    grid,
    stations
  };
  INTERIOR_CACHE.set(buildingId, room);
  return room;
}

// Weighted Tile Walk Cost (strongly prefers sidewalks, crosswalks, plazas & paths)
export function tileWalkCost(gx, gy) {
  if (gx < 0 || gy < 0 || gx >= WORLD_TILES || gy >= WORLD_TILES) return Infinity;
  if (isBuildingFootprint(gx, gy)) return Infinity;
  const t = getBiomeTile(gx, gy);
  if (t === TILE.WATER || t === TILE.FENCE || t === TILE.FLOWERBED) return Infinity;
  if (
    t === TILE.SIDEWALK ||
    t === TILE.CROSSWALK ||
    t === TILE.PARK_PATH ||
    t === TILE.PARK_PLAZA ||
    t === TILE.WOOD_DECK ||
    t === TILE.TATAMI ||
    t === TILE.MARBLE ||
    t === TILE.TECH_FLOOR
  ) {
    return 1.0;
  }
  if (t === TILE.SAND) return 1.4;
  if (t === TILE.GRASS || t === TILE.GRASS_FLOWER) return 4.5;
  if (t === TILE.ROAD) return 6.5;
  return 2.0;
}

function runBoundedAStar(sx, sy, gx, gy, maxExpansions = 4500) {
  if (sx === gx && sy === gy) return [{ x: gx, y: gy }];

  // Tiny fast binary min-heap for A* open set
  const heapF = [];
  const heapN = [];
  const pushHeap = (f, idx) => {
    let i = heapN.length;
    heapF.push(f);
    heapN.push(idx);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= heapF[i]) break;
      const tf = heapF[p]; heapF[p] = heapF[i]; heapF[i] = tf;
      const tn = heapN[p]; heapN[p] = heapN[i]; heapN[i] = tn;
      i = p;
    }
  };
  const popHeap = () => {
    const top = heapN[0];
    const lastF = heapF.pop();
    const lastN = heapN.pop();
    if (heapN.length > 0) {
      heapF[0] = lastF;
      heapN[0] = lastN;
      let i = 0;
      const len = heapN.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < len && heapF[l] < heapF[best]) best = l;
        if (r < len && heapF[r] < heapF[best]) best = r;
        if (best === i) break;
        const tf = heapF[best]; heapF[best] = heapF[i]; heapF[i] = tf;
        const tn = heapN[best]; heapN[best] = heapN[i]; heapN[i] = tn;
        i = best;
      }
    }
    return top;
  };

  const startKey = sy * WORLD_TILES + sx;
  const gScore = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const closed = new Set();
  pushHeap(Math.abs(gx - sx) + Math.abs(gy - sy), startKey);

  let expansions = 0;
  let bestCloseKey = startKey;
  let bestCloseDist = Math.abs(gx - sx) + Math.abs(gy - sy);

  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  let foundKey = -1;
  while (heapN.length > 0 && expansions < maxExpansions) {
    const cur = popHeap();
    if (closed.has(cur)) continue;
    closed.add(cur);
    expansions++;

    const cx = cur % WORLD_TILES;
    const cy = (cur / WORLD_TILES) | 0;
    const distToGoal = Math.abs(gx - cx) + Math.abs(gy - cy);
    if (distToGoal < bestCloseDist) {
      bestCloseDist = distToGoal;
      bestCloseKey = cur;
    }
    if (cx === gx && cy === gy) {
      foundKey = cur;
      break;
    }

    const curG = gScore.get(cur);
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d][0];
      const ny = cy + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= WORLD_TILES || ny >= WORLD_TILES) continue;
      const nKey = ny * WORLD_TILES + nx;
      if (closed.has(nKey)) continue;

      const stepCost = (nx === gx && ny === gy) ? 1.0 : tileWalkCost(nx, ny);
      if (!Number.isFinite(stepCost)) continue;

      const nextG = curG + stepCost;
      const prevG = gScore.get(nKey);
      if (prevG === undefined || nextG < prevG) {
        gScore.set(nKey, nextG);
        cameFrom.set(nKey, cur);
        const h = Math.abs(gx - nx) + Math.abs(gy - ny);
        pushHeap(nextG + h * 1.05, nKey);
      }
    }
  }

  const endKey = foundKey >= 0 ? foundKey : bestCloseKey;
  const raw = [];
  let trace = endKey;
  while (trace !== undefined && trace !== startKey) {
    raw.push({ x: trace % WORLD_TILES, y: (trace / WORLD_TILES) | 0 });
    trace = cameFrom.get(trace);
  }
  raw.reverse();
  if (foundKey < 0) {
    raw.push({ x: gx, y: gy });
  }
  return compressOrthogonalWaypoints(raw);
}

function compressOrthogonalWaypoints(pts) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const dx1 = Math.sign(b.x - a.x);
    const dy1 = Math.sign(b.y - a.y);
    const dx2 = Math.sign(c.x - b.x);
    const dy2 = Math.sign(c.y - b.y);
    if (dx1 !== dx2 || dy1 !== dy2) {
      out.push(b);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function findSidewalkPath(startX, startY, goalX, goalY) {
  const sx = Math.max(0, Math.min(WORLD_TILES - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(WORLD_TILES - 1, Math.round(startY)));
  const gx = Math.max(0, Math.min(WORLD_TILES - 1, Math.round(goalX)));
  const gy = Math.max(0, Math.min(WORLD_TILES - 1, Math.round(goalY)));

  if (sx === gx && sy === gy) return [{ x: gx, y: gy }];

  const manhattan = Math.abs(gx - sx) + Math.abs(gy - sy);
  if (manhattan <= 96) {
    return runBoundedAStar(sx, sy, gx, gy, 4500);
  }

  // Hierarchical cross-sector sidewalk routing via continuous avenue sidewalks (lx=41/62, ly=41/83)
  const sSec = getSectorBounds(sectorAtTile(sx, sy));
  const gSec = getSectorBounds(sectorAtTile(gx, gy));
  const exitGate = { x: sSec.x0 + 62, y: sSec.y0 + 41 };
  const entryGate = { x: gSec.x0 + 62, y: gSec.y0 + 41 };

  const leg1 = runBoundedAStar(sx, sy, exitGate.x, exitGate.y, 2600);
  const trunkMid = { x: entryGate.x, y: exitGate.y };
  const leg3 = runBoundedAStar(entryGate.x, entryGate.y, gx, gy, 2600);

  return compressOrthogonalWaypoints([...leg1, trunkMid, entryGate, ...leg3]);
}

export const ITEM_CATALOG = Object.freeze({
  corsica_espresso: { id: 'corsica_espresso', name: 'Corsica Espresso', icon: '☕', kind: 'rest', consumable: true, effects: { energy: 26, focus: 8 } },
  matcha_bowl: { id: 'matcha_bowl', name: 'Kyoto Matcha Bowl', icon: '🍵', kind: 'rest', consumable: true, effects: { energy: 22, inspiration: 12 } },
  philly_pretzel: { id: 'philly_pretzel', name: 'Warm Philly Pretzel', icon: '🥨', kind: 'social', consumable: true, effects: { energy: 16, social: 14 } },
  archival_folio: { id: 'archival_folio', name: 'Archival Folio', icon: '📕', kind: 'read', consumable: true, effects: { focus: 24, inspiration: 14 } },
  philosopher_notes: { id: 'philosopher_notes', name: 'Reflection Notebook', icon: '📓', kind: 'think', consumable: true, effects: { focus: 20, inspiration: 18 } },
  synth_patch_tape: { id: 'synth_patch_tape', name: 'Modular Patch Tape', icon: '📼', kind: 'leisure', consumable: true, effects: { inspiration: 24, social: 12 } },
  telemetry_slate: { id: 'telemetry_slate', name: 'Telemetry Slate', icon: '💻', kind: 'work', consumable: true, effects: { focus: 22, inspiration: 12 } },
  drone_beacon: { id: 'drone_beacon', name: 'Subagent Beacon', icon: '📡', kind: 'delegate', consumable: true, effects: { focus: 18, social: 14 } },
  folding_bike: { id: 'folding_bike', name: 'Brompton Folding Bike', icon: '🚲', kind: 'transit', consumable: false, speedMultiplier: 1.45, effects: { energy: 10 } },
  septa_key_card: { id: 'septa_key_card', name: 'SEPTA Key Pass', icon: '🎫', kind: 'transit', consumable: false, effects: { inspiration: 8 } },
  synthesis_treatise: { id: 'synthesis_treatise', name: 'Synthesis Treatise', icon: '📜', kind: 'crafted', consumable: true, crafted: true, effects: { focus: 35, inspiration: 35 } },
  harmonic_module: { id: 'harmonic_module', name: 'Harmonic Synth Module', icon: '🎛️', kind: 'crafted', consumable: true, crafted: true, effects: { inspiration: 38, social: 25 } },
  artisan_picnic: { id: 'artisan_picnic', name: 'Artisan Commons Basket', icon: '🧺', kind: 'crafted', consumable: true, crafted: true, effects: { energy: 36, social: 30 } }
});

export const CRAFT_RECIPES = Object.freeze([
  {
    id: 'synthesis_treatise',
    outputId: 'synthesis_treatise',
    name: 'Synthesis Treatise',
    ingredients: ['archival_folio', 'philosopher_notes'],
    coinCost: 15,
    skillKey: 'synthesis'
  },
  {
    id: 'harmonic_module',
    outputId: 'harmonic_module',
    name: 'Harmonic Synth Module',
    ingredients: ['telemetry_slate', 'synth_patch_tape'],
    coinCost: 15,
    skillKey: 'engineering'
  },
  {
    id: 'artisan_picnic',
    outputId: 'artisan_picnic',
    name: 'Artisan Commons Basket',
    ingredients: ['corsica_espresso', 'philly_pretzel'],
    altIngredients: ['matcha_bowl', 'philly_pretzel'],
    coinCost: 12,
    skillKey: 'hospitality'
  }
]);

export const CIVIC_PROJECTS = Object.freeze([
  { id: 'proj_midtown_clock', sectorId: 'midtown', name: 'Midtown Horology Clocktower', icon: '🕰️', goalCoins: 60, requiredItem: 'synthesis_treatise', buffLabel: '+15% Focus & Inspiration in Midtown', unlockPackId: 'exp_rittenhouse', spriteKey: 'fountain_grand', lx: 64, ly: 58 },
  { id: 'proj_conservatory_dome', sectorId: 'conservatory', name: 'Conservatory Astral Orrery', icon: '🔭', goalCoins: 60, requiredItem: 'synthesis_treatise', buffLabel: '+20% Research Mastery in Conservatory', unlockPackId: 'exp_studio_metro', spriteKey: 'rittenhouse_statue', lx: 58, ly: 58 },
  { id: 'proj_kyoto_lanterns', sectorId: 'kyoto', name: 'Kyoto Floating Lantern Arch', icon: '🏮', goalCoins: 55, requiredItem: 'artisan_picnic', buffLabel: '+20% Energy & Serenity in Kyoto', unlockPackId: 'exp_coastal', spriteKey: 'conservatory_fountain', lx: 58, ly: 66 },
  { id: 'proj_woodland_observatory', sectorId: 'woodland', name: 'Lakeside Timber Amphitheater', icon: '🔥', goalCoins: 55, requiredItem: 'artisan_picnic', buffLabel: '+20% Social Rapport in Woodland', unlockPackId: 'exp_civic_works', spriteKey: 'woodland_campfire', lx: 68, ly: 68 },
  { id: 'proj_coastal_lighthouse', sectorId: 'coastal', name: 'Harbor Solar Beacon', icon: '⚓', goalCoins: 65, requiredItem: 'harmonic_module', buffLabel: '+15% Energy & Speed in Coastal', unlockPackId: 'exp_outpost', spriteKey: 'coastal_umbrella', lx: 46, ly: 62 },
  { id: 'proj_broadcast_array', sectorId: 'broadcast', name: 'Deep-Space Telemetry Array', icon: '📡', goalCoins: 65, requiredItem: 'harmonic_module', buffLabel: '+20% Engineering Mastery in Broadcast', unlockPackId: 'exp_outpost', spriteKey: 'modular_synth', lx: 60, ly: 52 },
  { id: 'proj_metro_exchange', sectorId: 'metro', name: 'Grand Concourse Commons Kiosk', icon: '🚇', goalCoins: 60, requiredItem: 'artisan_picnic', buffLabel: '+15% Transit & Social Vitality in Metro', unlockPackId: 'exp_rittenhouse', spriteKey: 'season_flower_cart', lx: 64, ly: 56 },
  { id: 'proj_rittenhouse_pavilion', sectorId: 'rittenhouse', name: 'Curtis Chamber String Pavilion', icon: '🎻', goalCoins: 65, requiredItem: 'harmonic_module', buffLabel: '+20% Inspiration in Rittenhouse', unlockPackId: 'exp_coastal', spriteKey: 'grand_piano', lx: 56, ly: 68 },
  { id: 'proj_civic_foundry', sectorId: 'civic_works', name: 'Autonomous Synthesis Foundry', icon: '⚙️', goalCoins: 70, requiredItem: 'synthesis_treatise', buffLabel: '+20% Crafting & Engineering in Civic Works', unlockPackId: 'exp_outpost', spriteKey: 'desk_computer', lx: 62, ly: 58 }
]);

export function getRewardItemForStation(station) {
  if (!station) return 'corsica_espresso';
  if (station.kind === 'transit') return 'septa_key_card';
  if (station.kind === 'rest') return station.sectorId === 'kyoto' ? 'matcha_bowl' : 'corsica_espresso';
  if (station.kind === 'read') return 'archival_folio';
  if (station.kind === 'think') return 'philosopher_notes';
  if (station.kind === 'leisure') return 'synth_patch_tape';
  if (station.kind === 'work') return 'telemetry_slate';
  if (station.kind === 'delegate') return 'drone_beacon';
  if (station.kind === 'social') return 'philly_pretzel';
  return 'corsica_espresso';
}

export function getSectorTransitStop(sectorId) {
  const sec = BIOME_SECTORS.find((s) => s.id === sectorId) || BIOME_SECTORS[4];
  const b = getSectorBounds(sec);
  return {
    id: `transit_${sec.id}`,
    sectorId: sec.id,
    label: `${sec.name.split(' ')[0]} Transit Stop`,
    x: b.x0 + 62,
    y: b.y0 + 41
  };
}

export function planMultiModalRoute(startX, startY, goalX, goalY) {
  const sx = Math.max(0, Math.min(WORLD_TILES - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(WORLD_TILES - 1, Math.round(startY)));
  const gx = Math.max(0, Math.min(WORLD_TILES - 1, Math.round(goalX)));
  const gy = Math.max(0, Math.min(WORLD_TILES - 1, Math.round(goalY)));

  if (sx === gx && sy === gy) return [{ x: gx, y: gy }];

  const startSec = sectorAtTile(sx, sy);
  const goalSec = sectorAtTile(gx, gy);
  const manhattan = Math.abs(gx - sx) + Math.abs(gy - sy);
  if (startSec.id === goalSec.id || manhattan <= 85) {
    return findSidewalkPath(sx, sy, gx, gy);
  }

  const originStop = getSectorTransitStop(startSec.id);
  const destStop = getSectorTransitStop(goalSec.id);
  const leg1 = findSidewalkPath(sx, sy, originStop.x, originStop.y);
  const transitHop = {
    x: destStop.x,
    y: destStop.y,
    transitHop: true,
    fromStop: originStop.label,
    toStop: destStop.label
  };
  const leg2 = findSidewalkPath(destStop.x, destStop.y, gx, gy);
  return [...leg1, transitHop, ...leg2];
}

export function clampCameraToUnlocked(targetX, targetY, prevX, prevY, worldSpec, margin = 6) {
  const sectors = worldSpec?.sectors || [];
  if (!sectors.length) {
    return {
      x: Math.max(margin, Math.min(WORLD_TILES - margin, targetX)),
      y: Math.max(margin, Math.min(WORLD_TILES - margin, targetY))
    };
  }

  const grid = new Map();
  let fallback = null;
  for (const s of sectors) {
    grid.set(`${s.gx},${s.gy}`, s);
    if (s.unlocked && (!fallback || s.id === 'midtown')) fallback = s;
  }
  const isUnlockedGrid = (gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= SECTOR_COLS || gy >= SECTOR_ROWS) return false;
    return Boolean(grid.get(`${gx},${gy}`)?.unlocked);
  };

  let cx = Math.max(margin, Math.min(WORLD_TILES - margin, Number(targetX) || 192));
  let cy = Math.max(margin, Math.min(WORLD_TILES - margin, Number(targetY) || 192));

  const getGridXY = (x, y) => ({
    gx: Math.max(0, Math.min(SECTOR_COLS - 1, Math.floor(x / SECTOR_TILES))),
    gy: Math.max(0, Math.min(SECTOR_ROWS - 1, Math.floor(y / SECTOR_TILES)))
  });

  let { gx, gy } = getGridXY(cx, cy);
  if (!isUnlockedGrid(gx, gy)) {
    const px = Number.isFinite(prevX) ? prevX : (fallback ? fallback.bounds.centerX : 192);
    const py = Number.isFinite(prevY) ? prevY : (fallback ? fallback.bounds.centerY : 192);

    const tryHoriz = getGridXY(cx, py);
    if (isUnlockedGrid(tryHoriz.gx, tryHoriz.gy)) {
      cy = py;
      gx = tryHoriz.gx;
      gy = tryHoriz.gy;
    } else {
      const tryVert = getGridXY(px, cy);
      if (isUnlockedGrid(tryVert.gx, tryVert.gy)) {
        cx = px;
        gx = tryVert.gx;
        gy = tryVert.gy;
      } else {
        const prevG = getGridXY(px, py);
        if (isUnlockedGrid(prevG.gx, prevG.gy)) {
          cx = px;
          cy = py;
          gx = prevG.gx;
          gy = prevG.gy;
        } else if (fallback) {
          cx = fallback.bounds.centerX;
          cy = fallback.bounds.centerY;
          gx = fallback.gx;
          gy = fallback.gy;
        }
      }
    }
  }

  const sec = grid.get(`${gx},${gy}`);
  if (sec) {
    const { x0, y0, x1, y1 } = sec.bounds;
    if (!isUnlockedGrid(gx - 1, gy) && cx < x0 + margin) cx = x0 + margin;
    if (!isUnlockedGrid(gx + 1, gy) && cx > x1 + 1 - margin) cx = x1 + 1 - margin;
    if (!isUnlockedGrid(gx, gy - 1) && cy < y0 + margin) cy = y0 + margin;
    if (!isUnlockedGrid(gx, gy + 1) && cy > y1 + 1 - margin) cy = y1 + 1 - margin;
  }

  return { x: cx, y: cy };
}
