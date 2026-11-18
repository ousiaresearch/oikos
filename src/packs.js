// Expansion Pack & Seasonal Overlay Registry for the Unified 384x384 Multi-Biome World.
// Persists enabled/unlocked packs via Hermes Desktop PluginStorage.

export const PACK_KIND = Object.freeze({
  CORE: 'core',
  EXPANSION: 'expansion',
  SEASONAL: 'seasonal'
});

export const PACK_CATALOG = Object.freeze([
  {
    id: 'core_commons',
    kind: PACK_KIND.CORE,
    title: 'Core World: Midtown, Conservatory, Kyoto & Lakeside',
    subtitle: '4 interconnected starter biomes (Central Plaza, Library/Museum, Zen Courtyard, Woodland Cabin).',
    defaultEnabled: true,
    sectors: ['midtown', 'conservatory', 'kyoto', 'woodland'],
    themes: ['2_City_Terrains', '5_Floor_Modular_Buildings', '17_Garden', '5_Classroom_and_library', '20_Japanese_interiors', '11_Camping']
  },
  {
    id: 'exp_coastal',
    kind: PACK_KIND.EXPANSION,
    title: 'Expansion 1: Coastal Harbor & Boardwalk',
    subtitle: 'Sandy beach, bamboo tiki espresso deck, animated ocean surf, marina boats, seagulls & crabs.',
    defaultEnabled: false,
    sectors: ['coastal'],
    themes: ['21_Beach', 'Sea_Water_Tileset', '14_Swimming_Pool', '9_Fishing']
  },
  {
    id: 'exp_studio_metro',
    kind: PACK_KIND.EXPANSION,
    title: 'Expansion 2: Neon Broadcast, Jazz & Metro',
    subtitle: 'TV/Film control room, rooftop helipad, jazz & arcade lounge, and underground transit concourse.',
    defaultEnabled: false,
    sectors: ['broadcast', 'metro'],
    themes: ['23_Television_and_Film_Studio', '6_Music_and_sport', '20_Subway_and_Train_Station', '21_Clothing_Store', '16_Grocery_store']
  },
  {
    id: 'exp_civic_works',
    kind: PACK_KIND.EXPANSION,
    title: 'Expansion 3: Civic Works, Med-Bay & Engineering Yard',
    subtitle: 'Active construction foundry, R&D basement, hospital clinic, athletic spa, and fire/postal vehicles.',
    defaultEnabled: false,
    sectors: ['civic_works'],
    themes: ['8_Worksite', '19_Hospital', '18_Fire_Station', '22_Post_Office', '14_Basement', '8_Gym']
  },
  {
    id: 'exp_rittenhouse',
    kind: PACK_KIND.EXPANSION,
    title: 'Expansion 4: Rittenhouse Heritage Quarter',
    subtitle: 'Classic Philadelphia brownstone square, Duck Girl fountain, Parc bistro, Curtis stage & SEPTA bus.',
    defaultEnabled: false,
    sectors: ['rittenhouse'],
    themes: ['4_Generic_Buildings', '5_Floor_Modular_Buildings', '17_Garden', 'Buses_32x32']
  },
  {
    id: 'exp_outpost',
    kind: PACK_KIND.EXPANSION,
    title: 'Expansion 5: Outpost & Red-Team Arena',
    subtitle: 'Playful sandbox security range, command bunker, and drone test yard.',
    defaultEnabled: false,
    sectors: ['outpost'],
    themes: ['23_MIlitary_Base', '15_Police_Station', '25_Shooting_Range', '18_Jail']
  },
  {
    id: 'season_autumn',
    kind: PACK_KIND.SEASONAL,
    title: 'Seasonal: Autumn Harvest & Spooky Hollow',
    subtitle: 'Warm amber foliage, pumpkin lanterns, harvest market stalls, and optional ghost sprites.',
    defaultEnabled: false,
    sectors: [],
    themes: ['11_Halloween', '19_Graveyard', '6_Garage_Sales', 'Body_10_Ghost']
  },
  {
    id: 'season_winter',
    kind: PACK_KIND.SEASONAL,
    title: 'Seasonal: Winter Solstice & Holiday Market',
    subtitle: 'Festive pine trees, snow-tinted ground grade, glowing hearth windows, and cocoa stalls.',
    defaultEnabled: false,
    sectors: [],
    themes: ['15_Christmas', '10_Birthday_party', '6_Garage_Sales']
  },
  {
    id: 'season_spring',
    kind: PACK_KIND.SEASONAL,
    title: 'Seasonal: Spring Blossom & Farmers Market',
    subtitle: 'Cherry blossom canopies, flower planters, and weekend fruit/coffee street carts.',
    defaultEnabled: false,
    sectors: [],
    themes: ['17_Garden', 'Fruit_Flowers_Cart', 'Street_Food_Cart']
  }
]);

const STORAGE_KEY = 'packs.v1';

export function createPackRegistry(storage, initialOwned = null) {
  const catalogMap = new Map(PACK_CATALOG.map((p) => [p.id, p]));
  const saved = storage?.get ? storage.get(STORAGE_KEY, null) : null;

  const owned = new Set(
    Array.isArray(initialOwned)
      ? initialOwned
      : Array.isArray(saved?.owned)
        ? saved.owned
        : ['core_commons']
  );
  owned.add('core_commons');

  const enabled = new Set(
    Array.isArray(saved?.enabled)
      ? saved.enabled.filter((id) => owned.has(id))
      : ['core_commons']
  );
  enabled.add('core_commons');

  let activeSeason = typeof saved?.activeSeason === 'string' && catalogMap.get(saved.activeSeason)?.kind === PACK_KIND.SEASONAL
    ? saved.activeSeason
    : null;

  function persist() {
    storage?.set?.(STORAGE_KEY, {
      owned: [...owned],
      enabled: [...enabled],
      activeSeason
    });
  }

  return {
    listCatalog() {
      return PACK_CATALOG.map((p) => ({
        ...p,
        owned: owned.has(p.id),
        enabled: p.kind === PACK_KIND.SEASONAL ? activeSeason === p.id : enabled.has(p.id)
      }));
    },
    isSectorUnlocked(sectorId) {
      for (const pack of PACK_CATALOG) {
        if (pack.sectors.includes(sectorId)) {
          return owned.has(pack.id) && enabled.has(pack.id);
        }
      }
      return false;
    },
    unlockPack(packId) {
      if (!catalogMap.has(packId)) return false;
      owned.add(packId);
      const pack = catalogMap.get(packId);
      if (pack.kind === PACK_KIND.SEASONAL) {
        activeSeason = packId;
      } else {
        enabled.add(packId);
      }
      persist();
      return true;
    },
    setPackEnabled(packId, isOn) {
      const pack = catalogMap.get(packId);
      if (!pack || !owned.has(packId)) return false;
      if (pack.kind === PACK_KIND.CORE) return true;
      if (pack.kind === PACK_KIND.SEASONAL) {
        activeSeason = isOn ? packId : (activeSeason === packId ? null : activeSeason);
      } else if (isOn) {
        enabled.add(packId);
      } else {
        enabled.delete(packId);
      }
      persist();
      return true;
    },
    getActiveSeason() {
      return activeSeason;
    },
    getSnapshot() {
      return {
        owned: [...owned],
        enabled: [...enabled],
        activeSeason
      };
    }
  };
}
