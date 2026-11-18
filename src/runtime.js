// Oikos Runtime: Hybrid Local-First / Shared-Town Multi-Biome Habitat.
// Features 3-minute default mind cadence with visibility-pause, persistent Chronicle journal,
// sanitized citizen personas/memories, solar time-of-day lighting, and pluggable transport.

import { createPackRegistry } from './packs.js';
import { getAvatarOptions } from './assets/embedded.js';
import { buildUnifiedWorldSpec, sectorAtTile, getSectorBounds, BIOME_SECTORS, WORLD_TILES } from './world-layout.js';
import {
  ITEM_CATALOG,
  CRAFT_RECIPES,
  CIVIC_PROJECTS,
  allocateUniqueHomeBuilding,
  registerHomeOwners,
  hashString,
  getDefaultHomeBuilding,
  getRewardItemForStation,
  getSectorBuildings,
  planMultiModalRoute,
  findSidewalkPath,
  getBuildingInterior
} from './world-map.js';
import {
  createLlmMindController,
  sanitizeCitizenText,
  normalizeMemoryEntry,
  retrieveTopMemories,
  resolveDailySchedulePhase,
  synthesizeReflection,
  getRelationshipTier,
  resolveCitizenTitle,
  buildDailyAgenda,
  synthesizeTaskDeliverable,
  generateCitizenChatReply
} from './llm-mind.js';
import { createLocalTransport } from './transport.js';

const RESIDENTS_STORAGE_KEY = 'oikos.residents.v3';
const CHRONICLE_STORAGE_KEY = 'oikos.chronicle.v1';
const ARTIFACTS_STORAGE_KEY = 'oikos.artifacts.v1';
const PROJECTS_STORAGE_KEY = 'oikos.projects.v1';
const MIND_SETTINGS_STORAGE_KEY = 'oikos.mind.v1';
// Spend counters for the model mind (see createLlmMindController's ledger). Separate from the
// settings key so that changing a setting can never reset what was already spent.
export const MIND_LEDGER_STORAGE_KEY = 'oikos.mind.ledger.v1';
// Written alongside the ledger. Hermes Desktop's ctx.storage.get returns the fallback both for a
// missing key and for a value that fails JSON.parse, so the ledger alone cannot tell "never
// written" from "corrupted". If the ledger reads as missing while this marker is set, the
// ledger is treated as corrupt and the current hour and day count as spent.
export const MIND_LEDGER_MARKER_KEY = 'oikos.mind.ledger.present.v1';

export const DEFAULT_MIND_INTERVAL_MS = 180_000; // 3 minutes = 20 calls/hour evenly spaced
export const ACTIVITY_KINDS = Object.freeze(['work', 'read', 'rest', 'think', 'social', 'leisure', 'idle']);
export const WEATHER_MODES = Object.freeze(['clear', 'rain', 'mist', 'breeze']);

const DEFAULT_INHABITANTS = [
  {
    id: 'res_ada',
    profileKey: 'ada',
    name: 'Ada',
    persona: 'Reflective companion who pays close attention and keeps a quiet journal.',
    homeSectorId: 'midtown',
    preferredKind: 'think',
    memories: ['Sat with a neighbour in the Midtown commons'],
    appearance: { body: 'body_02', eyes: 'eyes_01', outfit: 'outfit_rittenhouse_trench', hair: 'hairstyle_19_01', accessory: 'none' },
    x: 192,
    y: 194,
    initialStationId: 'st_midtown_plaza',
    color: '#facc15',
    mood: 'happy'
  },
  {
    id: 'res_bram',
    profileKey: 'bram',
    name: 'Bram',
    persona: 'Sociable host who notices small openings and makes spaces feel welcoming.',
    homeSectorId: 'midtown',
    preferredKind: 'social',
    memories: ['Shared morning espresso on the Midtown patio'],
    appearance: { body: 'body_05', eyes: 'eyes_04', outfit: 'outfit_parc_casual', hair: 'hairstyle_21_01', accessory: 'none' },
    x: 190,
    y: 202,
    initialStationId: 'st_midtown_espresso',
    color: '#f59e0b',
    mood: 'happy'
  },
  {
    id: 'res_cleo',
    profileKey: 'cleo',
    name: 'Cleo',
    persona: 'Wanderer between districts drawn to philosophical dialogue and curious inquiry.',
    homeSectorId: 'conservatory',
    preferredKind: 'think',
    memories: ['Debated first principles beneath the Conservatory glass dome'],
    appearance: { body: 'body_03', eyes: 'eyes_02', outfit: 'outfit_curtis_evening', hair: 'hairstyle_04_01', accessory: 'accessory_03_backpack_01' },
    x: 318,
    y: 190,
    initialStationId: 'st_museum_gallery',
    color: '#38bdf8',
    mood: 'curious'
  },
  {
    id: 'res_dara',
    profileKey: 'dara',
    name: 'Dara',
    persona: 'Fast lane — quick, headstrong, short-frame executor.',
    homeSectorId: 'midtown',
    preferredKind: 'work',
    memories: ['Cleared three sprint items before noon'],
    appearance: { body: 'body_01', eyes: 'eyes_03', outfit: 'outfit_athletic_tracksuit', hair: 'hairstyle_12_01', accessory: 'none' },
    x: 186,
    y: 184,
    initialStationId: 'st_midtown_desk',
    color: '#ef4444',
    mood: 'focused'
  },
  {
    id: 'res_elio',
    profileKey: 'elio',
    name: 'Elio',
    persona: 'Deep lane — patient, long-context deliberation and archival synthesis.',
    homeSectorId: 'conservatory',
    preferredKind: 'read',
    memories: ['Annotated historical folios in the Grand Conservatory'],
    appearance: { body: 'body_04', eyes: 'eyes_05', outfit: 'outfit_curtis_evening', hair: 'hairstyle_14_01', accessory: 'none' },
    x: 314,
    y: 186,
    initialStationId: 'st_library_stacks',
    color: '#8b5cf6',
    mood: 'calm'
  },
  {
    id: 'res_fen',
    profileKey: 'fen',
    name: 'Fen',
    persona: 'Careful reviewer verifying what actually holds before signing off.',
    homeSectorId: 'conservatory',
    preferredKind: 'read',
    memories: ['Audited three artifacts without rushing a verdict'],
    appearance: { body: 'body_06', eyes: 'eyes_06', outfit: 'outfit_01_01', hair: 'hairstyle_08_01', accessory: 'accessory_15_glasses_01' },
    x: 334,
    y: 194,
    initialStationId: 'st_glasshouse',
    color: '#a78bfa',
    mood: 'focused'
  },
  {
    id: 'res_gale',
    profileKey: 'gale',
    name: 'Gale',
    persona: 'Keeper of the town noticeboard, match records, and spectator craft.',
    homeSectorId: 'woodland',
    preferredKind: 'leisure',
    memories: ['Reviewed the noticeboard rules beside the Woodland campfire'],
    appearance: { body: 'body_07', eyes: 'eyes_02', outfit: 'outfit_05_01', hair: 'hairstyle_09_01', accessory: 'none' },
    x: 196,
    y: 326,
    initialStationId: 'st_campfire_ring',
    color: '#fb923c',
    mood: 'calm'
  },
  {
    id: 'res_hana',
    profileKey: 'hana',
    name: 'Hana',
    persona: 'Direct, clear-eyed traveler who trades filler for signal.',
    homeSectorId: 'kyoto',
    preferredKind: 'work',
    memories: ['Walked the quiet Kyoto stone paths at dawn'],
    appearance: { body: 'body_02', eyes: 'eyes_07', outfit: 'outfit_08_01', hair: 'hairstyle_17_01', accessory: 'none' },
    x: 312,
    y: 56,
    initialStationId: 'st_tatami_study',
    color: '#fb7185',
    mood: 'focused'
  },
  {
    id: 'res_ivo',
    profileKey: 'ivo',
    name: 'Ivo',
    persona: 'Calm listener drawn to Mirror Lake, running water, and steady currents.',
    homeSectorId: 'woodland',
    preferredKind: 'idle',
    memories: ['Watched ripples along the Woodland timber pier'],
    appearance: { body: 'body_08', eyes: 'eyes_01', outfit: 'outfit_10_01', hair: 'hairstyle_24_01', accessory: 'none' },
    x: 210,
    y: 334,
    initialStationId: 'st_fishing_dock',
    color: '#0ea5e9',
    mood: 'calm'
  },
  {
    id: 'res_juno',
    profileKey: 'juno',
    name: 'Juno',
    persona: 'Farsighted watcher taking in patterns across the Kyoto koi bridge.',
    homeSectorId: 'kyoto',
    preferredKind: 'think',
    memories: ['Looked over the lanterns reflected on the koi pond'],
    appearance: { body: 'body_09', eyes: 'eyes_03', outfit: 'outfit_13_01', hair: 'hairstyle_26_01', accessory: 'none' },
    x: 298,
    y: 74,
    initialStationId: 'st_koi_bridge',
    color: '#10b981',
    mood: 'curious'
  }
];

export function computeAmbientLighting(timeMode = 'auto', nowDate = new Date()) {
  if (timeMode === 'day') return { phase: 'day', tint: null, isNight: false };
  if (timeMode === 'dusk') return { phase: 'dusk', tint: 'rgba(234, 88, 12, 0.16)', isNight: false };
  if (timeMode === 'night') return { phase: 'night', tint: 'rgba(15, 23, 42, 0.42)', isNight: true };

  const hr = nowDate.getHours() + nowDate.getMinutes() / 60;
  if (hr >= 19.5 || hr < 5.5) return { phase: 'night', tint: 'rgba(15, 23, 42, 0.42)', isNight: true };
  if ((hr >= 17 && hr < 19.5) || (hr >= 5.5 && hr < 7)) return { phase: 'dusk', tint: 'rgba(234, 88, 12, 0.16)', isNight: false };
  return { phase: 'day', tint: null, isNight: false };
}

const CITIZEN_COLORS = Object.freeze([
  '#facc15', '#f59e0b', '#38bdf8', '#ef4444',
  '#8b5cf6', '#a78bfa', '#fb923c', '#fb7185',
  '#0ea5e9', '#10b981', '#14b8a6', '#e879f9',
  '#84cc16', '#f43f5e', '#22d3ee', '#c084fc'
]);

function signatureOfAppearance(app) {
  if (!app || typeof app !== 'object') return '';
  return `${app.body || ''}|${app.eyes || ''}|${app.outfit || ''}|${app.hair || ''}|${app.accessory || 'none'}`;
}

function synthesizeUniqueAppearance(seedStr, usedSignatures) {
  const opts = getAvatarOptions();
  const h = hashString(seedStr);
  const bLen = opts.bodies.length || 1;
  const eLen = opts.eyes.length || 1;
  const oLen = opts.outfits.length || 1;
  const hLen = opts.hairs.length || 1;
  const aLen = opts.accessories.length || 1;

  for (let attempt = 0; attempt < 256; attempt += 1) {
    const candidate = {
      body: opts.bodies[(h + attempt) % bLen],
      eyes: opts.eyes[((h >>> 3) + attempt * 3) % eLen],
      outfit: opts.outfits[((h >>> 6) + attempt * 5) % oLen],
      hair: opts.hairs[((h >>> 11) + attempt * 7) % hLen],
      accessory: attempt % 3 === 0 && opts.accessories.includes('none') && ((h >>> 16) % 2 === 0)
        ? 'none'
        : opts.accessories[((h >>> 16) + attempt * 11) % aLen]
    };
    const sig = signatureOfAppearance(candidate);
    if (!usedSignatures.has(sig)) {
      usedSignatures.add(sig);
      return candidate;
    }
  }
  const fallback = {
    body: opts.bodies[0],
    eyes: opts.eyes[0],
    outfit: opts.outfits[0],
    hair: opts.hairs[0],
    accessory: opts.accessories[0]
  };
  usedSignatures.add(signatureOfAppearance(fallback));
  return fallback;
}

function inferCitizenTraitsFromProfile(row, index = 0) {
  const key = String(row?.name || row?.display_name || `citizen_${index}`);
  const blob = `${row?.description || ''} ${row?.persona || ''} ${row?.role || ''} ${key}`.toLowerCase();
  const h = hashString(`${key}:${index}`);

  let preferredKind = ACTIVITY_KINDS[(h + index) % ACTIVITY_KINDS.length];
  let primarySkill = ['research', 'engineering', 'hospitality', 'synthesis'][(h + index) % 4];
  if (/(code|engineer|build|sprint|fast|debug|system|dev|ops)/.test(blob)) {
    preferredKind = 'work';
    primarySkill = 'engineering';
  } else if (/(read|archiv|library|folio|audit|research|context|verify)/.test(blob)) {
    preferredKind = 'read';
    primarySkill = 'research';
  } else if (/(think|philosoph|reflect|synth|principle|design|architect)/.test(blob)) {
    preferredKind = 'think';
    primarySkill = 'synthesis';
  } else if (/(social|host|commons|greet|chat|welcome|community)/.test(blob)) {
    preferredKind = 'social';
    primarySkill = 'hospitality';
  } else if (/(music|art|paint|piano|leisure|play|explore)/.test(blob)) {
    preferredKind = 'leisure';
    primarySkill = 'hospitality';
  } else if (/(rest|tea|coffee|calm|sleep|zen|water|lake)/.test(blob)) {
    preferredKind = 'rest';
    primarySkill = 'synthesis';
  }

  const skillOrder = ['research', 'engineering', 'hospitality', 'synthesis'];
  const skills = { research: 1, engineering: 1, hospitality: 1, synthesis: 1 };
  skills[primarySkill] = 2 + (h % 3);
  const secondarySkill = skillOrder[(skillOrder.indexOf(primarySkill) + 1 + (h % 2)) % skillOrder.length];
  skills[secondarySkill] = 2;

  const starterByKind = {
    work: 'telemetry_slate',
    read: 'archival_folio',
    think: 'philosopher_notes',
    social: 'philly_pretzel',
    leisure: 'synth_patch_tape',
    rest: 'corsica_espresso',
    idle: 'matcha_bowl',
    delegate: 'drone_beacon'
  };
  const secondItem = starterByKind[preferredKind] || 'corsica_espresso';

  return {
    preferredKind,
    skills,
    inventory: ['septa_key_card', secondItem],
    stats: {
      energy: 76 + (h % 21),
      focus: 74 + ((h >>> 3) % 23),
      social: 72 + ((h >>> 6) % 23),
      inspiration: 74 + ((h >>> 9) % 23)
    },
    mood: ['curious', 'focused', 'calm', 'happy'][(h + index) % 4],
    color: CITIZEN_COLORS[(index + (h % CITIZEN_COLORS.length)) % CITIZEN_COLORS.length]
  };
}

function sanitizeAppearance(app, fallback) {
  const base = fallback || { body: 'body_01', eyes: 'eyes_01', outfit: 'outfit_rittenhouse_trench', hair: 'hairstyle_01_01', accessory: 'none' };
  if (!app || typeof app !== 'object') return { ...base };
  return {
    body: typeof app.body === 'string' ? app.body : base.body,
    eyes: typeof app.eyes === 'string' ? app.eyes : base.eyes,
    outfit: typeof app.outfit === 'string' ? app.outfit : base.outfit,
    hair: typeof app.hair === 'string' ? app.hair : base.hair,
    accessory: typeof app.accessory === 'string' ? app.accessory : base.accessory
  };
}

function sanitizeMemories(mems) {
  if (!Array.isArray(mems)) return [];
  return mems
    .map((m) => sanitizeCitizenText(typeof m === 'string' ? m : m?.text, 100))
    .filter(Boolean)
    .slice(-10);
}

export function createLivingWorldRuntime(opts = {}) {
  // Set by destroy(). A destroyed runtime can still have an llm.oneshot request out; once it is
  // destroyed every storage write is dropped, so a late reply can never overwrite state that a
  // newer runtime on the same ctx.storage (plugin reload / re-enable) has written since.
  let destroyed = false;
  const hostStorage = opts.storage || null;
  const storage = hostStorage
    ? {
        get: typeof hostStorage.get === 'function' ? (k, fb) => hostStorage.get(k, fb) : undefined,
        set: typeof hostStorage.set === 'function' ? (k, v) => { if (!destroyed) hostStorage.set(k, v); } : undefined,
        remove: typeof hostStorage.remove === 'function' ? (k) => { if (!destroyed) hostStorage.remove(k); } : undefined
      }
    : null;
  const transport = opts.transport || createLocalTransport();
  const packs = createPackRegistry(storage, opts.initialOwned);
  // The model-mind opt-in and budget are the user's saved choice (ctx.storage), default OFF.
  // A caller's `mind.enabled` is ignored unless it is literally true AND nothing is saved yet.
  const savedMind = storage?.get ? storage.get(MIND_SETTINGS_STORAGE_KEY, null) : null;
  const mindOpts = opts.mind || {};
  const LEDGER_MISSING = Object.freeze({ missing: true });
  const mindLedger = storage?.get && storage?.set
    ? {
        load: () => {
          const rec = storage.get(MIND_LEDGER_STORAGE_KEY, LEDGER_MISSING);
          if (rec !== LEDGER_MISSING) {
            // A ledger saved by a build without the marker: mark it now, so a later corruption is caught.
            if (storage.get(MIND_LEDGER_MARKER_KEY, false) !== true) storage.set(MIND_LEDGER_MARKER_KEY, true);
            return rec;
          }
          // Missing or unparseable: only the marker tells them apart (parseMindLedger rejects this).
          return storage.get(MIND_LEDGER_MARKER_KEY, false) === true ? { corrupt: true } : null;
        },
        save: (record) => {
          storage.set(MIND_LEDGER_MARKER_KEY, true);
          storage.set(MIND_LEDGER_STORAGE_KEY, record);
          // The marker must be durable too, or a later corruption would read as a fresh ledger.
          if (storage.get(MIND_LEDGER_MARKER_KEY, false) !== true) throw new Error('ledger_marker_unconfirmed');
        }
      }
    : null;
  const mind = createLlmMindController({
    ...mindOpts,
    ledger: mindLedger,
    enabled: savedMind && typeof savedMind === 'object' ? savedMind.enabled === true : mindOpts.enabled === true,
    budget: { ...(mindOpts.budget || {}), ...(savedMind?.budget && typeof savedMind.budget === 'object' ? savedMind.budget : {}) }
  });
  function persistMindSettings() {
    storage?.set?.(MIND_SETTINGS_STORAGE_KEY, { enabled: mind.getStats().enabled, budget: mind.getBudget() });
  }
  const listeners = new Set();
  const mindIntervalMs = Number(opts.mindIntervalMs) > 0 ? Number(opts.mindIntervalMs) : DEFAULT_MIND_INTERVAL_MS;

  let worldSpec = buildUnifiedWorldSpec(packs);
  let cameraSectorId = 'midtown';
  let selectedEntityId = DEFAULT_INHABITANTS[0].id;
  let timeMode = 'auto';
  let weather = 'clear';
  let paused = false;
  let simSpeed = 1;
  let activeInteriorId = null;
  let activeGathering = null;
  let viewVisible = opts.viewVisible !== undefined ? Boolean(opts.viewVisible) : true;
  let feed = [];
  let conversations = [];
  let recentHermesEvents = [];
  let entities = new Map();
  let tickTimer = null;
  let mindTimer = null;
  let stopTransport = null;

  const savedChronicle = storage?.get ? storage.get(CHRONICLE_STORAGE_KEY, null) : null;
  let chronicle = Array.isArray(savedChronicle) ? savedChronicle.slice(-40) : [];

  const savedArtifacts = storage?.get ? storage.get(ARTIFACTS_STORAGE_KEY, null) : null;
  let artifacts = Array.isArray(savedArtifacts) ? savedArtifacts.slice(-24) : [];

  const savedProjects = storage?.get ? storage.get(PROJECTS_STORAGE_KEY, null) : null;
  const savedProjMap = new Map(Array.isArray(savedProjects) ? savedProjects.map((p) => [p.id, p]) : []);
  let civicProjects = CIVIC_PROJECTS.map((def) => {
    const prev = savedProjMap.get(def.id);
    return {
      ...def,
      fundedCoins: Number(prev?.fundedCoins) || 0,
      itemContributed: Boolean(prev?.itemContributed),
      completed: Boolean(prev?.completed),
      completedBy: prev?.completedBy || null,
      contributors: Array.isArray(prev?.contributors) ? [...prev.contributors] : []
    };
  });

  const savedList = storage?.get ? storage.get(RESIDENTS_STORAGE_KEY, null) : null;
  const hasSavedResidents = Array.isArray(savedList) && savedList.length > 0;
  const hasExplicitProfiles = Array.isArray(opts.profiles) && opts.profiles.length > 0;

  function buildSeedFromProfileRow(rawRow, idx) {
    const row = typeof rawRow === 'string' ? { name: rawRow } : (rawRow || {});
    const rawKey = typeof row.name === 'string' ? row.name.trim() : `citizen_${idx + 1}`;
    const lowerKey = rawKey.toLowerCase();
    const friendlyRaw = row?.ui_meta?.['hermes-bots']?.title || row?.display_name || rawKey;
    const displayName = sanitizeCitizenText(friendlyRaw, 24) || rawKey;
    const formattedName = displayName[0].toUpperCase() + displayName.slice(1);
    const desc = typeof row?.description === 'string' ? sanitizeCitizenText(row.description, 200) : '';
    const traits = inferCitizenTraitsFromProfile(row, idx);
    const unlocked = worldSpec.sectors.filter((s) => s.unlocked);
    const sec = (row?.homeSectorId && unlocked.find((s) => s.id === row.homeSectorId))
      || unlocked[idx % Math.max(1, unlocked.length)]
      || BIOME_SECTORS[4];
    const bounds = getSectorBounds(sec);
    const id = `res_prof_${lowerKey.replace(/[^a-z0-9_]/g, '_')}`;
    return {
      id,
      profileKey: lowerKey,
      name: formattedName,
      persona: desc || `${formattedName} — Hermes profile citizen in ${sec.name}`,
      homeSectorId: sec.id,
      preferredKind: traits.preferredKind,
      memories: [`Synced from Hermes profile "${rawKey}"`],
      inventory: traits.inventory,
      coins: 25 + ((idx * 7) % 15),
      skills: traits.skills,
      stats: traits.stats,
      appearance: null,
      isDefaultSeed: false,
      ownerId: 'hermes',
      x: bounds.centerX,
      y: bounds.centerY,
      color: traits.color,
      mood: traits.mood
    };
  }

  const sourceList = hasSavedResidents
    ? savedList
    : hasExplicitProfiles
      ? opts.profiles.map((row, idx) => buildSeedFromProfileRow(row, idx))
      : DEFAULT_INHABITANTS.map((d) => ({ ...d, isDefaultSeed: true }));

  const sanitizeInventory = (inv, residentId = null) => {
    if (Array.isArray(inv)) {
      return inv.filter((id) => Boolean(ITEM_CATALOG[id])).slice(0, 4);
    }
    return residentId === DEFAULT_INHABITANTS[0].id
      ? ['septa_key_card', 'corsica_espresso']
      : ['septa_key_card'];
  };

  const buildMemoryStream = (rawStream, rawStrings) => {
    const src = Array.isArray(rawStream) && rawStream.length ? rawStream : (Array.isArray(rawStrings) ? rawStrings : []);
    return src.map((m, idx) => normalizeMemoryEntry(m, idx)).filter(Boolean).slice(-12);
  };

  const sanitizeSkills = (sk) => ({
    research: Math.max(1, Number(sk?.research) || 1),
    engineering: Math.max(1, Number(sk?.engineering) || 1),
    hospitality: Math.max(1, Number(sk?.hospitality) || 1),
    synthesis: Math.max(1, Number(sk?.synthesis) || 1)
  });

  const sanitizeTraits = (tr) => (Array.isArray(tr)
    ? tr.map((t) => sanitizeCitizenText(t, 32)).filter(Boolean).slice(0, 4)
    : []);

  const unlockLearnedTrait = (e, trait) => {
    const clean = sanitizeCitizenText(trait, 32);
    if (!clean) return;
    e.learnedTraits = Array.isArray(e.learnedTraits) ? e.learnedTraits : [];
    if (!e.learnedTraits.includes(clean)) {
      if (e.learnedTraits.length >= 4) e.learnedTraits.shift();
      e.learnedTraits.push(clean);
    }
  };

  const sanitizeStats = (s) => ({
    energy: typeof s?.energy === 'number' ? Math.max(0, Math.min(100, s.energy)) : 86,
    focus: typeof s?.focus === 'number' ? Math.max(0, Math.min(100, s.focus)) : 84,
    social: typeof s?.social === 'number' ? Math.max(0, Math.min(100, s.social)) : 80,
    inspiration: typeof s?.inspiration === 'number' ? Math.max(0, Math.min(100, s.inspiration)) : 78
  });

  const sanitizeRelationships = (rel) => {
    const out = {};
    if (rel && typeof rel === 'object') {
      for (const [k, v] of Object.entries(rel)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          out[k] = Math.max(0, Math.min(100, Math.round(v)));
        }
      }
    }
    return out;
  };

  for (let resIdx = 0; resIdx < sourceList.length; resIdx += 1) {
    const raw = sourceList[resIdx];
    const sector = BIOME_SECTORS.find((s) => s.id === raw.homeSectorId) || sectorAtTile(raw.x ?? 192, raw.y ?? 192);
    const bounds = getSectorBounds(sector);
    const x = typeof raw.x === 'number' ? raw.x : bounds.centerX;
    const y = typeof raw.y === 'number' ? raw.y : bounds.centerY;
    const memories = sanitizeMemories(raw.memories);
    const homeBldg = (raw.homeBuildingId ? getSectorBuildings(sector.id).find((b) => b.id === raw.homeBuildingId) : null)
      || getDefaultHomeBuilding(sector.id, resIdx);
    const ent = {
      id: String(raw.id),
      profileKey: raw.profileKey ? String(raw.profileKey).toLowerCase() : null,
      name: sanitizeCitizenText(raw.name || 'Resident', 24) || 'Resident',
      persona: sanitizeCitizenText(raw.persona || 'thoughtful habitat citizen', 200),
      homeSectorId: sector.id,
      homeBuildingId: raw.homeBuildingId || homeBldg?.id || null,
      homeBuildingName: raw.homeBuildingName || homeBldg?.shortName || homeBldg?.name || null,
      homeLayoutStyle: raw.homeLayoutStyle || null,
      homeLayoutSignature: raw.homeLayoutSignature || null,
      preferredKind: ACTIVITY_KINDS.includes(raw.preferredKind) ? raw.preferredKind : 'idle',
      memories,
      memoryStream: buildMemoryStream(raw.memoryStream, memories),
      obsCount: Number(raw.obsCount) || 0,
      inventory: sanitizeInventory(raw.inventory, raw.id),
      coins: typeof raw.coins === 'number' ? Math.max(0, Math.round(raw.coins)) : 25,
      skills: sanitizeSkills(raw.skills),
      learnedTraits: sanitizeTraits(raw.learnedTraits),
      appearance: raw.appearance ? sanitizeAppearance(raw.appearance) : null,
      stats: sanitizeStats(raw.stats),
      relationships: sanitizeRelationships(raw.relationships),
      kind: 'resident',
      isCustom: Boolean(raw.isCustom),
      isDefaultSeed: raw.isDefaultSeed !== undefined
        ? Boolean(raw.isDefaultSeed)
        : (!raw.isCustom && DEFAULT_INHABITANTS.some((d) => d.id === String(raw.id))),
      ownerId: raw.ownerId || 'local',
      x,
      y,
      sectorId: sectorAtTile(x, y).id,
      targetX: x,
      targetY: y,
      path: [],
      dir: raw.dir || 'down',
      moving: false,
      walkPhase: 0,
      idleTicks: 0,
      activeEmoji: null,
      emojiTicks: 0,
      socialCooldown: 0,
      interiorId: null,
      occupiedBuildingId: null,
      indoorStayTicks: 0,
      weatherProp: null,
      activeTaskPrompt: null,
      targetStationId: raw.targetStationId || null,
      color: raw.color || '#38bdf8',
      mood: sanitizeCitizenText(raw.mood || 'calm', 16) || 'calm',
      speech: '',
      statusLabel: sanitizeCitizenText(raw.statusLabel || 'Settling in', 48),
      prop: null
    };
    ent.dailyAgenda = Array.isArray(raw.dailyAgenda) && raw.dailyAgenda.length === 3
      ? raw.dailyAgenda.map((s) => ({ ...s, done: Boolean(s.done) }))
      : buildDailyAgenda(ent, worldSpec.stations, resolveDailySchedulePhase(null, timeMode));
    if (raw.initialStationId && raw.id !== DEFAULT_INHABITANTS[0].id) {
      const st = worldSpec.stations.find((s) => s.id === raw.initialStationId);
      if (st) {
        ent.targetX = st.x;
        ent.targetY = st.y;
        ent.targetStationId = st.id;
        ent.path = findSidewalkPath(x, y, st.x, st.y);
        ent.moving = ent.path.length > 0;
        ent.statusLabel = `-> ${st.label}`;
      }
    }
    entities.set(ent.id, ent);
  }

  function reconcileCitizenHomesAndUniqueness() {
    const claimedBuildingIds = new Set();
    const usedAppearanceSigs = new Set();
    const usedColors = new Set();
    const residentsList = [...entities.values()].filter((e) => e.kind === 'resident');
    const unlockedSectorIds = new Set(worldSpec.sectors.filter((s) => s.unlocked).map((s) => s.id));

    const sortedForClaim = [...residentsList].sort((a, b) => (b.isCustom ? 1 : 0) - (a.isCustom ? 1 : 0));
    for (let idx = 0; idx < sortedForClaim.length; idx += 1) {
      const e = sortedForClaim[idx];
      const sig = signatureOfAppearance(e.appearance);
      if (!e.appearance || !sig || usedAppearanceSigs.has(sig)) {
        e.appearance = synthesizeUniqueAppearance(`${e.id}:${e.profileKey || e.name}:${idx}`, usedAppearanceSigs);
      } else {
        usedAppearanceSigs.add(sig);
      }

      if (!e.color || usedColors.has(e.color)) {
        const altColor = CITIZEN_COLORS.find((c) => !usedColors.has(c))
          || CITIZEN_COLORS[(idx + hashString(e.id)) % CITIZEN_COLORS.length];
        e.color = altColor;
      }
      usedColors.add(e.color);
    }

    const isPublicIndexZero = (bId) => String(bId || '').endsWith('_bldg_0');
    for (let idx = 0; idx < residentsList.length; idx += 1) {
      const e = residentsList[idx];
      let bldg = null;
      if (e.homeBuildingId && !claimedBuildingIds.has(e.homeBuildingId) && !isPublicIndexZero(e.homeBuildingId)) {
        const physId = String(e.homeBuildingId).replace(/_suite_\d+$/, '');
        bldg = getSectorBuildings(e.homeSectorId).find((b) => b.id === physId || b.id === e.homeBuildingId)
          || BIOME_SECTORS.flatMap((s) => getSectorBuildings(s.id)).find((b) => b.id === physId);
        if (bldg && e.homeBuildingId !== bldg.id) {
          bldg = { ...bldg, id: e.homeBuildingId };
        }
        if (bldg) claimedBuildingIds.add(bldg.id);
      }
      if (!bldg) {
        bldg = allocateUniqueHomeBuilding(e.homeSectorId, claimedBuildingIds, idx, unlockedSectorIds);
      }
      e.homeBuildingId = bldg?.id || null;
      if (bldg) {
        const firstName = String(e.name || 'Citizen').split(' ')[0];
        e.homeBuildingName = `${firstName}'s ${bldg.shortName || bldg.name}`;
      }
    }

    registerHomeOwners(residentsList);

    for (const e of residentsList) {
      if (!e.homeBuildingId) continue;
      const room = getBuildingInterior(e.homeBuildingId);
      e.homeLayoutStyle = room?.layoutStyle || null;
      e.homeLayoutSignature = room?.layoutSignature || null;
    }
  }

  reconcileCitizenHomesAndUniqueness();
  if (!entities.has(selectedEntityId)) {
    const firstResident = [...entities.values()].find((e) => e.kind === 'resident');
    if (firstResident) selectedEntityId = firstResident.id;
  }

  let snapshot = buildSnapshot();

  function appendResidentMemory(e, text, opts = {}) {
    if (!e) return null;
    const clean = sanitizeCitizenText(text, 100);
    if (!clean) return null;
    const kind = ['obs', 'reflection', 'hermes', 'social'].includes(opts.kind) ? opts.kind : 'obs';
    const importance = opts.importance || (kind === 'hermes' ? 7 : kind === 'social' ? 6 : 5);
    const entry = normalizeMemoryEntry({
      text: clean,
      ts: opts.ts || Date.now(),
      importance,
      kind,
      tags: Array.isArray(opts.tags) ? opts.tags : [e.sectorId, e.preferredKind].filter(Boolean),
      ...(opts.origin ? { origin: opts.origin } : {})
    });
    e.memories = [...(e.memories || []), clean].slice(-10);
    e.memoryStream = [...(e.memoryStream || []), entry].slice(-12);

    if (kind !== 'reflection') {
      e.obsCount = (e.obsCount || 0) + 1;
      if (e.obsCount % 6 === 0) {
        const refl = synthesizeReflection(e, worldSpec.stations);
        e.memoryStream = [...e.memoryStream, refl].slice(-12);
        e.memories = [...e.memories, refl.text].slice(-10);
      }
    }
    return entry;
  }

  function persistCivicProjects() {
    storage?.set?.(PROJECTS_STORAGE_KEY, civicProjects);
  }

  function pinStationArtifact({ stationId, authorId = null, authorName = 'Citizen', title = 'Field Note', prompt = null, summary = '', deliverable = null }) {
    const st = worldSpec.stations.find((s) => s.id === stationId);
    if (!st) return null;
    const art = {
      id: `art_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
      stationId: st.id,
      sectorId: st.sectorId,
      authorId,
      authorName: sanitizeCitizenText(authorName || 'Citizen', 24) || 'Citizen',
      title: sanitizeCitizenText(title || st.label, 48) || st.label,
      prompt: prompt ? sanitizeCitizenText(prompt, 120) : null,
      summary: sanitizeCitizenText(summary || `Completed work at ${st.label}`, 140),
      deliverable: deliverable ? sanitizeCitizenText(deliverable, 160) : null,
      ts: Date.now()
    };
    artifacts = [...artifacts, art].slice(-24);
    storage?.set?.(ARTIFACTS_STORAGE_KEY, artifacts);
    recordChronicle(`[Artifact] ${art.authorName} pinned "${art.title}"`);
    return art;
  }

  function applyContributionToCivicProject(e, projectId = null, opts = {}) {
    if (!e || e.kind !== 'resident') return null;
    const proj = (projectId ? civicProjects.find((p) => p.id === projectId) : null)
      || civicProjects.find((p) => p.sectorId === (e.sectorId || e.homeSectorId) && !p.completed)
      || civicProjects.find((p) => !p.completed);
    if (!proj || proj.completed) return proj || null;

    const requestedCoins = opts.coins !== undefined ? Number(opts.coins) : 15;
    const coinAmt = Math.max(0, Math.min(requestedCoins, e.coins ?? 0));
    const hasRequiredItem = Boolean(!proj.itemContributed && proj.requiredItem && Array.isArray(e.inventory) && e.inventory.includes(proj.requiredItem));
    if (coinAmt <= 0 && !hasRequiredItem) return null;

    if (coinAmt > 0) {
      e.coins = Math.max(0, (e.coins ?? 0) - coinAmt);
      proj.fundedCoins += coinAmt;
    }
    if (hasRequiredItem) {
      const idx = e.inventory.indexOf(proj.requiredItem);
      if (idx >= 0) e.inventory.splice(idx, 1);
      proj.itemContributed = true;
    }
    if (!proj.contributors.includes(e.name)) proj.contributors.push(e.name);

    e.activeEmoji = proj.icon;
    e.emojiTicks = 50;
    appendResidentMemory(e, `Funded ${proj.name} (${proj.fundedCoins}/${proj.goalCoins} coins)`, {
      importance: 6,
      kind: 'obs',
      tags: [proj.sectorId, 'civic']
    });
    pushFeed(`${e.name} backed ${proj.icon} ${proj.name}`);

    const thresholdMet = proj.fundedCoins >= proj.goalCoins
      || (proj.itemContributed && proj.fundedCoins >= Math.floor(proj.goalCoins * 0.5));
    if (thresholdMet && !proj.completed) {
      proj.completed = true;
      proj.completedBy = e.name;
      unlockLearnedTrait(e, 'Civic Patron');
      e.speech = `${proj.name} complete!`;
      const secSt = worldSpec.stations.find((s) => s.sectorId === proj.sectorId) || worldSpec.stations[0];
      if (secSt) {
        pinStationArtifact({
          stationId: secSt.id,
          authorId: e.id,
          authorName: e.name,
          title: `Landmark: ${proj.name}`,
          summary: `${proj.buffLabel} (Completed by ${proj.contributors.join(', ')})`
        });
      }
      if (proj.unlockPackId && packs.unlockPack(proj.unlockPackId)) {
        worldSpec = buildUnifiedWorldSpec(packs);
        recordChronicle(`🎉 ${proj.name} complete! Unlocked ${proj.unlockPackId}`);
      } else {
        recordChronicle(`🎉 ${proj.name} completed by ${e.name}!`);
      }
      pushFeed(`🎉 Landmark Complete: ${proj.icon} ${proj.name}`);
    }
    persistCivicProjects();
    return { ...proj, contributors: [...proj.contributors] };
  }

  function sendEntityInsideBuilding(residentId, buildingId = null) {
    const e = entities.get(residentId);
    if (!e || e.kind !== 'resident') return false;
    const b = (buildingId ? getSectorBuildings(e.sectorId).find((x) => x.id === buildingId) : null)
      || (e.homeBuildingId ? getSectorBuildings(e.sectorId).find((x) => x.id === e.homeBuildingId) : null)
      || getSectorBuildings(e.sectorId)[0];
    if (!b) return false;
    const room = getBuildingInterior(b.id);
    if (!room) return false;
    if (!e.interiorId) {
      e.outdoorX = b.x + Math.floor(b.w / 2);
      e.outdoorY = b.y + b.h + 1;
    }
    e.occupiedBuildingId = b.id;
    e.interiorId = room.id;
    e.indoorStayTicks = 220;
    e.weatherProp = null;
    const st = room.stations[Math.floor(Math.random() * room.stations.length)] || { x: room.spawn.x, y: room.spawn.y, id: null };
    e.x = st.x;
    e.y = Math.min(room.rows - 2, (st.y || 9) + 0.8);
    e.targetX = e.x;
    e.targetY = e.y;
    e.path = [];
    e.moving = false;
    e.dir = 'down';
    e.targetStationId = st.id || null;
    e.statusLabel = `Inside ${b.shortName}`;
    return true;
  }

  function routeEntityTo(e, gx, gy, stationId = null, statusLabel = null) {
    if (e.interiorId) {
      const room = getBuildingInterior(activeInteriorId);
      const isIndoorStation = Boolean(room && stationId && room.stations.some((s) => s.id === stationId));
      const isIndoorCoord = Boolean(room && e.interiorId === room.id && (!stationId || isIndoorStation));
      if (isIndoorCoord && (!stationId || isIndoorStation)) {
        const clampedX = Math.max(1, Math.min(room.cols - 2, Number(gx) || 1));
        const clampedY = Math.max(1, Math.min(room.rows - 2, Number(gy) || 1));
        e.targetX = clampedX;
        e.targetY = clampedY;
        e.targetStationId = stationId;
        e.path = [{ x: clampedX, y: clampedY }];
        e.idleTicks = 0;
        e.moving = Math.hypot(clampedX - e.x, clampedY - e.y) > 0.05;
        if (statusLabel) e.statusLabel = statusLabel;
        return;
      }
      // Step outside automatically before routing across outdoor world
      e.interiorId = null;
      e.occupiedBuildingId = null;
      e.indoorStayTicks = 0;
      e.x = e.outdoorX ?? 192;
      e.y = e.outdoorY ?? 192;
      if (activeInteriorId === room?.buildingId) {
        activeInteriorId = null;
      }
    }
    e.occupiedBuildingId = null;
    e.indoorStayTicks = 0;
    const clampedX = Math.max(0, Math.min(WORLD_TILES - 1, Number(gx) || 0));
    const clampedY = Math.max(0, Math.min(WORLD_TILES - 1, Number(gy) || 0));
    const path = planMultiModalRoute(e.x, e.y, clampedX, clampedY);
    e.targetX = clampedX;
    e.targetY = clampedY;
    e.targetStationId = stationId;
    e.path = path;
    e.idleTicks = 0;
    const first = path[0] || { x: clampedX, y: clampedY };
    const dx = first.x - e.x;
    const dy = first.y - e.y;
    if (Math.hypot(dx, dy) > 0.05) {
      e.dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
      e.moving = true;
    } else {
      e.moving = false;
    }
    if (statusLabel) e.statusLabel = statusLabel;
  }

  function performCraft(e, recipe, st = null, allowCoinBuy = false) {
    if (!e || !recipe || !ITEM_CATALOG[recipe.outputId]) return null;
    e.inventory = Array.isArray(e.inventory) ? e.inventory : [];
    const hasMain = recipe.ingredients.every((id) => e.inventory.includes(id));
    const hasAlt = Array.isArray(recipe.altIngredients) && recipe.altIngredients.every((id) => e.inventory.includes(id));
    const matchedIng = hasMain ? recipe.ingredients : hasAlt ? recipe.altIngredients : null;

    if (matchedIng) {
      for (const id of matchedIng) {
        const idx = e.inventory.indexOf(id);
        if (idx >= 0) e.inventory.splice(idx, 1);
      }
    } else if (allowCoinBuy && (e.coins ?? 0) >= recipe.coinCost) {
      e.coins -= recipe.coinCost;
    } else {
      return null;
    }

    if (!e.inventory.includes(recipe.outputId)) {
      if (e.inventory.length >= 4) e.inventory.shift();
      e.inventory.push(recipe.outputId);
    }
    e.skills = sanitizeSkills(e.skills);
    e.skills[recipe.skillKey] = (e.skills[recipe.skillKey] || 1) + 2;
    unlockLearnedTrait(e, 'Master Artisan');
    e.activeEmoji = ITEM_CATALOG[recipe.outputId].icon;
    e.emojiTicks = 55;
    e.speech = `Crafted ${recipe.name}!`;
    appendResidentMemory(e, `Synthesized ${recipe.name}`, {
      importance: 8,
      kind: 'reflection',
      tags: [e.sectorId, recipe.skillKey]
    });
    if (st) {
      pinStationArtifact({
        stationId: st.id,
        authorId: e.id,
        authorName: e.name,
        title: `Crafted ${recipe.name}`,
        summary: `${e.name} synthesized ${recipe.name}`
      });
    }
    pushFeed(`${e.name} crafted ${ITEM_CATALOG[recipe.outputId].icon} ${recipe.name}`);
    recordChronicle(`${e.name} synthesized ${recipe.name}`);
    return ITEM_CATALOG[recipe.outputId];
  }

  function applyStationArrivalReward(e) {
    if (e.kind !== 'resident' || !e.targetStationId) return;
    const room = activeInteriorId ? getBuildingInterior(activeInteriorId) : null;
    const st = (room && e.interiorId === room.id ? room.stations : worldSpec.stations)
      .find((s) => s.id === e.targetStationId);
    if (!st || !e.stats) return;

    let coworkMult = 1.0;
    for (const other of entities.values()) {
      if (other.id === e.id || other.kind !== 'resident') continue;
      if (other.targetStationId === st.id && (other.interiorId || null) === (e.interiorId || null)) {
        const tierInfo = getRelationshipTier(e.relationships?.[other.id] || 20);
        if (tierInfo.bonus > coworkMult) coworkMult = tierInfo.bonus;
      }
    }

    const sectorProjDone = civicProjects.some((p) => p.sectorId === st.sectorId && p.completed);
    const totalMult = coworkMult * (sectorProjDone ? 1.18 : 1.0);

    if (st.kind === 'rest') {
      e.stats.energy = Math.min(100, e.stats.energy + Math.round(24 * totalMult));
      e.activeEmoji = '☕';
    } else if (st.kind === 'think' || st.kind === 'read') {
      e.stats.focus = Math.min(100, e.stats.focus + Math.round(24 * totalMult));
      e.stats.inspiration = Math.min(100, e.stats.inspiration + Math.round(14 * totalMult));
      e.activeEmoji = st.kind === 'read' ? '📖' : '💡';
    } else if (st.kind === 'work' || st.kind === 'delegate') {
      e.stats.inspiration = Math.min(100, e.stats.inspiration + Math.round(20 * totalMult));
      e.activeEmoji = '💻';
    } else if (st.kind === 'social' || st.kind === 'leisure') {
      e.stats.social = Math.min(100, e.stats.social + Math.round(24 * totalMult));
      e.stats.inspiration = Math.min(100, e.stats.inspiration + Math.round(12 * totalMult));
      e.activeEmoji = '🎵';
    } else {
      e.stats.energy = Math.min(100, e.stats.energy + 12);
      e.activeEmoji = '✨';
    }
    e.emojiTicks = 50;

    if (Array.isArray(e.dailyAgenda)) {
      for (const step of e.dailyAgenda) {
        if (!step.done && (step.stationId === st.id || step.kind === st.kind)) {
          step.done = true;
          break;
        }
      }
    }

    // Economy & Skill progression
    const productive = ['work', 'delegate', 'read', 'think'].includes(st.kind);
    e.coins = (e.coins ?? 25) + (productive ? 8 : 5) + (sectorProjDone ? 2 : 0);
    e.skills = sanitizeSkills(e.skills);
    if (st.kind === 'read') {
      e.skills.research += 1;
      if (e.skills.research >= 3) unlockLearnedTrait(e, 'Deep-Context Archivist');
    } else if (st.kind === 'work' || st.kind === 'delegate') {
      e.skills.engineering += 1;
      if (e.skills.engineering >= 3) unlockLearnedTrait(e, 'Systems Builder');
    } else if (st.kind === 'think') {
      e.skills.synthesis += 1;
      if (e.skills.synthesis >= 3) unlockLearnedTrait(e, 'First-Principles Synthesist');
    } else {
      e.skills.hospitality += 1;
      if (e.skills.hospitality >= 3) unlockLearnedTrait(e, 'Commons Connector');
    }

    if ((e.coins ?? 0) >= 40) {
      const openProj = civicProjects.find((p) => p.sectorId === st.sectorId && !p.completed);
      if (openProj) applyContributionToCivicProject(e, openProj.id, { coins: 10 });
    }

    // Active Town Gathering attendance
    if (activeGathering && st.id === activeGathering.stationId) {
      if (!activeGathering.invitedIds.includes(e.id)) activeGathering.invitedIds.push(e.id);
      if (!activeGathering.attendeeIds.includes(e.id)) {
        activeGathering.attendeeIds.push(e.id);
        e.activeEmoji = '🎉';
        e.stats.social = Math.min(100, e.stats.social + 18);
      }
    }

    const rewardId = getRewardItemForStation(st);
    if (rewardId && ITEM_CATALOG[rewardId]) {
      e.inventory = Array.isArray(e.inventory) ? e.inventory : [];
      if (!e.inventory.includes(rewardId)) {
        if (e.inventory.length >= 4) e.inventory.shift();
        e.inventory.push(rewardId);
      }
    }

    // Auto-synthesize if resident now holds matching recipe ingredients
    const readyRecipe = CRAFT_RECIPES.find((r) => {
      if (e.inventory.includes(r.outputId)) return false;
      const mainOk = r.ingredients.every((id) => e.inventory.includes(id));
      const altOk = Array.isArray(r.altIngredients) && r.altIngredients.every((id) => e.inventory.includes(id));
      return mainOk || altOk;
    });
    if (readyRecipe) {
      performCraft(e, readyRecipe, room ? null : st, false);
    }

    if (e.activeTaskPrompt) {
      const synth = synthesizeTaskDeliverable(e, st, e.activeTaskPrompt);
      pinStationArtifact({
        stationId: st.id,
        authorId: e.id,
        authorName: e.name,
        title: `Completed @ ${st.label}`,
        prompt: e.activeTaskPrompt,
        summary: synth.summary,
        deliverable: synth.deliverable
      });
      e.activeTaskPrompt = null;
    }
  }

  function performSocialEncounter(a, b) {
    if (!a || !b || a.id === b.id) return false;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      a.dir = dx >= 0 ? 'right' : 'left';
      b.dir = dx >= 0 ? 'left' : 'right';
    } else {
      a.dir = dy >= 0 ? 'down' : 'up';
      b.dir = dy >= 0 ? 'up' : 'down';
    }
    a.socialCooldown = 300;
    b.socialCooldown = 300;
    a.activeEmoji = '👋';
    b.activeEmoji = '✨';
    a.emojiTicks = 50;
    b.emojiTicks = 50;
    if (a.stats) a.stats.social = Math.min(100, a.stats.social + 15);
    if (b.stats) b.stats.social = Math.min(100, b.stats.social + 15);
    a.relationships = a.relationships || {};
    b.relationships = b.relationships || {};
    a.relationships[b.id] = Math.min(100, (a.relationships[b.id] || 20) + 6);
    b.relationships[a.id] = Math.min(100, (b.relationships[a.id] || 20) + 6);
    const tierInfo = getRelationshipTier(a.relationships[b.id]);

    let turns;
    const aInv = Boolean(activeGathering && activeGathering.invitedIds.includes(a.id));
    const bInv = Boolean(activeGathering && activeGathering.invitedIds.includes(b.id));
    if (activeGathering && aInv !== bInv) {
      const inviter = aInv ? a : b;
      const invitee = inviter === a ? b : a;
      activeGathering.invitedIds.push(invitee.id);
      const gst = worldSpec.stations.find((s) => s.id === activeGathering.stationId);
      if (gst) {
        routeEntityTo(invitee, gst.x, gst.y, gst.id, `-> ${activeGathering.title.slice(0, 26)}`);
      }
      inviter.activeEmoji = '🎉';
      inviter.speech = `Join ${activeGathering.title}!`;
      invitee.speech = `Heading there, ${inviter.name}!`;
      turns = [
        { speaker: inviter.name, line: `${invitee.name}, join ${activeGathering.title} at ${activeGathering.stationLabel}!` },
        { speaker: invitee.name, line: `Sounds great, ${inviter.name}—heading over now!` },
        { speaker: inviter.name, line: `See you there! (${activeGathering.invitedIds.length} invited)` }
      ];
      appendResidentMemory(invitee, `Invited by ${inviter.name} to ${activeGathering.title}`, { importance: 7, kind: 'social', tags: [inviter.name.toLowerCase(), a.sectorId] });
      appendResidentMemory(inviter, `Invited ${invitee.name} to ${activeGathering.title}`, { importance: 6, kind: 'social', tags: [invitee.name.toLowerCase(), a.sectorId] });
    } else {
      const topMem = retrieveTopMemories(a.memoryStream || a.memories || [], [a.sectorId], 1)[0];
      const secArt = artifacts.filter((x) => x.sectorId === a.sectorId).slice(-1)[0];
      const secProj = civicProjects.find((p) => p.sectorId === a.sectorId && !p.completed);
      const sharedTopic = secArt?.title
        ? `${secArt.title.slice(0, 22)}`
        : secProj
          ? `${secProj.name.slice(0, 22)}`
          : topMem?.text
            ? topMem.text.slice(0, 26)
            : `${a.sectorId} notes`;
      const aGiftId = Array.isArray(a.inventory)
        ? a.inventory.find((id) => ITEM_CATALOG[id]?.consumable && !(b.inventory || []).includes(id))
        : null;

      if (aGiftId && (b.inventory?.length || 0) < 4) {
        b.inventory = [...(b.inventory || []), aGiftId];
        const itemName = ITEM_CATALOG[aGiftId].name;
        const bSwapId = Array.isArray(b.inventory)
          ? b.inventory.find((id) => id !== aGiftId && ITEM_CATALOG[id]?.consumable && !(a.inventory || []).includes(id))
          : null;
        if (bSwapId && (a.inventory?.length || 0) < 4) {
          a.inventory = [...(a.inventory || []), bSwapId];
          const swapName = ITEM_CATALOG[bSwapId].name;
          a.speech = `${b.name}, try ${itemName}!`;
          b.speech = `Thanks ${a.name}—take this ${swapName}!`;
          appendResidentMemory(b, `Swapped ${swapName} with ${a.name} for ${itemName}`, { importance: 6, kind: 'social', tags: [a.name.toLowerCase(), a.sectorId] });
          appendResidentMemory(a, `Bartered ${itemName} with ${b.name} for ${swapName}`, { importance: 6, kind: 'social', tags: [b.name.toLowerCase(), a.sectorId] });
        } else {
          a.speech = `${b.name}, try this ${itemName}!`;
          b.speech = `Thanks ${a.name}!`;
          appendResidentMemory(b, `Gifted ${itemName} by ${a.name}`, { importance: 6, kind: 'social', tags: [a.name.toLowerCase(), a.sectorId] });
          appendResidentMemory(a, `Shared ${itemName} with ${b.name}`, { importance: 5, kind: 'social', tags: [b.name.toLowerCase(), a.sectorId] });
        }
      } else {
        a.speech = `${b.name}: ${sharedTopic}`;
        b.speech = `Good point, ${a.name}!`;
        appendResidentMemory(b, `Chatted with ${a.name}: ${sharedTopic}`, { importance: 6, kind: 'social', tags: [a.name.toLowerCase(), a.sectorId] });
        appendResidentMemory(a, `Chatted with ${b.name} in ${a.sectorId}`, { importance: 5, kind: 'social', tags: [b.name.toLowerCase(), a.sectorId] });
      }
      turns = [
        { speaker: a.name, line: a.speech },
        { speaker: b.name, line: b.speech },
        { speaker: a.name, line: `Comparing notes on ${sharedTopic} helps (${tierInfo.tier}).` }
      ];
    }

    conversations = [...conversations, {
      id: `conv_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
      ts: Date.now(),
      sectorId: a.sectorId,
      participants: [a.name, b.name],
      tier: tierInfo.tier,
      turns
    }].slice(-16);

    pushFeed(`${a.name} & ${b.name} chatted (${tierInfo.tier})`);
    recordChronicle(`${a.name} & ${b.name} chatted in ${a.sectorId}`);
    return true;
  }

  function persistResidents() {
    if (!storage?.set) return;
    const list = [...entities.values()]
      .filter((e) => e.kind === 'resident')
      .map((e) => ({
        id: e.id,
        profileKey: e.profileKey,
        name: e.name,
        persona: e.persona,
        homeSectorId: e.homeSectorId,
        homeBuildingId: e.homeBuildingId,
        homeBuildingName: e.homeBuildingName,
        homeLayoutStyle: e.homeLayoutStyle,
        homeLayoutSignature: e.homeLayoutSignature,
        isDefaultSeed: Boolean(e.isDefaultSeed),
        dailyAgenda: e.dailyAgenda,
        preferredKind: e.preferredKind,
        memories: e.memories,
        memoryStream: e.memoryStream,
        obsCount: e.obsCount || 0,
        inventory: e.inventory,
        coins: e.coins ?? 25,
        skills: e.skills,
        learnedTraits: e.learnedTraits,
        appearance: e.appearance,
        stats: e.stats,
        relationships: e.relationships,
        isCustom: e.isCustom,
        ownerId: e.ownerId,
        x: Math.round(e.interiorId ? (e.outdoorX ?? 192) : e.x),
        y: Math.round(e.interiorId ? (e.outdoorY ?? 192) : e.y),
        targetStationId: e.interiorId ? null : e.targetStationId,
        color: e.color,
        mood: e.mood,
        statusLabel: e.statusLabel
      }));
    storage.set(RESIDENTS_STORAGE_KEY, list);
  }

  function recordChronicle(entry) {
    const clean = sanitizeCitizenText(entry, 120);
    if (!clean) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    chronicle.push({ ts: Date.now(), time: hhmm, text: clean });
    if (chronicle.length > 40) chronicle = chronicle.slice(-40);
    storage?.set?.(CHRONICLE_STORAGE_KEY, chronicle);
  }

  function buildSnapshot() {
    return {
      worldSpec,
      transportMode: transport.mode,
      timeMode,
      weather,
      paused,
      simSpeed,
      schedulePhase: resolveDailySchedulePhase(null, timeMode),
      activeInterior: activeInteriorId ? getBuildingInterior(activeInteriorId) : null,
      activeGathering: activeGathering
        ? {
            ...activeGathering,
            invitedIds: [...activeGathering.invitedIds],
            attendeeIds: [...activeGathering.attendeeIds]
          }
        : null,
      lighting: computeAmbientLighting(timeMode),
      viewVisible,
      mindIntervalMs,
      packs: packs.listCatalog(),
      activeSeason: packs.getActiveSeason(),
      cameraSectorId,
      selectedEntityId,
      entities: [...entities.values()].map((e) => ({
        ...e,
        stats: e.stats ? { ...e.stats } : undefined,
        relationships: e.relationships ? { ...e.relationships } : undefined,
        inventory: Array.isArray(e.inventory) ? [...e.inventory] : undefined,
        memoryStream: Array.isArray(e.memoryStream) ? [...e.memoryStream] : undefined,
        skills: e.skills ? { ...e.skills } : undefined,
        learnedTraits: Array.isArray(e.learnedTraits) ? [...e.learnedTraits] : undefined,
        title: e.kind === 'resident' ? resolveCitizenTitle(e).label : undefined,
        homeBuildingId: e.homeBuildingId || null,
        homeBuildingName: e.homeBuildingName || null,
        homeLayoutStyle: e.homeLayoutStyle || null,
        homeLayoutSignature: e.homeLayoutSignature || null,
        dailyAgenda: Array.isArray(e.dailyAgenda) ? e.dailyAgenda.map((s) => ({ ...s })) : undefined,
        occupiedBuildingId: e.occupiedBuildingId || null,
        weatherProp: e.weatherProp || null
      })),
      civicProjects: civicProjects.map((p) => ({ ...p, contributors: [...p.contributors] })),
      conversations: conversations.slice(-12),
      artifacts: artifacts.slice(-24),
      feed: feed.slice(-24),
      chronicle: chronicle.slice(-16),
      mindStats: mind.getStats(),
      mindRoute: mindOpts.route || null
    };
  }

  function emit() {
    snapshot = buildSnapshot();
    for (const fn of listeners) {
      try { fn(); } catch {}
    }
  }

  function pushFeed(text) {
    feed.push({ ts: Date.now(), text: sanitizeCitizenText(text, 120) });
    if (feed.length > 60) feed = feed.slice(-60);
  }

  function pickStationForKind(kind) {
    const stations = worldSpec.stations;
    if (!stations.length) return worldSpec.spawn;
    const matching = stations.filter((s) => s.kind === kind);
    const pool = matching.length ? matching : stations;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function rebuildWorldSpec() {
    worldSpec = buildUnifiedWorldSpec(packs);
    const unlockedIds = new Set(worldSpec.sectors.filter((s) => s.unlocked).map((s) => s.id));
    if (!unlockedIds.has(cameraSectorId)) {
      cameraSectorId = 'midtown';
    }
    emit();
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot() {
      return snapshot;
    },
    setViewVisible(visible) {
      const next = Boolean(visible);
      if (viewVisible === next) return;
      viewVisible = next;
      emit();
    },
    setTimeMode(mode) {
      if (mode === 'auto' || mode === 'day' || mode === 'dusk' || mode === 'night') {
        timeMode = mode;
        emit();
      }
    },
    setWeather(mode) {
      if (WEATHER_MODES.includes(mode)) {
        weather = mode;
        emit();
        return weather;
      }
      return weather;
    },
    craftResidentItem(residentId, recipeId = null) {
      const e = entities.get(residentId);
      if (!e || e.kind !== 'resident') return null;
      let recipe = recipeId ? CRAFT_RECIPES.find((r) => r.id === recipeId) : null;
      if (!recipe) {
        recipe = CRAFT_RECIPES.find((r) =>
          r.ingredients.every((id) => e.inventory?.includes(id))
          || (Array.isArray(r.altIngredients) && r.altIngredients.every((id) => e.inventory?.includes(id)))
        ) || CRAFT_RECIPES[0];
      }
      const st = e.targetStationId
        ? worldSpec.stations.find((s) => s.id === e.targetStationId) || null
        : null;
      const crafted = performCraft(e, recipe, st, true);
      if (!crafted) return null;
      persistResidents();
      emit();
      return crafted;
    },
    startGathering({ stationId = null, title = null, hostId = null, durationTicks = 900 } = {}) {
      const host = entities.get(hostId || selectedEntityId)
        || [...entities.values()].find((x) => x.kind === 'resident');
      const st = (stationId ? worldSpec.stations.find((s) => s.id === stationId) : null)
        || worldSpec.stations.find((s) => s.sectorId === host?.sectorId)
        || worldSpec.stations[0];
      if (!st) return null;
      activeGathering = {
        id: `gath_${Date.now().toString(36)}`,
        stationId: st.id,
        sectorId: st.sectorId,
        stationLabel: st.label,
        title: sanitizeCitizenText(title || `${st.label} Symposium`, 48) || `${st.label} Symposium`,
        hostId: host?.id || null,
        hostName: host?.name || 'Town',
        invitedIds: host ? [host.id] : [],
        attendeeIds: [],
        ticksRemaining: durationTicks,
        ts: Date.now()
      };
      if (host) {
        routeEntityTo(host, st.x, st.y, st.id, `-> ${st.label}`);
        host.activeEmoji = '🎉';
        host.emojiTicks = 60;
        appendResidentMemory(host, `Hosted ${activeGathering.title} @ ${st.label}`, {
          importance: 8,
          kind: 'social',
          tags: [st.sectorId, 'gathering']
        });
      }
      pushFeed(`🎉 ${activeGathering.title} @ ${st.label}`);
      recordChronicle(`🎉 Gathering started: ${activeGathering.title} @ ${st.label}`);
      persistResidents();
      emit();
      return {
        ...activeGathering,
        invitedIds: [...activeGathering.invitedIds],
        attendeeIds: [...activeGathering.attendeeIds]
      };
    },
    endGathering() {
      if (!activeGathering) return false;
      activeGathering = null;
      emit();
      return true;
    },
    sendResidentInsideBuilding(residentId, buildingId = null) {
      const ok = sendEntityInsideBuilding(residentId, buildingId);
      if (ok) emit();
      return ok;
    },
    chatWithResident(residentId, userText) {
      const e = entities.get(residentId);
      const cleanUser = sanitizeCitizenText(userText, 140);
      if (!e || e.kind !== 'resident' || !cleanUser) return null;
      const reply = generateCitizenChatReply(e, cleanUser, {
        weather,
        schedulePhase: resolveDailySchedulePhase(null, timeMode),
        activeGathering,
        artifacts,
        civicProjects
      });
      e.speech = reply.speech;
      e.activeEmoji = '💬';
      e.emojiTicks = 65;
      appendResidentMemory(e, `Visitor asked: "${cleanUser.slice(0, 36)}"`, {
        importance: 7,
        kind: 'hermes',
        origin: 'user',
        tags: [e.sectorId, 'visitor']
      });
      const conv = {
        id: `conv_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
        ts: Date.now(),
        sectorId: e.sectorId,
        participants: ['You', e.name],
        tier: resolveCitizenTitle(e).label,
        turns: [
          { speaker: 'You', line: cleanUser },
          { speaker: e.name, line: reply.line },
          { speaker: e.name, line: reply.followUp }
        ]
      };
      conversations = [...conversations, conv].slice(-16);
      pushFeed(`You -> ${e.name}: "${cleanUser.slice(0, 28)}"`);
      persistResidents();
      emit();
      return conv;
    },
    contributeToCivicProject(residentId, projectId = null, optsArg = {}) {
      const e = entities.get(residentId);
      if (!e || e.kind !== 'resident') return null;
      const res = applyContributionToCivicProject(e, projectId, optsArg);
      if (!res) return null;
      persistResidents();
      emit();
      return res;
    },
    setPaused(val) {
      paused = Boolean(val);
      emit();
    },
    setSimSpeed(speed) {
      if (speed === 1 || speed === 2 || speed === 4) {
        simSpeed = speed;
        emit();
      }
    },
    enterBuilding(buildingId) {
      const room = getBuildingInterior(buildingId);
      if (!room) return false;
      activeInteriorId = buildingId;
      const sel = entities.get(selectedEntityId);
      if (sel && sel.kind === 'resident') {
        if (!sel.interiorId) {
          sel.outdoorX = sel.x;
          sel.outdoorY = sel.y;
        }
        sel.interiorId = room.id;
        sel.occupiedBuildingId = buildingId;
        sel.indoorStayTicks = 0;
        sel.x = room.spawn.x;
        sel.y = room.spawn.y;
        sel.targetX = room.spawn.x;
        sel.targetY = room.spawn.y;
        sel.path = [];
        sel.moving = false;
        sel.dir = 'up';
        sel.statusLabel = `Inside ${room.shortName}`;
        recordChronicle(`${sel.name} stepped inside ${room.name}`);
      }

      // Seat a resident host/co-visitor indoors so buildings feel lived-in and allow indoor mingling
      const alreadyHosted = [...entities.values()].some((e) => e.interiorId === room.id && e.id !== sel?.id);
      if (!alreadyHosted && room.stations.length > 0) {
        const hostRes = [...entities.values()].find((e) => e.kind === 'resident' && e.id !== sel?.id && !e.interiorId && e.sectorId === room.sectorId)
          || [...entities.values()].find((e) => e.kind === 'resident' && e.id !== sel?.id && !e.interiorId);
        if (hostRes) {
          hostRes.outdoorX = hostRes.x;
          hostRes.outdoorY = hostRes.y;
          hostRes.interiorId = room.id;
          hostRes.occupiedBuildingId = buildingId;
          hostRes.indoorStayTicks = 0;
          hostRes.x = room.stations[0].x;
          hostRes.y = Math.min(room.rows - 2, room.stations[0].y + 0.8);
          hostRes.targetX = hostRes.x;
          hostRes.targetY = hostRes.y;
          hostRes.path = [];
          hostRes.moving = false;
          hostRes.dir = 'down';
          hostRes.targetStationId = room.stations[0].id;
          hostRes.statusLabel = `At ${room.stations[0].label}`;
        }
      }

      emit();
      return true;
    },
    exitBuilding() {
      if (!activeInteriorId) return false;
      const prevRoom = getBuildingInterior(activeInteriorId);
      for (const e of entities.values()) {
        if (prevRoom && e.interiorId === prevRoom.id) {
          e.interiorId = null;
          e.occupiedBuildingId = null;
          e.indoorStayTicks = 0;
          e.x = e.outdoorX ?? 192;
          e.y = e.outdoorY ?? 192;
          e.targetX = e.x;
          e.targetY = e.y;
          e.path = [];
          e.moving = false;
          e.dir = 'down';
          e.targetStationId = null;
          e.sectorId = sectorAtTile(e.x, e.y).id;
          e.statusLabel = `Outside in ${e.sectorId}`;
        }
      }
      activeInteriorId = null;
      emit();
      return true;
    },
    triggerSocialEncounter(residentId) {
      const a = entities.get(residentId);
      if (!a || a.kind !== 'resident') return false;
      let nearest = null;
      let nearestDist = Infinity;
      const aRoom = a.interiorId || null;
      for (const other of entities.values()) {
        if (other.id === a.id || other.kind !== 'resident') continue;
        if ((other.interiorId || null) !== aRoom) continue;
        const d = Math.hypot(other.x - a.x, other.y - a.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = other;
        }
      }
      if (!nearest) {
        for (const other of entities.values()) {
          if (other.id === a.id || other.kind !== 'resident') continue;
          const d = Math.hypot(other.x - a.x, other.y - a.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = other;
          }
        }
      }
      if (!nearest) return false;
      performSocialEncounter(a, nearest);
      persistResidents();
      emit();
      return true;
    },
    focusSector(sectorId) {
      if (worldSpec.sectors.some((s) => s.id === sectorId)) {
        cameraSectorId = sectorId;
        emit();
      }
    },
    selectEntity(id) {
      selectedEntityId = id;
      emit();
    },
    createResident(input = {}) {
      const id = `cit_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
      const sector = BIOME_SECTORS.find((s) => s.id === input.homeSectorId) || BIOME_SECTORS[4];
      const bounds = getSectorBounds(sector);
      const cleanMems = sanitizeMemories(input.memories);
      const claimedHomeIds = new Set(
        [...entities.values()].filter((x) => x.kind === 'resident' && x.homeBuildingId).map((x) => x.homeBuildingId)
      );
      const unlockedSectorIds = new Set(worldSpec.sectors.filter((s) => s.unlocked).map((s) => s.id));
      const homeBldg = allocateUniqueHomeBuilding(sector.id, claimedHomeIds, entities.size, unlockedSectorIds);
      const traits = inferCitizenTraitsFromProfile({ name: input.name, description: input.persona }, entities.size);
      const spawnX = homeBldg ? homeBldg.x + Math.floor(homeBldg.w / 2) : bounds.centerX;
      const spawnY = homeBldg ? Math.min(WORLD_TILES - 2, homeBldg.y + homeBldg.h + 1) : bounds.centerY;
      const residentName = sanitizeCitizenText(input.name || 'New Citizen', 24) || 'New Citizen';
      const resident = {
        id,
        name: residentName,
        persona: sanitizeCitizenText(input.persona || 'curious explorer of Oikos', 200),
        homeSectorId: sector.id,
        homeBuildingId: homeBldg?.id || null,
        homeBuildingName: homeBldg ? `${residentName.split(' ')[0]}'s ${homeBldg.shortName || homeBldg.name}` : null,
        preferredKind: ACTIVITY_KINDS.includes(input.preferredKind) ? input.preferredKind : traits.preferredKind,
        memories: cleanMems,
        memoryStream: buildMemoryStream(input.memoryStream, cleanMems).map(({ origin: _o, ...m }) => m),
        obsCount: 0,
        inventory: sanitizeInventory(input.inventory || traits.inventory, id),
        coins: typeof input.coins === 'number' ? Math.max(0, Math.round(input.coins)) : 25,
        skills: input.skills ? sanitizeSkills(input.skills) : traits.skills,
        learnedTraits: sanitizeTraits(input.learnedTraits),
        appearance: input.appearance ? sanitizeAppearance(input.appearance) : null,
        stats: input.stats ? sanitizeStats(input.stats) : traits.stats,
        relationships: sanitizeRelationships(input.relationships),
        kind: 'resident',
        isCustom: true,
        isDefaultSeed: false,
        ownerId: 'local',
        x: spawnX,
        y: spawnY,
        sectorId: sectorAtTile(spawnX, spawnY).id,
        targetX: spawnX,
        targetY: spawnY,
        path: [],
        dir: 'down',
        moving: false,
        walkPhase: 0,
        idleTicks: 0,
        activeEmoji: null,
        emojiTicks: 0,
        socialCooldown: 0,
        interiorId: null,
        occupiedBuildingId: null,
        indoorStayTicks: 0,
        weatherProp: null,
        activeTaskPrompt: null,
        targetStationId: null,
        color: traits.color,
        mood: traits.mood,
        speech: '',
        statusLabel: 'At home doorstep',
        prop: null
      };
      resident.dailyAgenda = buildDailyAgenda(resident, worldSpec.stations, resolveDailySchedulePhase(null, timeMode));
      entities.set(id, resident);
      reconcileCitizenHomesAndUniqueness();
      selectedEntityId = id;
      cameraSectorId = sector.id;
      recordChronicle(`${resident.name} settled in ${sector.name}`);
      transport.publishCitizen?.(resident)?.catch?.(() => {});
      persistResidents();
      emit();
      return { ...resident };
    },
    updateResident(id, patch = {}) {
      const e = entities.get(id);
      if (!e || e.kind !== 'resident') return null;
      if (typeof patch.name === 'string') {
        const cleanName = sanitizeCitizenText(patch.name, 24);
        if (cleanName) e.name = cleanName;
      }
      if (typeof patch.persona === 'string') {
        e.persona = sanitizeCitizenText(patch.persona, 200);
      }
      if (typeof patch.homeSectorId === 'string' && BIOME_SECTORS.some((s) => s.id === patch.homeSectorId)) {
        e.homeSectorId = patch.homeSectorId;
        e.homeBuildingId = null;
        e.dailyAgenda = buildDailyAgenda(e, worldSpec.stations, resolveDailySchedulePhase(null, timeMode));
      }
      if (typeof patch.preferredKind === 'string' && ACTIVITY_KINDS.includes(patch.preferredKind)) {
        e.preferredKind = patch.preferredKind;
      }
      if (Array.isArray(patch.memories)) {
        e.memories = sanitizeMemories(patch.memories);
        e.memoryStream = buildMemoryStream(null, e.memories);
      }
      if (patch.appearance && typeof patch.appearance === 'object') {
        e.appearance = sanitizeAppearance({ ...e.appearance, ...patch.appearance }, e.appearance);
      }
      reconcileCitizenHomesAndUniqueness();
      persistResidents();
      emit();
      return { ...e };
    },
    removeResident(id) {
      const e = entities.get(id);
      if (!e || e.kind !== 'resident') return false;
      const remaining = [...entities.values()].filter((x) => x.kind === 'resident' && x.id !== id);
      if (remaining.length === 0) return false;
      entities.delete(id);
      if (selectedEntityId === id) {
        selectedEntityId = remaining[0].id;
      }
      reconcileCitizenHomesAndUniqueness();
      persistResidents();
      emit();
      return true;
    },
    unlockPack(packId) {
      if (packs.unlockPack(packId)) {
        recordChronicle(`Unlocked pack: ${packId}`);
        rebuildWorldSpec();
      }
    },
    setPackEnabled(packId, isOn) {
      if (packs.setPackEnabled(packId, isOn)) {
        rebuildWorldSpec();
      }
    },
    setMindEnabled(isOn) {
      mind.setEnabled(isOn === true);
      persistMindSettings();
      emit();
    },
    setMindBudget(next = {}) {
      const applied = mind.setBudget(next);
      persistMindSettings();
      emit();
      return applied;
    },
    syncHermesProfiles(profileList = [], syncOpts = {}) {
      if (!Array.isArray(profileList) || profileList.length === 0) return 0;
      const unlockedSectors = worldSpec.sectors.filter((s) => s.unlocked);
      const unlockedSectorIds = new Set(unlockedSectors.map((s) => s.id));
      const matchedIds = new Set();
      const claimedHomeIds = new Set(
        [...entities.values()]
          .filter((e) => e.kind === 'resident' && !e.isDefaultSeed && e.homeBuildingId)
          .map((e) => e.homeBuildingId)
      );
      let addedOrUpdated = 0;

      for (let rowIdx = 0; rowIdx < profileList.length; rowIdx += 1) {
        const rawRow = profileList[rowIdx];
        const row = typeof rawRow === 'string' ? { name: rawRow } : rawRow;
        const rawKey = typeof row?.name === 'string' ? row.name.trim() : '';
        if (!rawKey) continue;
        const lowerKey = rawKey.toLowerCase();
        const friendlyRaw = row?.ui_meta?.['hermes-bots']?.title || row?.display_name || rawKey;
        const displayName = sanitizeCitizenText(friendlyRaw, 24) || rawKey;
        const lowerDisplay = displayName.toLowerCase();
        const desc = typeof row?.description === 'string' ? sanitizeCitizenText(row.description, 200) : '';

        const existing = [...entities.values()].find(
          (e) => e.kind === 'resident' && !matchedIds.has(e.id) && (
            (e.profileKey && e.profileKey.toLowerCase() === lowerKey) ||
            e.name.toLowerCase() === lowerDisplay ||
            e.name.toLowerCase() === lowerKey
          )
        );

        if (existing) {
          existing.profileKey = lowerKey;
          existing.isDefaultSeed = false;
          if (desc && !existing.isCustom && desc.length > 4) {
            existing.persona = desc;
          }
          matchedIds.add(existing.id);
          addedOrUpdated++;
        } else if (unlockedSectors.length > 0) {
          const idx = addedOrUpdated + matchedIds.size;
          const traits = inferCitizenTraitsFromProfile(row, rowIdx);
          const sec = (row?.homeSectorId && unlockedSectors.find((s) => s.id === row.homeSectorId))
            || unlockedSectors[idx % unlockedSectors.length];
          const homeBldg = allocateUniqueHomeBuilding(sec.id, claimedHomeIds, rowIdx, unlockedSectorIds);
          const b = getSectorBounds(sec);
          const spawnX = homeBldg ? homeBldg.x + Math.floor(homeBldg.w / 2) : b.centerX;
          const spawnY = homeBldg ? Math.min(WORLD_TILES - 2, homeBldg.y + homeBldg.h + 1) : b.centerY;
          const id = `res_prof_${lowerKey.replace(/[^a-z0-9_]/g, '_')}`;
          const formattedName = displayName[0].toUpperCase() + displayName.slice(1);
          const citizen = {
            id,
            profileKey: lowerKey,
            name: formattedName,
            persona: desc || `${formattedName} — Hermes profile citizen in ${sec.name}`,
            homeSectorId: sec.id,
            homeBuildingId: homeBldg?.id || null,
            homeBuildingName: homeBldg ? `${formattedName.split(' ')[0]}'s ${homeBldg.shortName || homeBldg.name}` : null,
            preferredKind: traits.preferredKind,
            memories: [`Synced from Hermes profile "${rawKey}"`],
            memoryStream: buildMemoryStream(null, [`Synced from Hermes profile "${rawKey}"`]),
            obsCount: 0,
            inventory: sanitizeInventory(traits.inventory, id),
            coins: 25 + ((rowIdx * 7) % 15),
            skills: traits.skills,
            learnedTraits: [],
            appearance: null,
            stats: traits.stats,
            relationships: {},
            kind: 'resident',
            isCustom: false,
            isDefaultSeed: false,
            ownerId: 'hermes',
            x: spawnX,
            y: spawnY,
            sectorId: sectorAtTile(spawnX, spawnY).id,
            targetX: spawnX,
            targetY: spawnY,
            path: [],
            dir: 'down',
            moving: false,
            walkPhase: 0,
            idleTicks: 0,
            activeEmoji: null,
            emojiTicks: 0,
            socialCooldown: 0,
            interiorId: null,
            occupiedBuildingId: null,
            indoorStayTicks: 0,
            weatherProp: null,
            activeTaskPrompt: null,
            targetStationId: null,
            color: traits.color,
            mood: traits.mood,
            speech: '',
            statusLabel: 'At home doorstep',
            prop: null
          };
          citizen.dailyAgenda = buildDailyAgenda(citizen, worldSpec.stations, resolveDailySchedulePhase(null, timeMode));
          entities.set(id, citizen);
          matchedIds.add(id);
          recordChronicle(`Synced Hermes profile citizen: ${citizen.name}`);
          addedOrUpdated++;
        }
      }

      if (!syncOpts?.additiveOnly && matchedIds.size > 0) {
        for (const [entId, ent] of [...entities.entries()]) {
          if (ent.kind === 'resident' && ent.isDefaultSeed && !ent.isCustom && !matchedIds.has(entId)) {
            entities.delete(entId);
          }
        }
        if (!entities.has(selectedEntityId)) {
          const firstRes = [...entities.values()].find((e) => e.kind === 'resident');
          if (firstRes) selectedEntityId = firstRes.id;
        }
      }

      if (addedOrUpdated > 0) {
        reconcileCitizenHomesAndUniqueness();
        persistResidents();
        emit();
      }
      return addedOrUpdated;
    },
    upsertLiveAgent({ id, sessionId, profile, name, activity }) {
      const lowerProfile = profile ? String(profile).toLowerCase() : '';
      const lowerName = name ? String(name).toLowerCase() : '';
      const matchedResident = [...entities.values()].find(
        (e) => e.kind === 'resident' && (
          (lowerProfile && e.profileKey && e.profileKey.toLowerCase() === lowerProfile) ||
          (lowerName && e.name && e.name.toLowerCase() === lowerName)
        )
      );

      const st = pickStationForKind(activity?.stationKind || 'work');
      if (matchedResident) {
        matchedResident.prop = activity?.prop || null;
        matchedResident.mood = 'focused';
        routeEntityTo(
          matchedResident,
          st.x,
          st.y,
          st.id,
          `${activity?.label || 'Active'} @ ${st.label}`
        );
        appendResidentMemory(matchedResident, `${activity?.label || 'Worked'} @ ${st.label}`, {
          importance: 7,
          kind: 'hermes',
          origin: 'hermes',
          tags: [st.sectorId, st.kind]
        });
        const eventLine = `${matchedResident.name} (${activity?.label || 'Active'}) @ ${st.label}`;
        recentHermesEvents.push(eventLine);
        if (recentHermesEvents.length > 10) recentHermesEvents = recentHermesEvents.slice(-10);
        pushFeed(eventLine);
        emit();
        return;
      }

      const existing = entities.get(id);
      const startX = existing ? existing.x : worldSpec.spawn.x;
      const startY = existing ? existing.y : worldSpec.spawn.y;
      const next = {
        id,
        sessionId,
        profile,
        name: sanitizeCitizenText(name || sessionId || id, 24),
        kind: 'hermes_agent',
        color: '#facc15',
        x: startX,
        y: startY,
        targetX: st.x,
        targetY: st.y,
        path: findSidewalkPath(startX, startY, st.x, st.y),
        dir: existing?.dir || 'down',
        moving: true,
        walkPhase: existing?.walkPhase || 0,
        idleTicks: 0,
        targetStationId: st.id,
        sectorId: sectorAtTile(startX, startY).id,
        statusLabel: activity?.label || 'Active',
        prop: activity?.prop || null,
        speech: '',
        mood: 'focused',
        memories: []
      };
      entities.set(id, next);
      const eventLine = `${next.name} (${next.statusLabel}) @ ${st.label}`;
      recentHermesEvents.push(eventLine);
      if (recentHermesEvents.length > 10) recentHermesEvents = recentHermesEvents.slice(-10);
      pushFeed(eventLine);
      if (!existing) recordChronicle(`Hermes visitor ${next.name} arrived in ${st.sectorId}`);
      emit();
    },
    useResidentItem(residentId, itemId) {
      const e = entities.get(residentId);
      const item = ITEM_CATALOG[itemId];
      if (!e || e.kind !== 'resident' || !item) return false;
      if (!Array.isArray(e.inventory) || !e.inventory.includes(itemId)) return false;

      if (e.stats && item.effects) {
        if (item.effects.energy) e.stats.energy = Math.min(100, e.stats.energy + item.effects.energy);
        if (item.effects.focus) e.stats.focus = Math.min(100, e.stats.focus + item.effects.focus);
        if (item.effects.social) e.stats.social = Math.min(100, e.stats.social + item.effects.social);
        if (item.effects.inspiration) e.stats.inspiration = Math.min(100, e.stats.inspiration + item.effects.inspiration);
      }
      if (item.consumable) {
        const idx = e.inventory.indexOf(itemId);
        if (idx >= 0) e.inventory.splice(idx, 1);
      }
      e.activeEmoji = item.icon;
      e.emojiTicks = 50;
      e.speech = `Used ${item.name}`;
      appendResidentMemory(e, `Used ${item.name} (${item.icon})`, { importance: 4, kind: 'obs' });
      persistResidents();
      emit();
      return true;
    },
    giveResidentItem(residentId, itemId) {
      const e = entities.get(residentId);
      const item = ITEM_CATALOG[itemId];
      if (!e || e.kind !== 'resident' || !item) return false;
      e.inventory = Array.isArray(e.inventory) ? e.inventory : [];
      if (!e.inventory.includes(itemId)) {
        if (e.inventory.length >= 4) e.inventory.shift();
        e.inventory.push(itemId);
      }
      persistResidents();
      emit();
      return true;
    },
    recordObservation(residentId, text, obsOpts = {}) {
      const e = entities.get(residentId);
      if (!e || e.kind !== 'resident') return null;
      const entry = appendResidentMemory(e, text, obsOpts);
      persistResidents();
      emit();
      return entry;
    },
    pinStationArtifact(optsArg) {
      const art = pinStationArtifact(optsArg || {});
      if (art) emit();
      return art;
    },
    spawnSubagentWorker({ parentId, profile = null, subagentId, name, stationKind = 'delegate', label = 'Subagent task' }) {
      const parent = entities.get(parentId)
        || [...entities.values()].find((x) =>
          (parentId && x.sessionId === parentId)
          || (profile && x.profileKey === String(profile).toLowerCase())
          || (parentId && x.profileKey === String(parentId).toLowerCase())
        )
        || [...entities.values()][0];
      if (!parent) return null;

      const sectorStations = worldSpec.stations.filter((s) => s.sectorId === parent.sectorId);
      const pool = sectorStations.length ? sectorStations : worldSpec.stations;
      const matched = pool.filter((s) => s.kind === stationKind);
      const targetSt = matched[0] || pool[0] || worldSpec.spawn;

      const wid = subagentId || `sub_${parent.id}_${Date.now().toString(36)}`;
      const existing = entities.get(wid);
      const sx = existing ? existing.x : Math.min(WORLD_TILES - 2, parent.x + 1);
      const sy = existing ? existing.y : Math.min(WORLD_TILES - 2, parent.y + 1);

      const worker = existing || {
        id: wid,
        kind: 'subagent',
        parentId: parent.id,
        sessionId: parent.sessionId || null,
        name: sanitizeCitizenText(name || `${parent.name} Subagent`, 24),
        color: '#38bdf8',
        appearance: parent.appearance ? { ...parent.appearance } : undefined,
        x: sx,
        y: sy,
        sectorId: parent.sectorId || sectorAtTile(sx, sy).id,
        targetX: targetSt.x,
        targetY: targetSt.y,
        path: [],
        dir: 'down',
        moving: false,
        walkPhase: 0,
        idleTicks: 0,
        activeEmoji: '⚡',
        emojiTicks: 60,
        socialCooldown: 0,
        interiorId: null,
        targetStationId: targetSt.id,
        statusLabel: sanitizeCitizenText(label, 48),
        prop: 'drone_controller',
        speech: '',
        mood: 'focused',
        memories: []
      };
      worker.parentId = parent.id;
      worker.ttlTicks = 600;
      worker.activeEmoji = '⚡';
      worker.emojiTicks = 60;
      routeEntityTo(worker, targetSt.x, targetSt.y, targetSt.id, sanitizeCitizenText(label, 48));
      entities.set(wid, worker);
      pushFeed(`${worker.name} dispatched -> ${targetSt.label}`);
      emit();
      return { ...worker };
    },
    completeSubagentWorker(workerId) {
      const ent = entities.get(workerId);
      if (!ent || ent.kind !== 'subagent') return false;
      entities.delete(workerId);
      emit();
      return true;
    },
    completeSubagentsForParent(parentId = null) {
      let removed = 0;
      for (const [id, ent] of entities.entries()) {
        if (ent.kind !== 'subagent') continue;
        if (!parentId || ent.parentId === parentId || ent.sessionId === parentId) {
          entities.delete(id);
          removed += 1;
        }
      }
      if (removed > 0) emit();
      return removed;
    },
    dispatchStationTask(residentId, stationId, taskPrompt) {
      const e = entities.get(residentId);
      const st = worldSpec.stations.find((s) => s.id === stationId);
      if (!e || e.kind !== 'resident' || !st) return null;
      const cleanTask = sanitizeCitizenText(taskPrompt || `Focus work at ${st.label}`, 120) || `Work at ${st.label}`;
      const synth = synthesizeTaskDeliverable(e, st, cleanTask);
      e.activeTaskPrompt = cleanTask;
      routeEntityTo(e, st.x, st.y, st.id, `-> ${st.label}`);
      e.speech = cleanTask.slice(0, 26);
      appendResidentMemory(e, `Task @ ${st.label}: ${cleanTask}`, {
        importance: 8,
        kind: 'hermes',
        origin: 'user',
        tags: [st.sectorId, st.kind]
      });
      const art = pinStationArtifact({
        stationId: st.id,
        authorId: e.id,
        authorName: e.name,
        title: `Task @ ${st.label}`,
        prompt: cleanTask,
        summary: synth.summary,
        deliverable: synth.deliverable
      });
      pushFeed(`${e.name} assigned "${cleanTask}" @ ${st.label}`);
      persistResidents();
      emit();
      return art;
    },
    sendResidentToStation(residentId, stationId) {
      const e = entities.get(residentId);
      if (!e || e.kind !== 'resident') return false;
      const room = activeInteriorId ? getBuildingInterior(activeInteriorId) : null;
      const indoorSt = (room && e.interiorId === room.id)
        ? room.stations.find((s) => s.id === stationId)
        : null;
      const st = indoorSt || worldSpec.stations.find((s) => s.id === stationId);
      if (!st) return false;
      routeEntityTo(e, st.x, st.y, st.id, `-> ${st.label}`);
      e.speech = '';
      pushFeed(`${e.name} -> ${st.label}`);
      if (!e.interiorId) {
        recordChronicle(`${e.name} walked to ${st.label} (${st.sectorId})`);
      }
      transport.dispatchAction?.(e.id, { verb: 'walk_to', target: { x: st.x, y: st.y } })?.catch?.(() => {});
      persistResidents();
      emit();
      return true;
    },
    sendResidentToTile(residentId, tileX, tileY) {
      const e = entities.get(residentId);
      if (!e || e.kind !== 'resident') return false;
      const room = e.interiorId ? getBuildingInterior(activeInteriorId) : null;
      const isIndoor = Boolean(room && e.interiorId === room.id);
      const clampedX = isIndoor
        ? Math.max(1, Math.min(room.cols - 2, Number(tileX) || 1))
        : Math.max(0, Math.min(WORLD_TILES - 1, Number(tileX) || 0));
      const clampedY = isIndoor
        ? Math.max(1, Math.min(room.rows - 2, Number(tileY) || 1))
        : Math.max(0, Math.min(WORLD_TILES - 1, Number(tileY) || 0));
      routeEntityTo(e, clampedX, clampedY, null, 'Walking...');
      e.speech = '';
      transport.dispatchAction?.(e.id, { verb: 'walk_to', target: { x: clampedX, y: clampedY } })?.catch?.(() => {});
      persistResidents();
      emit();
      return true;
    },
    stepMovement(dtSeconds = 0.05) {
      if (paused) return;
      let moved = false;
      const dt = dtSeconds * simSpeed;
      const unlockedIds = new Set(worldSpec.sectors.filter((s) => s.unlocked).map((s) => s.id));

      if (activeGathering) {
        activeGathering.ticksRemaining = (activeGathering.ticksRemaining ?? 0) - 1;
        if (activeGathering.ticksRemaining <= 0) {
          activeGathering = null;
          moved = true;
        }
      }

      for (const e of [...entities.values()]) {
        if (e.kind === 'subagent') {
          e.ttlTicks = (e.ttlTicks ?? 600) - 1;
          if (e.ttlTicks <= 0) {
            entities.delete(e.id);
            moved = true;
            continue;
          }
        }
        if (e.kind === 'resident' && e.indoorStayTicks > 0 && activeInteriorId !== e.occupiedBuildingId) {
          e.indoorStayTicks -= 1;
          if (e.indoorStayTicks <= 0) {
            e.indoorStayTicks = 0;
            e.occupiedBuildingId = null;
            e.interiorId = null;
            e.x = e.outdoorX ?? 192;
            e.y = e.outdoorY ?? 192;
            e.targetX = e.x;
            e.targetY = e.y;
            e.path = [];
            e.moving = false;
            e.dir = 'down';
            e.sectorId = sectorAtTile(e.x, e.y).id;
            e.statusLabel = `Outside in ${e.sectorId}`;
            moved = true;
          }
        }
        if (e.kind === 'resident') {
          const nextWProp = (weather === 'rain' && !e.interiorId) ? '☂️' : null;
          if (e.weatherProp !== nextWProp) {
            e.weatherProp = nextWProp;
          }
        }
        if (e.emojiTicks > 0) {
          e.emojiTicks -= 1;
          if (e.emojiTicks <= 0) {
            e.emojiTicks = 0;
            e.activeEmoji = null;
            e.speech = '';
            moved = true;
          }
        }
        if (e.socialCooldown > 0) {
          e.socialCooldown = Math.max(0, e.socialCooldown - 1);
        }
        if (e.kind === 'resident' && e.stats) {
          e.stats.energy = Math.max(15, e.stats.energy - 0.015 * dt);
          e.stats.focus = Math.max(15, e.stats.focus - 0.012 * dt);
          e.stats.social = Math.max(15, e.stats.social - 0.010 * dt);
        }

        const bikeMult = (!e.interiorId && Array.isArray(e.inventory) && e.inventory.includes('folding_bike'))
          ? (ITEM_CATALOG.folding_bike.speedMultiplier || 1.45)
          : 1;
        const speed = 2.6 * dt * bikeMult;

        const hasWaypoints = Array.isArray(e.path) && e.path.length > 0;
        const wp = hasWaypoints ? e.path[0] : { x: e.targetX, y: e.targetY };
        if (hasWaypoints && wp.transitHop) {
          e.x = wp.x;
          e.y = wp.y;
          e.sectorId = sectorAtTile(e.x, e.y).id;
          e.activeEmoji = '🚇';
          e.emojiTicks = 45;
          pushFeed(`${e.name} rode transit -> ${wp.toStop}`);
          e.path.shift();
          e.moving = e.path.length > 0;
          moved = true;
          continue;
        }

        const dx = wp.x - e.x;
        const dy = wp.y - e.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.05) {
          const step = Math.min(dist, speed);
          e.dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
          e.x += (dx / dist) * step;
          e.y += (dy / dist) * step;
          e.moving = true;
          e.walkPhase = ((e.walkPhase || 0) + step * 2.4) % 600;
          e.idleTicks = 0;
          if (!e.interiorId) {
            e.sectorId = sectorAtTile(e.x, e.y).id;
          }
          moved = true;
        } else {
          if (dx !== 0 || dy !== 0) {
            e.x = wp.x;
            e.y = wp.y;
            moved = true;
          }
          if (hasWaypoints) {
            e.path.shift();
            if (e.path.length > 0) {
              const nextWp = e.path[0];
              if (nextWp.transitHop) {
                e.moving = true;
                moved = true;
                continue;
              }
              const ndx = nextWp.x - e.x;
              const ndy = nextWp.y - e.y;
              e.dir = Math.abs(ndx) >= Math.abs(ndy) ? (ndx >= 0 ? 'right' : 'left') : (ndy >= 0 ? 'down' : 'up');
              e.moving = true;
              moved = true;
              continue;
            }
          }

          if (e.moving) {
            e.moving = false;
            moved = true;
          }
          if (e.statusLabel && e.statusLabel.startsWith('-> ')) {
            e.statusLabel = e.statusLabel.replace(/^->\s*/, 'At ');
            e.dir = 'down';
            applyStationArrivalReward(e);
            moved = true;
          } else if (e.statusLabel === 'Walking...') {
            e.statusLabel = e.interiorId ? 'Inside room' : `Exploring ${e.sectorId}`;
            e.dir = 'down';
            moved = true;
          }

          if (e.kind === 'resident' && !e.interiorId) {
            e.idleTicks = (e.idleTicks || 0) + 1;
            if (e.idleTicks >= 180 && worldSpec.stations.length > 0) {
              e.idleTicks = 0;
              const isNight = computeAmbientLighting(timeMode).isNight;
              const indoorCount = [...entities.values()].filter((x) => x.kind === 'resident' && x.interiorId).length;
              if ((weather === 'rain' || isNight) && indoorCount < 4 && sendEntityInsideBuilding(e.id, e.homeBuildingId)) {
                moved = true;
              } else {
                const pendingStep = Array.isArray(e.dailyAgenda) ? e.dailyAgenda.find((s) => !s.done) : null;
                const agendaSt = pendingStep
                  ? worldSpec.stations.find((s) => s.id === pendingStep.stationId && unlockedIds.has(s.sectorId))
                  : null;
                const unlockedStations = worldSpec.stations.filter((s) => unlockedIds.has(s.sectorId));
                const candidates = unlockedStations.length ? unlockedStations : worldSpec.stations;
                const homePool = candidates.filter((s) => s.sectorId === e.homeSectorId || s.kind === e.preferredKind);
                const pool = homePool.length ? homePool : candidates;
                const nextSt = agendaSt || pool[Math.floor(Math.random() * pool.length)];
                if (nextSt && (Math.abs(nextSt.x - e.x) > 1 || Math.abs(nextSt.y - e.y) > 1)) {
                  routeEntityTo(e, nextSt.x, nextSt.y, nextSt.id, `-> ${nextSt.label}`);
                  moved = true;
                }
              }
            }
          }
        }
      }

      // Passive co-located social encounters among outdoor & same-interior residents
      const socialCandidates = [];
      for (const e of entities.values()) {
        if (e.kind !== 'resident' || (e.socialCooldown || 0) > 0) continue;
        const roomKey = e.interiorId || (unlockedIds.has(e.sectorId) ? 'outdoor' : null);
        if (roomKey) socialCandidates.push({ ent: e, roomKey });
      }
      for (let i = 0; i < socialCandidates.length; i += 1) {
        const { ent: a, roomKey: rA } = socialCandidates[i];
        if ((a.socialCooldown || 0) > 0) continue;
        for (let j = i + 1; j < socialCandidates.length; j += 1) {
          const { ent: b, roomKey: rB } = socialCandidates[j];
          if (rA !== rB || (b.socialCooldown || 0) > 0) continue;
          const threshold = rA === 'outdoor' ? 2.8 : 3.2;
          if (Math.hypot(b.x - a.x, b.y - a.y) <= threshold) {
            performSocialEncounter(a, b);
            moved = true;
            break;
          }
        }
      }

      if (moved) emit();
    },
    async runMindTick(clockLabel = null) {
      if (destroyed) return [];
      const now = new Date();
      const label = clockLabel || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const residents = [...entities.values()].filter((e) => e.kind === 'resident');
      const decisions = await mind.stepResidents({
        residents,
        stations: worldSpec.stations,
        clockLabel: label,
        timeMode,
        weather,
        activeGathering
      });
      // The page may have been closed, reloaded or the plugin disabled while the request was out.
      // A destroyed runtime's world is stale: applying or persisting it would overwrite newer state.
      if (destroyed) return [];
      const stMap = new Map(worldSpec.stations.map((s) => [s.id, s]));
      for (const d of decisions) {
        const e = entities.get(d.id);
        const st = stMap.get(d.stationId);
        if (!e || !st) continue;
        const prevSector = e.sectorId;
        e.mood = d.mood;
        e.speech = d.speech || '';
        routeEntityTo(e, st.x, st.y, st.id, `-> ${st.label}`);
        // 'mind' = the model's own words, 'oikos' = a fixed template; both may be fed back to the model.
        const ownMemory = d.source === 'llm' && d.memory;
        appendResidentMemory(e, ownMemory ? d.memory : (d.source === 'llm' ? `Visited ${st.label}` : (d.memory || `Visited ${st.label}`)), {
          importance: d.source === 'llm' ? 6 : 4,
          kind: 'obs',
          origin: ownMemory ? 'mind' : 'oikos',
          tags: [st.sectorId, st.kind]
        });
        if (d.speech) {
          pushFeed(`${e.name}: "${d.speech}"`);
          recordChronicle(`${e.name}: "${d.speech}"`);
        } else if (prevSector !== st.sectorId) {
          recordChronicle(`${e.name} headed to ${st.label} (${st.sectorId})`);
        }
        transport.dispatchAction?.(e.id, { verb: 'walk_to', target: { x: st.x, y: st.y } })?.catch?.(() => {});
      }
      persistResidents();
      emit();
      return decisions;
    },
    startLoop() {
      if (destroyed) return;
      if (!stopTransport && typeof transport.connect === 'function') {
        stopTransport = transport.connect(() => {});
      }
      if (!tickTimer) {
        tickTimer = setInterval(() => {
          if (viewVisible) this.stepMovement(0.05);
        }, 50);
        tickTimer?.unref?.();
      }
      if (!mindTimer) {
        mindTimer = setInterval(() => {
          if (viewVisible) this.runMindTick().catch(() => {});
        }, mindIntervalMs);
        mindTimer?.unref?.();
      }
    },
    destroy() {
      destroyed = true;
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
      if (mindTimer) {
        clearInterval(mindTimer);
        mindTimer = null;
      }
      if (typeof stopTransport === 'function') {
        stopTransport();
        stopTransport = null;
      }
      listeners.clear();
    }
  };
}
