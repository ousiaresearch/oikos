// Unified 384x384 Multi-Biome World Layout (3x3 Grid of 128x128 Sectors).
// Every Core & Expansion biome lives simultaneously inside one contiguous coordinate space
// connected by perimeter boardwalks, bridges, and the World Metro Loop.

export const WORLD_TILES = 384;
export const SECTOR_TILES = 128;
export const SECTOR_COLS = 3;
export const SECTOR_ROWS = 3;

export const BIOME_SECTORS = Object.freeze([
  {
    id: 'broadcast',
    name: 'Neon Broadcast & Synth Lab',
    packId: 'exp_studio_metro',
    gx: 0,
    gy: 0,
    groundColor: '#1e293b',
    accentColor: '#38bdf8',
    stations: [
      { id: 'st_broadcast_desk', label: 'Broadcast Control Desk', kind: 'work', x: 48, y: 54 },
      { id: 'st_synth_booth', label: 'Modular Synth Booth', kind: 'leisure', x: 74, y: 58 },
      { id: 'st_rooftop_drone', label: 'Rooftop Drone Pad', kind: 'delegate', x: 64, y: 38 },
      { id: 'st_broadcast_uplink', label: 'Orbital Uplink Console', kind: 'work', x: 22, y: 26 },
      { id: 'st_broadcast_lounge', label: 'South Acoustic Lounge', kind: 'social', x: 105, y: 104 }
    ]
  },
  {
    id: 'metro',
    name: 'Underground Metro & Market Square',
    packId: 'exp_studio_metro',
    gx: 1,
    gy: 0,
    groundColor: '#334155',
    accentColor: '#f59e0b',
    stations: [
      { id: 'st_metro_concourse', label: 'Metro Concourse', kind: 'transit', x: 192, y: 64 },
      { id: 'st_boutique_vinyl', label: 'Vinyl & Boutique Row', kind: 'leisure', x: 174, y: 48 },
      { id: 'st_market_hall', label: 'Artisanal Food Hall', kind: 'rest', x: 210, y: 52 },
      { id: 'st_metro_north_kiosk', label: 'North Concourse Reading Kiosk', kind: 'read', x: 150, y: 26 },
      { id: 'st_metro_south_bistro', label: 'Platform Patio Tables', kind: 'social', x: 233, y: 104 }
    ]
  },
  {
    id: 'kyoto',
    name: 'Kyoto Zen Courtyard & Tea House',
    packId: 'core_commons',
    gx: 2,
    gy: 0,
    groundColor: '#3f6212',
    accentColor: '#fb7185',
    stations: [
      { id: 'st_tatami_study', label: 'Tatami Reflection Desk', kind: 'think', x: 312, y: 54 },
      { id: 'st_tea_pavilion', label: 'Matcha Tea Pavilion', kind: 'rest', x: 330, y: 68 },
      { id: 'st_koi_bridge', label: 'Koi Garden Bridge', kind: 'idle', x: 298, y: 74 },
      { id: 'st_kyoto_shodo', label: 'North Shodo Calligraphy Desk', kind: 'read', x: 278, y: 26 },
      { id: 'st_kyoto_south_garden', label: 'Southeast Sencha Terrace', kind: 'leisure', x: 361, y: 104 }
    ]
  },
  {
    id: 'coastal',
    name: 'Coastal Harbor & Bamboo Tiki Deck',
    packId: 'exp_coastal',
    gx: 0,
    gy: 1,
    groundColor: '#e7c98f',
    accentColor: '#0ea5e9',
    stations: [
      { id: 'st_tiki_bar', label: 'Bamboo Espresso Tiki', kind: 'rest', x: 58, y: 186 },
      { id: 'st_beach_pergola', label: 'Oceanfront Pergola Desk', kind: 'work', x: 76, y: 192 },
      { id: 'st_marina_pier', label: 'Seagull Marina Pier', kind: 'idle', x: 36, y: 204 },
      { id: 'st_coastal_north_deck', label: 'East Pier Sun Deck', kind: 'leisure', x: 105, y: 154 },
      { id: 'st_coastal_south_gelato', label: 'Boardwalk Gelato Patio', kind: 'social', x: 105, y: 232 }
    ]
  },
  {
    id: 'midtown',
    name: 'Midtown Studio & Espresso Commons',
    packId: 'core_commons',
    gx: 1,
    gy: 1,
    groundColor: '#475569',
    accentColor: '#eab308',
    stations: [
      { id: 'st_midtown_desk', label: 'Dual-Monitor Studio', kind: 'work', x: 188, y: 184 },
      { id: 'st_midtown_whiteboard', label: 'Teamwork Whiteboard', kind: 'delegate', x: 202, y: 184 },
      { id: 'st_midtown_espresso', label: 'Sidewalk Espresso Bar', kind: 'rest', x: 192, y: 202 },
      { id: 'st_midtown_plaza', label: 'Central Fountain Plaza', kind: 'idle', x: 192, y: 192 },
      { id: 'st_midtown_roasters_patio', label: 'Northwest Roasters Patio', kind: 'social', x: 150, y: 154 },
      { id: 'st_midtown_south_atrium', label: 'Southeast Studio Court', kind: 'read', x: 233, y: 232 }
    ]
  },
  {
    id: 'conservatory',
    name: 'Grand Conservatory & Library',
    packId: 'core_commons',
    gx: 2,
    gy: 1,
    groundColor: '#166534',
    accentColor: '#a78bfa',
    stations: [
      { id: 'st_library_stacks', label: 'Scholar Library Stacks', kind: 'read', x: 316, y: 186 },
      { id: 'st_museum_gallery', label: 'Museum & Art Easel', kind: 'think', x: 336, y: 194 },
      { id: 'st_glasshouse', label: 'Botanical Glasshouse', kind: 'idle', x: 304, y: 206 },
      { id: 'st_conservatory_orchid', label: 'Northwest Orchid Bench', kind: 'think', x: 278, y: 154 },
      { id: 'st_conservatory_south_lawn', label: 'Southeast Fern Pavilion', kind: 'social', x: 361, y: 232 }
    ]
  },
  {
    id: 'rittenhouse',
    name: 'Rittenhouse Heritage Quarter',
    packId: 'exp_rittenhouse',
    gx: 0,
    gy: 2,
    groundColor: '#3d7a37',
    accentColor: '#d97706',
    stations: [
      { id: 'st_duck_girl', label: 'Duck Girl Reflecting Pool', kind: 'idle', x: 64, y: 318 },
      { id: 'st_parc_bistro', label: 'Parc Sidewalk Bistro', kind: 'rest', x: 82, y: 318 },
      { id: 'st_curtis_stage', label: 'Curtis Recital Stage', kind: 'leisure', x: 52, y: 332 },
      { id: 'st_rittenhouse_atelier', label: 'Northwest Atelier Court', kind: 'think', x: 22, y: 282 },
      { id: 'st_rittenhouse_recital_court', label: 'Southeast Chamber Terrace', kind: 'social', x: 105, y: 360 }
    ]
  },
  {
    id: 'woodland',
    name: 'Woodland Lakeside Cabin & Camp',
    packId: 'core_commons',
    gx: 1,
    gy: 2,
    groundColor: '#2d5a27',
    accentColor: '#fb923c',
    stations: [
      { id: 'st_cabin_hearth', label: 'Fireplace Study Cabin', kind: 'think', x: 186, y: 312 },
      { id: 'st_campfire_ring', label: 'Lakeside Campfire Ring', kind: 'social', x: 196, y: 326 },
      { id: 'st_fishing_dock', label: 'Timber Fishing Dock', kind: 'idle', x: 212, y: 334 },
      { id: 'st_woodland_north_camp', label: 'Northern Pine Campfire', kind: 'rest', x: 150, y: 282 },
      { id: 'st_woodland_south_trail', label: 'Southeast Woodshop Bench', kind: 'work', x: 233, y: 360 }
    ]
  },
  {
    id: 'civic_works',
    name: 'Civic Works, Med-Bay & Red-Team Yard',
    packId: 'exp_civic_works',
    gx: 2,
    gy: 2,
    groundColor: '#57534e',
    accentColor: '#ef4444',
    stations: [
      { id: 'st_worksite_bay', label: 'Engineering Foundry Bay', kind: 'work', x: 308, y: 314 },
      { id: 'st_med_bay', label: 'Recovery Med-Bay & Spa', kind: 'rest', x: 330, y: 316 },
      { id: 'st_outpost_range', label: 'Sandbox Security Range', kind: 'delegate', packId: 'exp_outpost', x: 342, y: 334 },
      { id: 'st_civic_north_reactor', label: 'Northwest Reactor Console', kind: 'work', x: 278, y: 282 },
      { id: 'st_civic_south_depot', label: 'Southeast Logistics Table', kind: 'think', x: 361, y: 360 }
    ]
  }
]);

export function getSectorBounds(sector) {
  const x0 = sector.gx * SECTOR_TILES;
  const y0 = sector.gy * SECTOR_TILES;
  return {
    x0,
    y0,
    x1: x0 + SECTOR_TILES - 1,
    y1: y0 + SECTOR_TILES - 1,
    centerX: x0 + Math.floor(SECTOR_TILES / 2),
    centerY: y0 + Math.floor(SECTOR_TILES / 2)
  };
}

export function sectorAtTile(x, y) {
  const gx = Math.max(0, Math.min(SECTOR_COLS - 1, Math.floor(x / SECTOR_TILES)));
  const gy = Math.max(0, Math.min(SECTOR_ROWS - 1, Math.floor(y / SECTOR_TILES)));
  return BIOME_SECTORS.find((s) => s.gx === gx && s.gy === gy) || BIOME_SECTORS[4];
}

export function buildUnifiedWorldSpec(packRegistry) {
  const sectors = BIOME_SECTORS.map((s) => {
    const unlocked = packRegistry ? packRegistry.isSectorUnlocked(s.id) : s.packId === 'core_commons';
    const bounds = getSectorBounds(s);
    return {
      ...s,
      bounds,
      unlocked
    };
  });

  const unlockedStations = [];
  const enabledPackSet = new Set(packRegistry ? packRegistry.getSnapshot().enabled : ['core_commons']);
  for (const s of sectors) {
    if (!s.unlocked) continue;
    for (const st of s.stations) {
      if (st.packId && !enabledPackSet.has(st.packId)) continue;
      unlockedStations.push({ ...st, sectorId: s.id, sectorName: s.name });
    }
  }

  return {
    size: WORLD_TILES,
    sectorSize: SECTOR_TILES,
    spawn: { x: 192, y: 192 }, // Midtown Central Fountain Plaza
    sectors,
    stations: unlockedStations
  };
}
