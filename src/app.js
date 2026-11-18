// Oikos React UI Mount: Full-Bleed Playable 384x384 Multi-Biome Habitat,
// 44px Top Menu Bar, Biome Dropdown, Collapsible Slide-Over Drawer & 5-Layer Avatar Studio.

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  loadPluginSprites,
  getCompositedCharSheet,
  getAvatarOptions
} from './assets/embedded.js';
import { WORLD_TILES, sectorAtTile } from './world-layout.js';
import { ITEM_CATALOG, CRAFT_RECIPES, clampCameraToUnlocked, getSectorBuildings } from './world-map.js';
import { getRelationshipTier } from './llm-mind.js';
import {
  TILE_SIZE,
  ZOOM_LEVELS,
  renderWorldCanvas,
  renderMinimapCanvas,
  hitTestWorld
} from './renderer.js';
import { ACTIVITY_KINDS, WEATHER_MODES } from './runtime.js';
import { sound } from './audio.js';
import { oikosStyles } from './styles.js';

const h = React.createElement;

const SEMANTIC_OUTFIT_LABELS = Object.freeze({
  outfit_rittenhouse_trench: 'Trench Coat',
  outfit_athletic_tracksuit: 'Varsity Track',
  outfit_curtis_evening: 'Evening Suit',
  outfit_parc_casual: 'Casual Knit'
});

function formatLayerLabel(rawKey) {
  if (!rawKey || rawKey === 'none') return 'None';
  if (SEMANTIC_OUTFIT_LABELS[rawKey]) return SEMANTIC_OUTFIT_LABELS[rawKey];
  const parts = String(rawKey).split('_');
  if (parts[0] === 'body' && parts[1]) return `Body ${parts[1]}`;
  if (parts[0] === 'eyes' && parts[1]) return `Eyes ${parts[1]}`;
  if (parts[0] === 'outfit' && parts[1]) return `Outfit ${parts[1]}`;
  if (parts[0] === 'hairstyle' && parts[1]) return `Hair ${parts[1]}`;
  if (parts[0] === 'accessory') {
    const clean = parts.slice(2, -1).join(' ');
    return clean ? `${clean[0].toUpperCase()}${clean.slice(1)}` : `Item ${parts[1] || ''}`;
  }
  return String(rawKey).slice(0, 14);
}

function AvatarPreview({ appearance, entityId, tick, width = 56, height = 84 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const sheet = getCompositedCharSheet(appearance, entityId);
    if (sheet) {
      const frame = Math.floor(tick / 4) % 6;
      const dw = Math.round(c.width * 0.8);
      const dh = Math.round(dw * 2);
      const dx = Math.round((c.width - dw) / 2);
      const dy = Math.round(c.height - dh);
      ctx.drawImage(sheet, (18 + frame) * 32, 0, 32, 64, dx, dy, dw, dh);
    }
  }, [appearance, entityId, tick, width, height]);
  return h('canvas', {
    ref,
    width,
    height,
    style: {
      flex: 'none',
      background: 'rgba(7, 11, 20, 0.72)',
      borderRadius: 6,
      border: '1px solid rgba(148, 163, 184, 0.25)',
      imageRendering: 'pixelated'
    }
  });
}

function cycleOption(list, current, delta) {
  if (!list.length) return current;
  const idx = Math.max(0, list.indexOf(current));
  return list[(idx + delta + list.length) % list.length];
}

export function OikosPage({ runtime, host }) {
  const snap = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const miniRadarRef = useRef(null);
  const atlasRadarRef = useRef(null);

  const [spritesReady, setSpritesReady] = useState(false);
  const [biomeMenuOpen, setBiomeMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('citizens'); // 'citizens' | 'atlas' | 'packs' | 'chronicle' | null
  const [uiHidden, setUiHidden] = useState(false);
  const [mindConsentOpen, setMindConsentOpen] = useState(false);
  const [radarOpen, setRadarOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [memDraft, setMemDraft] = useState('');
  const [tickView, setTickView] = useState(0);
  const [followMode, setFollowMode] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [showLabels, setShowLabels] = useState(false);
  const [soundMuted, setSoundMuted] = useState(sound.muted);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskStationId, setTaskStationId] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [lastChatReply, setLastChatReply] = useState(null);
  const [hoverSummary, setHoverSummary] = useState(null);
  const [cursorClass, setCursorClass] = useState('');

  const tickRef = useRef(0);
  const cameraRef = useRef({ x: 192, y: 196, zoom: 1.0 });
  const followRef = useRef(true);
  const showLabelsRef = useRef(false);
  const hoveredRef = useRef(null);
  const lastHoverKeyRef = useRef('');
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, camX: 192, camY: 196 });
  const keysRef = useRef(new Set());
  const biomeDropdownWrapRef = useRef(null);

  followRef.current = followMode;
  showLabelsRef.current = showLabels;
  cameraRef.current.zoom = zoom;

  const residents = snap.entities.filter((e) => e.kind === 'resident');
  const liveAgents = snap.entities.filter((e) => e.kind === 'hermes_agent');
  const selected = residents.find((e) => e.id === snap.selectedEntityId) || residents[0] || null;
  const unlockedSectors = snap.worldSpec.sectors.filter((s) => s.unlocked);
  const orderedSectors = useMemo(
    () => [...snap.worldSpec.sectors].sort((a, b) => (a.gy - b.gy) || (a.gx - b.gx)),
    [snap.worldSpec.sectors]
  );
  const avatarOpts = useMemo(() => getAvatarOptions(), []);

  // Keep camera synced & render canvas cleanly with ResizeObserver + visibility gating
  useEffect(() => {
    let alive = true;
    const syncVisibility = () => {
      const hidden = typeof document !== 'undefined' && document.hidden;
      runtime.setViewVisible(!hidden);
    };
    syncVisibility();
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', syncVisibility);
    }

    const resizeCanvas = () => {
      const stage = stageRef.current;
      const c = canvasRef.current;
      if (!stage || !c) return;
      const rect = stage.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const hPx = Math.max(240, Math.floor(rect.height));
      if (c.width !== w || c.height !== hPx) {
        c.width = w;
        c.height = hPx;
        renderWorldCanvas(c, runtime.getSnapshot(), tickRef.current, cameraRef.current, {
          hovered: hoveredRef.current,
          selectedEntityId: runtime.getSnapshot().selectedEntityId,
          showLabels: showLabelsRef.current
        });
      }
    };

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && stageRef.current) {
      ro = new ResizeObserver(resizeCanvas);
      ro.observe(stageRef.current);
    }
    resizeCanvas();

    loadPluginSprites().then((ok) => {
      if (alive && ok) setSpritesReady(true);
    });

    const timer = setInterval(() => {
      tickRef.current++;
      if (tickRef.current % 5 === 0) setTickView(tickRef.current);
      const curSnap = runtime.getSnapshot();

      // Keyboard WASD / Arrow camera pan (disabled indoors to avoid Follow/camera clamp jitter)
      if (!curSnap.activeInterior) {
        const keys = keysRef.current;
        let panDx = 0;
        let panDy = 0;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) panDx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) panDx += 1;
        if (keys.has('KeyW') || keys.has('ArrowUp')) panDy -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) panDy += 1;
        if (panDx !== 0 || panDy !== 0) {
          const speed = 0.85 / Math.max(0.5, cameraRef.current.zoom);
          const clamped = clampCameraToUnlocked(
            cameraRef.current.x + panDx * speed,
            cameraRef.current.y + panDy * speed,
            cameraRef.current.x,
            cameraRef.current.y,
            curSnap.worldSpec
          );
          cameraRef.current.x = clamped.x;
          cameraRef.current.y = clamped.y;
          if (followRef.current) setFollowMode(false);
        } else if (followRef.current) {
          const target = curSnap.entities.find((e) => e.id === curSnap.selectedEntityId)
            || curSnap.entities[0];
          if (target && !target.interiorId) {
            const clamped = clampCameraToUnlocked(
              cameraRef.current.x + (target.x - cameraRef.current.x) * 0.22,
              cameraRef.current.y + (target.y - cameraRef.current.y) * 0.22,
              cameraRef.current.x,
              cameraRef.current.y,
              curSnap.worldSpec
            );
            cameraRef.current.x = clamped.x;
            cameraRef.current.y = clamped.y;
          }
        }
      }

      renderWorldCanvas(canvasRef.current, curSnap, tickRef.current, cameraRef.current, {
        hovered: hoveredRef.current,
        selectedEntityId: curSnap.selectedEntityId,
        showLabels: showLabelsRef.current
      });
      if (miniRadarRef.current && !curSnap.activeInterior) {
        renderMinimapCanvas(miniRadarRef.current, curSnap, cameraRef.current);
      }
      if (atlasRadarRef.current) {
        renderMinimapCanvas(atlasRadarRef.current, curSnap, cameraRef.current);
      }
    }, 40);

    return () => {
      alive = false;
      runtime.setViewVisible(false);
      if (ro) ro.disconnect();
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', syncVisibility);
      }
      clearInterval(timer);
    };
  }, [runtime]);

  // Keyboard listener for WASD / Arrow panning + Esc to close dropdown or exit interior
  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.key === 'Escape') {
        setBiomeMenuOpen(false);
        if (runtime.getSnapshot().activeInterior) {
          runtime.exitBuilding();
          sound.playDoor(false);
        }
      }
      const tag = ev.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) {
        keysRef.current.add(ev.code);
      }
    };
    const onKeyUp = (ev) => {
      keysRef.current.delete(ev.code);
    };
    const onDocDown = (ev) => {
      if (biomeDropdownWrapRef.current && !biomeDropdownWrapRef.current.contains(ev.target)) {
        setBiomeMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onDocDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousedown', onDocDown);
    };
  }, [runtime]);

  useEffect(() => {
    renderWorldCanvas(canvasRef.current, snap, tickRef.current, cameraRef.current, {
      hovered: hoveredRef.current,
      selectedEntityId: snap.selectedEntityId,
      showLabels
    });
  }, [snap, spritesReady, zoom, showLabels]);

  const jumpToSector = (sector) => {
    setBiomeMenuOpen(false);
    if (!sector.unlocked) {
      setActiveTab('packs');
      setUiHidden(false);
      return;
    }
    if (snap.activeInterior) {
      runtime.exitBuilding();
      sound.playDoor(false);
    }
    setFollowMode(false);
    cameraRef.current.x = sector.bounds.centerX;
    cameraRef.current.y = sector.bounds.centerY;
    runtime.focusSector(sector.id);
  };

  const panToWorldPoint = (wx, wy) => {
    if (snap.activeInterior) {
      runtime.exitBuilding();
      sound.playDoor(false);
    }
    const clamped = clampCameraToUnlocked(wx, wy, cameraRef.current.x, cameraRef.current.y, snap.worldSpec);
    setFollowMode(false);
    cameraRef.current.x = clamped.x;
    cameraRef.current.y = clamped.y;
    const sec = sectorAtTile(clamped.x, clamped.y);
    if (sec) runtime.focusSector(sec.id);
  };

  const handleRadarClick = (ev, canvasEl) => {
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const wx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * WORLD_TILES;
    const wy = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * WORLD_TILES;
    panToWorldPoint(wx, wy);
  };

  const stepZoom = (delta) => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    const baseIdx = idx >= 0 ? idx : 2;
    const nextIdx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, baseIdx + delta));
    setZoom(ZOOM_LEVELS[nextIdx]);
  };

  const toggleTab = (tabId) => {
    setUiHidden(false);
    setActiveTab((prev) => (prev === tabId ? null : tabId));
  };

  const centerOnSelected = () => {
    if (!selected) return;
    if (snap.activeInterior && selected.interiorId) return;
    if (snap.activeInterior) {
      runtime.exitBuilding();
      sound.playDoor(false);
    }
    setFollowMode(true);
    const clamped = clampCameraToUnlocked(selected.x, selected.y, cameraRef.current.x, cameraRef.current.y, snap.worldSpec);
    cameraRef.current.x = clamped.x;
    cameraRef.current.y = clamped.y;
    runtime.focusSector(selected.sectorId);
  };

  const openCitizenChat = async (resident) => {
    sound.playClick();
    if (!resident) return;
    if (typeof host?.navigate !== 'function') {
      const ok = runtime.triggerSocialEncounter(resident.id);
      if (ok) sound.playSocial();
      return;
    }
    let targetRoute = '/';
    try {
      if (typeof host.profileRoutes === 'function' && resident.profileKey) {
        const routes = await host.profileRoutes();
        if (Array.isArray(routes)) {
          const match = routes.find((r) =>
            (typeof r === 'string' && r.includes(resident.profileKey))
            || (r && (r.profile === resident.profileKey || r.name === resident.profileKey))
          );
          if (match) {
            targetRoute = typeof match === 'string' ? match : (match.path || match.route || '/');
          }
        }
      }
    } catch {}
    host.navigate(targetRoute);
  };

  // Canvas interaction handlers
  const handleMouseDown = (ev) => {
    if (ev.button !== 0) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: ev.clientX,
      startY: ev.clientY,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y
    };
    setCursorClass('dragging');
  };

  const handleMouseMove = (ev) => {
    const drag = dragRef.current;
    if (drag.active) {
      if (snap.activeInterior) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        if (followRef.current) setFollowMode(false);
        const z = cameraRef.current.zoom || 1;
        const clamped = clampCameraToUnlocked(
          drag.camX - dx / (TILE_SIZE * z),
          drag.camY - dy / (TILE_SIZE * z),
          cameraRef.current.x,
          cameraRef.current.y,
          snap.worldSpec
        );
        cameraRef.current.x = clamped.x;
        cameraRef.current.y = clamped.y;
      }
      return;
    }
    const hit = hitTestWorld(snap, cameraRef.current, canvasRef.current, ev.clientX, ev.clientY);
    hoveredRef.current = hit;
    setCursorClass(hit && (hit.kind === 'entity' || hit.kind === 'station' || hit.kind === 'building' || hit.kind === 'exit_interior') ? 'pointer' : '');
    const hKey = !hit
      ? ''
      : hit.kind === 'building'
        ? `b:${hit.building.id}`
        : hit.kind === 'station'
          ? `s:${hit.station.id}`
          : hit.kind === 'entity'
            ? `e:${hit.entity.id}`
            : hit.kind;
    if (hKey !== lastHoverKeyRef.current) {
      lastHoverKeyRef.current = hKey;
      if (hit?.kind === 'building') {
        setHoverSummary(`🏛 ${hit.building.name} — Click to enter interior`);
      } else if (hit?.kind === 'station') {
        setHoverSummary(`📍 ${hit.station.label} (${hit.station.kind}) — Click to send ${selected?.name || 'citizen'}`);
      } else if (hit?.kind === 'entity') {
        setHoverSummary(`👤 ${hit.entity.name} — ${hit.entity.statusLabel}`);
      } else if (hit?.kind === 'exit_interior') {
        setHoverSummary('🚪 Doorway — Click or press Esc to step outside');
      } else {
        setHoverSummary(null);
      }
    }
  };

  const handleMouseUp = (ev) => {
    const drag = dragRef.current;
    const wasDrag = drag.moved;
    drag.active = false;
    setCursorClass('');
    if (wasDrag || ev.button !== 0) return;

    const hit = hitTestWorld(snap, cameraRef.current, canvasRef.current, ev.clientX, ev.clientY);
    if (!hit) return;
    if (hit.kind === 'entity') {
      sound.playClick();
      runtime.selectEntity(hit.entity.id);
    } else if (hit.kind === 'exit_interior') {
      runtime.exitBuilding();
      sound.playDoor(false);
    } else if (hit.kind === 'station' && selected) {
      sound.playClick();
      runtime.sendResidentToStation(selected.id, hit.station.id);
    } else if (hit.kind === 'building') {
      if (runtime.enterBuilding(hit.building.id)) {
        sound.playDoor(true);
      }
    }
  };

  const handleDoubleOrContextWalk = (ev) => {
    ev.preventDefault();
    const hit = hitTestWorld(snap, cameraRef.current, canvasRef.current, ev.clientX, ev.clientY);
    if (!hit) return;
    if (hit.kind === 'exit_interior') {
      runtime.exitBuilding();
      sound.playDoor(false);
      return;
    }
    if (hit.kind === 'building' && ev.type === 'dblclick') {
      if (runtime.enterBuilding(hit.building.id)) {
        sound.playDoor(true);
      }
      return;
    }
    if (!selected) return;
    sound.playClick();
    if (hit.kind === 'station') {
      runtime.sendResidentToStation(selected.id, hit.station.id);
    } else {
      runtime.sendResidentToTile(selected.id, hit.tileX, hit.tileY);
    }
  };

  const handleWheel = (ev) => {
    if (ev.cancelable) ev.preventDefault();
    stepZoom(ev.deltaY < 0 ? 1 : -1);
  };

  const cameraSector = sectorAtTile(cameraRef.current.x, cameraRef.current.y);
  const currentSectorObj = snap.worldSpec.sectors.find((s) => s.id === cameraSector.id)
    || snap.worldSpec.sectors.find((s) => s.id === snap.cameraSectorId)
    || snap.worldSpec.sectors[4];

  const randomizeLook = (residentId) => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    runtime.updateResident(residentId, {
      appearance: {
        body: pick(avatarOpts.bodies),
        eyes: pick(avatarOpts.eyes),
        outfit: pick(avatarOpts.outfits),
        hair: pick(avatarOpts.hairs),
        accessory: pick(avatarOpts.accessories)
      }
    });
  };

  const nearbyBuilding = useMemo(() => {
    if (!selected || selected.interiorId || snap.activeInterior) return null;
    let best = null;
    let bestDist = Infinity;
    for (const b of getSectorBuildings(selected.sectorId)) {
      const d = Math.hypot(selected.x - (b.x + b.w / 2), selected.y - (b.y + b.h));
      if (d <= 5.5 && d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best;
  }, [selected?.id, selected?.x, selected?.y, selected?.sectorId, selected?.interiorId, snap.activeInterior]);

  return h('div', { className: 'oikos-shell' },
    h('style', null, oikosStyles),

    // 44px Non-Crowding Top Menu Bar
    h('header', { className: 'oikos-menubar' },
      h('div', { className: 'oikos-menu-group', ref: biomeDropdownWrapRef },
        h('button', {
          type: 'button',
          className: `oikos-btn ${biomeMenuOpen ? 'active' : ''}`,
          onClick: () => setBiomeMenuOpen((v) => !v),
          title: 'Switch District / Biome Sector'
        }, `❖ ${currentSectorObj.name.split(' ')[0]} · ${snap.schedulePhase?.label || '☀️ Day'} ▾`),

        biomeMenuOpen && h('div', { className: 'oikos-dropdown' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 } },
            h('strong', null, 'World Districts (384×384 Grid)'),
            h('span', { className: 'oikos-muted' }, `${unlockedSectors.length}/9 unlocked`)
          ),
          h('div', { className: 'oikos-dropdown-grid' },
            orderedSectors.map((s) => {
              const count = snap.entities.filter((e) => e.sectorId === s.id).length;
              return h('button', {
                key: s.id,
                type: 'button',
                className: `oikos-biome-tile ${currentSectorObj.id === s.id ? 'active' : ''} ${s.unlocked ? '' : 'locked'}`,
                onClick: () => jumpToSector(s)
              },
                h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' } },
                  h('span', { style: { fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 } },
                    h('span', { style: { width: 7, height: 7, borderRadius: 2, background: s.accentColor } }),
                    s.name.split(' ')[0]
                  ),
                  h('span', { className: 'oikos-muted' }, s.unlocked ? `${count}👤` : '🔒')
                ),
                h('span', { className: 'oikos-muted', style: { fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' } },
                  s.name
                )
              );
            })
          )
        ),

        snap.activeInterior && h('button', {
          type: 'button',
          className: 'oikos-btn primary',
          onClick: () => {
            runtime.exitBuilding();
            sound.playDoor(false);
          },
          title: 'Step back outside (Esc)'
        }, `🚪 Exit ${snap.activeInterior.shortName}`),

        h('div', { className: 'oikos-segmented' },
          h('button', { type: 'button', className: 'oikos-btn icon', style: { border: 0 }, onClick: () => stepZoom(-1), title: 'Zoom Out' }, '−'),
          h('span', { style: { fontSize: 11, padding: '0 4px', minWidth: 38, textAlign: 'center' } }, `${Math.round(zoom * 100)}%`),
          h('button', { type: 'button', className: 'oikos-btn icon', style: { border: 0 }, onClick: () => stepZoom(1), title: 'Zoom In' }, '+')
        ),

        h('div', { className: 'oikos-segmented' },
          h('button', {
            type: 'button',
            className: 'oikos-btn icon',
            style: { border: 0 },
            'aria-pressed': snap.paused,
            onClick: () => {
              sound.playClick();
              runtime.setPaused(!snap.paused);
            },
            title: snap.paused ? 'Resume Simulation' : 'Pause Simulation'
          }, snap.paused ? '▶' : '⏸'),
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0, minWidth: 34 },
            onClick: () => {
              sound.playClick();
              const speeds = [1, 2, 4];
              const next = speeds[(speeds.indexOf(snap.simSpeed || 1) + 1) % speeds.length];
              runtime.setSimSpeed(next);
            },
            title: 'Cycle Simulation Speed (1× / 2× / 4×)'
          }, `${snap.simSpeed || 1}×`),
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0 },
            onClick: () => {
              sound.playClick();
              const modes = ['auto', 'day', 'dusk', 'night'];
              const next = modes[(modes.indexOf(snap.timeMode) + 1) % modes.length];
              runtime.setTimeMode(next);
            },
            title: 'Cycle Solar Lighting'
          }, `☀ ${snap.timeMode}`),
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0 },
            onClick: () => {
              const current = snap.weather || 'clear';
              const next = WEATHER_MODES[(WEATHER_MODES.indexOf(current) + 1) % WEATHER_MODES.length];
              runtime.setWeather(next);
              sound.playWeatherShift(next);
            },
            title: 'Cycle Dynamic Town Weather (clear / rain / mist / breeze)'
          }, `${({ clear: '☀️', rain: '🌧️', mist: '🌫️', breeze: '🍃' }[snap.weather || 'clear']) || '☀️'} ${snap.weather || 'clear'}`)
        ),

        h('div', { className: 'oikos-segmented' },
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0 },
            'aria-pressed': followMode,
            onClick: () => {
              const next = !followMode;
              setFollowMode(next);
              if (next && selected && !snap.activeInterior) {
                cameraRef.current.x = selected.x;
                cameraRef.current.y = selected.y;
              }
            },
            title: 'Follow Selected Citizen or Free Camera'
          }, followMode ? '🎯 Follow' : '🖐 Free'),
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0 },
            'aria-pressed': showLabels,
            onClick: () => {
              sound.playClick();
              setShowLabels((v) => !v);
            },
            title: 'Toggle Always-On Station & Door Labels'
          }, '🏷'),
          h('button', {
            type: 'button',
            className: 'oikos-btn icon',
            style: { border: 0 },
            'aria-pressed': !soundMuted,
            onClick: () => {
              const muted = sound.toggleMute();
              setSoundMuted(muted);
              if (!muted) sound.playClick();
            },
            title: soundMuted ? 'Enable Procedural Sound' : 'Mute Sound'
          }, soundMuted ? '🔇' : '🔊')
        )
      ),

      h('div', { className: 'oikos-menu-group' },
        h('div', { className: 'oikos-segmented' },
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0 },
            'aria-pressed': !uiHidden && activeTab === 'citizens',
            onClick: () => toggleTab('citizens')
          }, `👥 Citizens (${residents.length})`),
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0 },
            'aria-pressed': !uiHidden && activeTab === 'atlas',
            onClick: () => toggleTab('atlas')
          }, `🗺 Atlas (${unlockedSectors.length}/9)`),
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0 },
            'aria-pressed': !uiHidden && activeTab === 'packs',
            onClick: () => toggleTab('packs')
          }, '📦 Packs'),
          h('button', {
            type: 'button',
            className: 'oikos-btn',
            style: { border: 0 },
            'aria-pressed': !uiHidden && activeTab === 'chronicle',
            onClick: () => toggleTab('chronicle')
          }, '📜 Chronicle')
        ),
        h('button', {
          type: 'button',
          className: 'oikos-btn',
          'aria-pressed': uiHidden,
          onClick: () => setUiHidden((v) => !v),
          title: 'Collapse Side Drawer & Minimize HUD'
        }, uiHidden ? '⤡ Show UI' : '⤢ Hide UI')
      )
    ),

    // Full-Bleed Playable Stage
    h('div', { className: 'oikos-stage', ref: stageRef },
      h('div', { className: 'oikos-viewport' },
        h('canvas', {
          ref: canvasRef,
          className: cursorClass,
          onMouseDown: handleMouseDown,
          onMouseMove: handleMouseMove,
          onMouseUp: handleMouseUp,
          onMouseLeave: () => {
            dragRef.current.active = false;
            hoveredRef.current = null;
            lastHoverKeyRef.current = '';
            setHoverSummary(null);
            setCursorClass('');
          },
          onDoubleClick: handleDoubleOrContextWalk,
          onContextMenu: handleDoubleOrContextWalk,
          onWheel: handleWheel
        })
      ),

      // Collapsible Slide-Over Right Drawer (only active tab rendered)
      !uiHidden && activeTab && h('aside', { className: 'oikos-drawer' },
        h('div', { className: 'oikos-drawer-header' },
          h('span', null,
            activeTab === 'citizens' ? 'Citizens & Avatar Studio'
              : activeTab === 'atlas' ? 'World Atlas & Districts'
                : activeTab === 'packs' ? 'Expansion & Seasonal Packs'
                  : 'Habitat Chronicle & Mind'
          ),
          h('button', {
            type: 'button',
            className: 'oikos-btn icon',
            onClick: () => setActiveTab(null),
            title: 'Close Drawer'
          }, '✕')
        ),

        h('div', { className: 'oikos-drawer-body' },
          // CITIZENS TAB (Selected Citizen Hero Inspector pinned at top + Compact Roster below)
          activeTab === 'citizens' && h(React.Fragment, null,
            selected && h('div', { className: 'oikos-card oikos-hero-card' },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                h('strong', { style: { fontSize: 12.5, color: '#fef08a' } }, `${selected.name} · Active Inspector`),
                h('div', { style: { display: 'flex', gap: 4 } },
                  h('button', {
                    type: 'button',
                    className: 'oikos-btn',
                    onClick: centerOnSelected,
                    title: 'Focus camera on selected citizen'
                  }, '🎯'),
                  h('button', {
                    type: 'button',
                    className: 'oikos-btn',
                    onClick: () => setEditing((v) => !v)
                  }, editing ? 'Done' : 'Customize'),
                  residents.length > 1 && h('button', {
                    type: 'button',
                    className: 'oikos-btn',
                    onClick: () => runtime.removeResident(selected.id)
                  }, 'Remove')
                )
              ),

              !editing && (() => {
                const stationPool = (snap.activeInterior && selected.interiorId === snap.activeInterior.id)
                  ? snap.activeInterior.stations
                  : snap.worldSpec.stations;
                return h('div', { style: { display: 'flex', gap: 4, alignItems: 'center' } },
                  h('select', {
                    className: 'oikos-field',
                    value: '',
                    onChange: (ev) => {
                      if (ev.target.value) {
                        sound.playClick();
                        runtime.sendResidentToStation(selected.id, ev.target.value);
                      }
                    }
                  },
                    h('option', { value: '' }, '📍 Walk / Transit to Station...'),
                    stationPool.map((st) =>
                      h('option', { key: st.id, value: st.id }, st.sectorId ? `${st.sectorId}: ${st.label}` : st.label)
                    )
                  )
                );
              })(),

              !editing
                ? h(React.Fragment, null,
                    h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
                      h(AvatarPreview, { appearance: selected.appearance, entityId: selected.id, tick: tickView, width: 56, height: 84 }),
                      h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 } },
                        h('div', null, selected.persona),
                        h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 } },
                          h('span', { className: 'oikos-pill' }, `★ ${selected.title || 'Lv.1 Citizen'}`),
                          h('span', { className: 'oikos-pill' }, `🪙 ${selected.coins ?? 25}`),
                          h('span', { className: 'oikos-pill' }, snap.schedulePhase?.label || '☀️ Deep Work'),
                          h('span', { className: 'oikos-muted' }, `Home: ${selected.homeSectorId} · 🏠 ${selected.homeBuildingName || 'Residence'} · ${selected.preferredKind}`),
                          selected.homeBuildingId && h('button', {
                            type: 'button',
                            className: 'oikos-btn',
                            style: { height: 22, fontSize: 10.5, padding: '0 6px' },
                            onClick: () => {
                              if (runtime.sendResidentInsideBuilding(selected.id, selected.homeBuildingId)) {
                                sound.playDoor(true);
                              }
                            },
                            title: `Send ${selected.name} indoors to ${selected.homeBuildingName || 'residence'}`
                          }, '🏠 Visit Indoor'),
                          selected.homeBuildingId && h('button', {
                            type: 'button',
                            className: 'oikos-btn primary',
                            style: { height: 22, fontSize: 10.5, padding: '0 6px' },
                            onClick: () => {
                              if (runtime.enterBuilding(selected.homeBuildingId)) {
                                sound.playDoor(true);
                              }
                            },
                            title: `Step inside ${selected.homeBuildingName || 'residence'} (${selected.homeLayoutStyle || 'Custom Home'})`
                          }, '🚪 Enter Home')
                        ),
                        Array.isArray(selected.learnedTraits) && selected.learnedTraits.length > 0 && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
                          selected.learnedTraits.map((trait) =>
                            h('span', {
                              key: trait,
                              className: 'oikos-pill',
                              style: { color: '#fde68a', borderColor: 'rgba(250, 204, 21, 0.35)' }
                            }, `⚡ ${trait}`)
                          )
                        ),
                        Array.isArray(selected.dailyAgenda) && selected.dailyAgenda.length > 0 && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
                          selected.dailyAgenda.map((step, idx) =>
                            h('button', {
                              key: `${step.phase}_${idx}`,
                              type: 'button',
                              className: 'oikos-btn',
                              style: {
                                height: 20,
                                fontSize: 10,
                                padding: '0 6px',
                                borderColor: step.done ? 'rgba(52, 211, 153, 0.5)' : 'rgba(148, 163, 184, 0.28)',
                                color: step.done ? '#6ee7b7' : '#cbd5e1'
                              },
                              onClick: () => {
                                sound.playClick();
                                runtime.sendResidentToStation(selected.id, step.stationId);
                              },
                              title: `${step.label} (click to route)`
                            }, `${step.done ? '✓' : '•'} ${step.phase}: ${step.stationLabel.slice(0, 14)}`)
                          )
                        ),
                        ...((selected.memoryStream?.length ? selected.memoryStream.slice(-2) : (selected.memories || []).slice(-2)).length
                          ? (selected.memoryStream?.length
                              ? selected.memoryStream.slice(-2).map((m, idx) =>
                                  h('div', { key: idx, className: 'oikos-muted' }, `${m.kind === 'reflection' ? '💭' : m.kind === 'hermes' ? '⚡' : '•'} ${m.text}`)
                                )
                              : selected.memories.slice(-2).map((m, idx) =>
                                  h('div', { key: idx, className: 'oikos-muted' }, `• ${m}`)
                                ))
                          : [h('div', { key: 'none', className: 'oikos-muted' }, 'No memories yet.')])
                      )
                    ),

                    // Inventory Chips (Use consumables / carry gear)
                    Array.isArray(selected.inventory) && selected.inventory.length > 0 && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
                      selected.inventory.map((itemId, idx) => {
                        const item = ITEM_CATALOG[itemId];
                        if (!item) return null;
                        return h('button', {
                          key: `${itemId}_${idx}`,
                          type: 'button',
                          className: 'oikos-btn',
                          style: { height: 22, fontSize: 10.5, padding: '0 6px' },
                          onClick: () => {
                            sound.playClick();
                            runtime.useResidentItem(selected.id, itemId);
                          },
                          title: item.consumable ? `Use ${item.name}` : `${item.name} (passive gear)`
                        }, `${item.icon} ${item.name}`);
                      })
                    ),

                    // 4 Vitality Bars
                    h('div', { className: 'oikos-stat-grid' },
                      ...[
                        ['Energy', selected.stats?.energy ?? 80, '#34d399'],
                        ['Focus', selected.stats?.focus ?? 75, '#38bdf8'],
                        ['Social', selected.stats?.social ?? 70, '#f472b6'],
                        ['Inspiration', selected.stats?.inspiration ?? 65, '#fbbf24']
                      ].map(([lbl, val, color]) =>
                        h('div', { key: lbl, className: 'oikos-stat-row' },
                          h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                            h('span', { className: 'oikos-muted', style: { fontSize: 10 } }, lbl),
                            h('span', null, `${Math.round(val)}`)
                          ),
                          h('div', { className: 'oikos-bar-track' },
                            h('div', { className: 'oikos-bar-fill', style: { width: `${Math.max(4, Math.min(100, Math.round(val)))}%`, background: color } })
                          )
                        )
                      )
                    ),

                    // Top Relationships & Social / Craft / Gather / Chat actions
                    (() => {
                      const relEntries = Object.entries(selected.relationships || {})
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3);
                      return relEntries.length > 0 && h('div', { className: 'oikos-rel-list' },
                        relEntries.map(([otherId, score]) => {
                          const partner = snap.entities.find((e) => e.id === otherId);
                          const t = getRelationshipTier(score);
                          return h('span', {
                            key: otherId,
                            className: 'oikos-pill',
                            title: `${t.tier} (×${t.bonus.toFixed(2)} co-work bonus)`
                          },
                            `${t.icon} ${partner?.name || otherId} · ${t.tier} ${Math.round(score)}`
                          );
                        })
                      );
                    })(),

                    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 2 } },
                      h('button', {
                        type: 'button',
                        className: 'oikos-btn',
                        onClick: () => {
                          const ok = runtime.triggerSocialEncounter(selected.id);
                          if (ok) sound.playSocial();
                        },
                        title: 'Greet nearest citizen to boost Social & bond'
                      }, '👋 Mingle'),
                      h('button', {
                        type: 'button',
                        className: 'oikos-btn primary',
                        onClick: () => openCitizenChat(selected),
                        title: 'Open chat with this citizen profile in Hermes'
                      }, '💬 Chat'),
                      h('button', {
                        type: 'button',
                        className: 'oikos-btn',
                        onClick: () => {
                          const crafted = runtime.craftResidentItem(selected.id);
                          if (crafted) sound.playCraft();
                        },
                        title: `Synthesize item from inventory or coins (${CRAFT_RECIPES.map((r) => r.name).join(' / ')})`
                      }, '⚒️ Craft'),
                      h('button', {
                        type: 'button',
                        className: 'oikos-btn',
                        onClick: () => {
                          const g = runtime.startGathering({ hostId: selected.id });
                          if (g) sound.playGathering();
                        },
                        title: 'Host a Town Gathering & spread invitations'
                      }, '🎉 Gather')
                    ),

                    // In-World Direct Citizen Chat (Ask without leaving Oikos)
                    h('form', {
                      style: { display: 'flex', gap: 4, marginTop: 2 },
                      onSubmit: (ev) => {
                        ev.preventDefault();
                        if (!chatDraft.trim()) return;
                        const conv = runtime.chatWithResident(selected.id, chatDraft);
                        if (conv) {
                          sound.playChatReply();
                          setLastChatReply({ residentId: selected.id, lines: conv.turns.slice(1).map((t) => t.line) });
                          setChatDraft('');
                        }
                      }
                    },
                      h('input', {
                        type: 'text',
                        className: 'oikos-field',
                        placeholder: `💬 Ask ${selected.name}...`,
                        value: chatDraft,
                        maxLength: 120,
                        onChange: (ev) => setChatDraft(ev.target.value)
                      }),
                      h('button', {
                        type: 'submit',
                        className: 'oikos-btn primary',
                        title: `Talk directly with ${selected.name}`
                      }, 'Send')
                    ),
                    lastChatReply && lastChatReply.residentId === selected.id && h('div', {
                      style: {
                        fontSize: 11,
                        color: '#bae6fd',
                        background: 'rgba(14, 116, 144, 0.16)',
                        border: '1px solid rgba(56, 189, 248, 0.28)',
                        borderRadius: 6,
                        padding: '4px 6px'
                      }
                    }, lastChatReply.lines.join(' ')),

                    // World-to-Hermes Station Task Dispatch
                    h('div', { style: { display: 'flex', gap: 4, marginTop: 2 } },
                      h('input', {
                        type: 'text',
                        className: 'oikos-field',
                        placeholder: 'Assign task at station...',
                        value: taskDraft,
                        maxLength: 100,
                        onChange: (ev) => setTaskDraft(ev.target.value)
                      }),
                      h('select', {
                        className: 'oikos-field',
                        style: { width: 108, flex: 'none' },
                        value: taskStationId || selected.targetStationId || snap.worldSpec.stations[0]?.id || '',
                        onChange: (ev) => setTaskStationId(ev.target.value),
                        title: 'Select station for task'
                      },
                        snap.worldSpec.stations.map((st) =>
                          h('option', { key: st.id, value: st.id }, st.label)
                        )
                      ),
                      h('button', {
                        type: 'button',
                        className: 'oikos-btn',
                        onClick: () => {
                          const targetStId = taskStationId || selected.targetStationId || snap.worldSpec.stations[0]?.id;
                          if (!targetStId) return;
                          sound.playClick();
                          runtime.dispatchStationTask(selected.id, targetStId, taskDraft || undefined);
                          setTaskDraft('');
                        },
                        title: 'Route citizen to station & pin work artifact'
                      }, '📋 Dispatch')
                    )
                  )
                : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                    h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
                      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' } },
                        h(AvatarPreview, { appearance: selected.appearance, entityId: selected.id, tick: tickView, width: 64, height: 96 }),
                        h('button', {
                          type: 'button',
                          className: 'oikos-btn',
                          onClick: () => randomizeLook(selected.id)
                        }, '🎲 Random')
                      ),
                      h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 } },
                        ...[
                          ['Body', 'body', avatarOpts.bodies],
                          ['Eyes', 'eyes', avatarOpts.eyes],
                          ['Outfit', 'outfit', avatarOpts.outfits],
                          ['Hair', 'hair', avatarOpts.hairs],
                          ['Acc.', 'accessory', avatarOpts.accessories]
                        ].map(([lbl, key, list]) =>
                          h('div', { key, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 } },
                            h('span', { className: 'oikos-muted' }, lbl),
                            h('div', { style: { display: 'flex', gap: 3, alignItems: 'center' } },
                              h('button', {
                                type: 'button',
                                className: 'oikos-btn icon',
                                onClick: () => runtime.updateResident(selected.id, {
                                  appearance: { [key]: cycleOption(list, selected.appearance?.[key], -1) }
                                })
                              }, '<'),
                              h('span', { style: { fontSize: 10.5, minWidth: 74, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                                formatLayerLabel(selected.appearance?.[key] || list[0])
                              ),
                              h('button', {
                                type: 'button',
                                className: 'oikos-btn icon',
                                onClick: () => runtime.updateResident(selected.id, {
                                  appearance: { [key]: cycleOption(list, selected.appearance?.[key], 1) }
                                })
                              }, '>')
                            )
                          )
                        )
                      )
                    ),
                    h('label', { className: 'oikos-label' }, 'Name',
                      h('input', {
                        type: 'text',
                        className: 'oikos-field',
                        value: selected.name,
                        maxLength: 24,
                        onChange: (ev) => runtime.updateResident(selected.id, { name: ev.target.value })
                      })
                    ),
                    h('label', { className: 'oikos-label' }, 'Persona Bio / Voice',
                      h('textarea', {
                        rows: 2,
                        className: 'oikos-field',
                        value: selected.persona,
                        maxLength: 200,
                        onChange: (ev) => runtime.updateResident(selected.id, { persona: ev.target.value })
                      })
                    ),
                    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 } },
                      h('label', { className: 'oikos-label' }, 'Home District',
                        h('select', {
                          className: 'oikos-field',
                          value: selected.homeSectorId,
                          onChange: (ev) => runtime.updateResident(selected.id, { homeSectorId: ev.target.value })
                        }, unlockedSectors.map((s) => h('option', { key: s.id, value: s.id }, s.name.split(' ')[0])))
                      ),
                      h('label', { className: 'oikos-label' }, 'Preferred Activity',
                        h('select', {
                          className: 'oikos-field',
                          value: selected.preferredKind,
                          onChange: (ev) => runtime.updateResident(selected.id, { preferredKind: ev.target.value })
                        }, ACTIVITY_KINDS.map((k) => h('option', { key: k, value: k }, k)))
                      )
                    ),
                    h('div', { className: 'oikos-label' }, 'Seeded / Episodic Memories',
                      ...(selected.memories || []).map((m, idx) =>
                        h('div', { key: idx, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 } },
                          h('span', null, `• ${m}`),
                          h('button', {
                            type: 'button',
                            className: 'oikos-btn icon',
                            onClick: () => runtime.updateResident(selected.id, {
                              memories: selected.memories.filter((_, i) => i !== idx)
                            })
                          }, '×')
                        )
                      ),
                      h('div', { style: { display: 'flex', gap: 4, marginTop: 2 } },
                        h('input', {
                          type: 'text',
                          className: 'oikos-field',
                          placeholder: 'Add starting memory...',
                          value: memDraft,
                          onChange: (ev) => setMemDraft(ev.target.value)
                        }),
                        h('button', {
                          type: 'button',
                          className: 'oikos-btn',
                          onClick: () => {
                            if (!memDraft.trim()) return;
                            runtime.updateResident(selected.id, {
                              memories: [...(selected.memories || []), memDraft.trim()]
                            });
                            setMemDraft('');
                          }
                        }, 'Add')
                      )
                    )
                  )
            ),

            // Compact Citizen Roster below active inspector
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 } },
              h('strong', { style: { fontSize: 11.5 } }, `All Citizens (${residents.length})`),
              h('button', {
                type: 'button',
                className: 'oikos-btn primary',
                style: { height: 24, fontSize: 11 },
                onClick: () => {
                  runtime.createResident({
                    name: `Citizen ${residents.length + 1}`,
                    homeSectorId: currentSectorObj.id
                  });
                  setEditing(true);
                  setFollowMode(true);
                }
              }, '+ New Citizen')
            ),
            h('div', { className: 'oikos-roster-list' },
              residents.map((r) => {
                const isSel = selected?.id === r.id;
                return h('div', {
                  key: r.id,
                  className: `oikos-roster-row ${isSel ? 'selected' : ''}`,
                  onClick: () => {
                    sound.playClick();
                    if (snap.activeInterior && r.interiorId !== snap.activeInterior.id) {
                      runtime.exitBuilding();
                      sound.playDoor(false);
                    }
                    runtime.selectEntity(r.id);
                    if (!r.interiorId) {
                      cameraRef.current.x = r.x;
                      cameraRef.current.y = r.y;
                    }
                  }
                },
                  h('div', { style: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 } },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                      h('span', { style: { width: 7, height: 7, borderRadius: 99, background: r.color || '#38bdf8', flex: 'none' } }),
                      h('strong', { style: { fontSize: 11.5 } }, r.name),
                      h('span', { className: 'oikos-pill' }, r.mood),
                      h('span', { className: 'oikos-pill' }, r.interiorId ? 'indoors' : r.sectorId)
                    ),
                    h('div', { className: 'oikos-muted', style: { fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                      `${r.statusLabel}${r.speech ? ` · "${r.speech}"` : ''}`
                    )
                  ),
                  h('button', {
                    type: 'button',
                    className: 'oikos-btn icon',
                    style: { height: 22, minWidth: 22, fontSize: 10.5 },
                    onClick: (ev) => {
                      ev.stopPropagation();
                      sound.playClick();
                      if (snap.activeInterior && r.interiorId !== snap.activeInterior.id) {
                        runtime.exitBuilding();
                        sound.playDoor(false);
                      }
                      runtime.selectEntity(r.id);
                      setFollowMode(true);
                      if (!r.interiorId) {
                        cameraRef.current.x = r.x;
                        cameraRef.current.y = r.y;
                      }
                    },
                    title: `Focus ${r.name}`
                  }, '🎯')
                );
              })
            )
          ),

          // ATLAS TAB
          activeTab === 'atlas' && h(React.Fragment, null,
            h('div', { className: 'oikos-card', style: { alignItems: 'center' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 11 } },
                h('strong', null, '3×3 World Radar (Click to pan)'),
                h('span', { className: 'oikos-muted' }, `${Math.round(cameraRef.current.x)}, ${Math.round(cameraRef.current.y)}`)
              ),
              h('canvas', {
                ref: atlasRadarRef,
                width: 240,
                height: 240,
                className: 'oikos-radar',
                onClick: (ev) => handleRadarClick(ev, atlasRadarRef.current)
              })
            ),
            ...orderedSectors.map((s) => {
              const count = snap.entities.filter((e) => e.sectorId === s.id).length;
              return h('div', {
                key: s.id,
                className: `oikos-card ${currentSectorObj.id === s.id ? 'selected' : ''}`
              },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                  h('strong', { style: { fontSize: 12 } }, `${s.unlocked ? '' : '🔒 '}${s.name}`),
                  h('button', {
                    type: 'button',
                    className: 'oikos-btn',
                    onClick: () => jumpToSector(s)
                  }, 'Go')
                ),
                h('div', { className: 'oikos-muted' }, `${count} active · Pack: ${s.packId}`),
                s.unlocked && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
                  s.stations.map((st) =>
                    h('button', {
                      key: st.id,
                      type: 'button',
                      className: 'oikos-btn',
                      style: { height: 22, fontSize: 10.5, padding: '0 6px' },
                      onClick: () => {
                        panToWorldPoint(st.x, st.y);
                        if (selected) runtime.sendResidentToStation(selected.id, st.id);
                      }
                    }, `📍 ${st.label}`)
                  )
                )
              );
            })
          ),

          // PACKS TAB
          activeTab === 'packs' && h(React.Fragment, null,
            ...['core', 'expansion', 'seasonal'].map((kind) => {
              const items = snap.packs.filter((p) => p.kind === kind);
              return h('div', { key: kind, style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                h('strong', { style: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' } },
                  kind === 'core' ? 'Core Commons' : kind === 'expansion' ? 'Expansion Districts' : 'Seasonal Overlays'
                ),
                ...items.map((p) =>
                  h('div', { key: p.id, className: 'oikos-card' },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                      h('strong', { style: { fontSize: 12 } }, p.title),
                      p.kind === 'core'
                        ? h('span', { className: 'oikos-pill' }, 'Core')
                        : p.owned
                          ? h('button', {
                              type: 'button',
                              className: `oikos-btn ${p.enabled ? 'active' : ''}`,
                              onClick: () => runtime.setPackEnabled(p.id, !p.enabled)
                            }, p.enabled ? 'Disable' : 'Enable')
                          : h('button', {
                              type: 'button',
                              className: 'oikos-btn primary',
                              onClick: () => {
                                sound.playUnlock();
                                runtime.unlockPack(p.id);
                              }
                            }, 'Unlock')
                    ),
                    h('div', { className: 'oikos-muted' }, p.subtitle)
                  )
                )
              );
            }),
            h('div', { className: 'oikos-muted', style: { paddingTop: 4 } },
              'Oikos · Tiles & characters by LimeZu (limezu.itch.io)'
            )
          ),

          // CHRONICLE TAB
          activeTab === 'chronicle' && h(React.Fragment, null,
            (() => {
              const ms = snap.mindStats;
              const route = snap.mindRoute;
              const statusText = !ms.enabled
                ? 'Model mind: OFF · deterministic scheduler, no model calls'
                : ms.unsupported
                  ? 'Model mind: ON, but this Hermes has no llm.oneshot · deterministic'
                  : ms.lastSource === 'llm'
                    ? 'Model mind: ON · last step used the model'
                    : ms.lastError
                      ? `Model mind: ON · last call failed (${ms.lastError}) · deterministic`
                      : ms.lastSkip && ms.lastSkip !== 'disabled'
                        ? `Model mind: ON · skipped (${ms.lastSkip.replace(/_/g, ' ')}) · deterministic`
                        : 'Model mind: ON · no call yet';
              const presetRow = (label, key, values, fmt) => h('div', { style: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' } },
                h('span', { className: 'oikos-muted', style: { minWidth: 92 } }, label),
                ...values.map((v) => h('button', {
                  key: `${key}-${v}`,
                  type: 'button',
                  className: `oikos-btn ${ms[key] === v ? 'active' : ''}`,
                  style: { height: 22, padding: '0 8px', fontSize: 10.5 },
                  onClick: () => runtime.setMindBudget({ [key]: v })
                }, fmt(v)))
              );
              return h('div', { className: 'oikos-card' },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                  h('strong', { style: { fontSize: 12 } }, 'Resident Mind'),
                  h('span', { className: 'oikos-pill', title: `Requests sent to Hermes this clock hour, failed ones included; tokens this UTC day, estimated as characters ÷ ${ms.charsPerTokenEstimate} (Hermes reports no usage for llm.oneshot). ${ms.budgetScope === 'persisted' ? 'Counters are saved in Oikos storage and survive reloads.' : 'Counters reset when Oikos reloads.'}` },
                    ms.enabled
                      ? `${ms.callsThisHour}/${ms.maxCallsPerHour} requests/hr · ~${ms.tokensToday}/${ms.maxTokensPerDay} tok/day (est.)${ms.budgetScope === 'persisted' ? '' : ' · per session'}`
                      : `deterministic · every ${Math.round(snap.mindIntervalMs / 60000)}m`
                  )
                ),
                h('div', { className: 'oikos-muted', style: { fontSize: 11 } }, statusText),
                ms.enabled && ms.budgetScope !== 'persisted' && h('div', { className: 'oikos-muted', style: { fontSize: 11 } },
                  'No plugin storage: these limits reset when Oikos reloads.'),
                ms.enabled && ms.ledgerHealth && !['ok', 'runtime_only'].includes(ms.ledgerHealth) && h('div', { className: 'oikos-muted', style: { fontSize: 11 } },
                  ms.ledgerHealth === 'corrupt_assumed_spent'
                    ? 'Saved spend counters were unreadable, so this hour and day are treated as used up.'
                    : 'Spend counters could not be saved, so no request is sent.'),
                h('div', { style: { display: 'flex', gap: 6 } },
                  h('button', {
                    type: 'button',
                    className: 'oikos-btn primary',
                    onClick: () => runtime.runMindTick()
                  }, ms.enabled ? 'Step Mind Now (may call model)' : 'Step Mind Now'),
                  ms.enabled
                    ? h('button', {
                        type: 'button',
                        className: 'oikos-btn active',
                        onClick: () => { setMindConsentOpen(false); runtime.setMindEnabled(false); }
                      }, 'Turn model mind off')
                    : h('button', {
                        type: 'button',
                        className: 'oikos-btn',
                        onClick: () => setMindConsentOpen(!mindConsentOpen)
                      }, 'Use a model…')
                ),
                !ms.enabled && mindConsentOpen && h('div', { className: 'oikos-card', style: { borderColor: 'rgba(250, 204, 21, 0.45)', fontSize: 11 } },
                  h('strong', null, 'Let residents use a model? This can cost money.'),
                  h('div', null,
                    `Oikos will ask Hermes's ${route?.method || 'llm.oneshot'} for resident decisions about every ${Math.round(snap.mindIntervalMs / 60000)} minutes while this page is visible, and when you press Step Mind Now. ` +
                    `Hermes picks the model from the auxiliary task "${route?.task || 'oikos_mind'}" in your config; if you have not set one, Hermes uses its automatic choice, which can be your main (paid) model.`
                  ),
                  h('div', null,
                    `Sent, for up to ${ms.batchSize} residents per request: name (your Hermes profile names, or names you typed for citizens you created), the persona you typed for a citizen you created (Hermes profile descriptions are replaced by "Hermes profile resident"), title, home district, preferences, mood, needs, item ids, specialties, and up to 3 earlier notes the model itself wrote. Also: station ids, the time, the weather and a gathering's station id.`
                  ),
                  h('div', null,
                    'Never sent: what you type in chat with a resident, station tasks you assign, memories you type into a citizen, gathering titles, Hermes profile descriptions, and anything from your Hermes sessions (messages, tool names, files, commands). No session_id, so no chat session is involved.'
                  ),
                  h('div', null,
                    `Limits: ${ms.maxCallsPerHour} requests per clock hour, ~${ms.maxTokensPerDay} estimated tokens per UTC day, ${ms.maxTokensPerCall} reply tokens per request, one request at a time. ` +
                    (ms.budgetScope === 'persisted'
                      ? 'Spend is saved before each request and survives reloads; a failed or timed-out request still counts in full. If the counters cannot be saved, nothing is sent. '
                      : 'No plugin storage is available, so these limits reset when Oikos reloads. ') +
                    'These are Oikos\'s own estimated counters, not a billing cap enforced by Hermes or your provider. ' +
                    'Any failure falls back to the deterministic scheduler.'
                  ),
                  h('div', { style: { display: 'flex', gap: 6 } },
                    h('button', {
                      type: 'button',
                      className: 'oikos-btn primary',
                      onClick: () => { setMindConsentOpen(false); runtime.setMindEnabled(true); }
                    }, 'Enable model mind'),
                    h('button', {
                      type: 'button',
                      className: 'oikos-btn',
                      onClick: () => setMindConsentOpen(false)
                    }, 'Cancel')
                  )
                ),
                (ms.enabled || mindConsentOpen) && presetRow('Requests/hour', 'maxCallsPerHour', [2, 5, 10, 20], (v) => String(v)),
                (ms.enabled || mindConsentOpen) && presetRow('Tokens/day (est.)', 'maxTokensPerDay', [5000, 10000, 20000, 50000], (v) => `${v / 1000}k`)
              );
            })(),

            snap.activeGathering && h('div', { className: 'oikos-card', style: { borderColor: 'rgba(250, 204, 21, 0.4)' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                h('strong', { style: { fontSize: 12, color: '#fde68a' } }, `🎉 Active Town Gathering`),
                h('button', {
                  type: 'button',
                  className: 'oikos-btn',
                  style: { height: 22, padding: '0 8px', fontSize: 10.5 },
                  onClick: () => {
                    sound.playClick();
                    runtime.endGathering();
                  }
                }, 'End')
              ),
              h('div', { style: { fontSize: 11.5, color: '#f1f5f9' } }, snap.activeGathering.title),
              h('div', { className: 'oikos-muted' },
                `@ ${snap.activeGathering.stationLabel} (${snap.activeGathering.sectorId}) · Host: ${snap.activeGathering.hostName} · ${(snap.activeGathering.attendeeIds || []).length}/${(snap.activeGathering.invitedIds || []).length} joined`
              )
            ),

            h('div', { className: 'oikos-card' },
              h('strong', { style: { fontSize: 12 } }, `💬 Multi-Turn Citizen Conversations (${(snap.conversations || []).length})`),
              ...(snap.conversations && snap.conversations.length
                ? snap.conversations.slice(-4).reverse().map((conv) =>
                    h('div', { key: conv.id, style: { padding: '4px 0', borderBottom: '1px solid rgba(148,163,184,0.12)', fontSize: 11 } },
                      h('div', { style: { color: '#93c5fd', fontWeight: 600 } },
                        `${(conv.participants || []).join(' & ')} · ${conv.tier} (${conv.sectorId})`
                      ),
                      ...(conv.turns || []).map((turn, idx) =>
                        h('div', { key: idx, className: 'oikos-muted', style: { marginTop: 1 } },
                          `${turn.speaker}: ${turn.line}`
                        )
                      )
                    )
                  )
                : [h('div', { key: 'empty_conv', className: 'oikos-muted' }, 'Citizens record 3-turn contextual dialogues when mingling.')])
            ),

            h('div', { className: 'oikos-card' },
              h('strong', { style: { fontSize: 12 } }, '🏛️ District Civic Projects'),
              ...((snap.civicProjects || []).filter((p) => {
                const sec = snap.worldSpec.sectors.find((s) => s.id === p.sectorId);
                return !sec || sec.unlocked || p.completed;
              }).map((proj) => {
                const pct = Math.min(100, Math.round((proj.fundedCoins / Math.max(1, proj.goalCoins)) * 100));
                return h('div', { key: proj.id, style: { padding: '4px 0', borderBottom: '1px solid rgba(148,163,184,0.12)', fontSize: 11 } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                    h('strong', { style: { color: proj.completed ? '#6ee7b7' : '#f1f5f9' } },
                      `${proj.icon} ${proj.name} ${proj.completed ? '✓' : `(${proj.fundedCoins}/${proj.goalCoins} 🪙)`}`
                    ),
                    !proj.completed && selected && h('button', {
                      type: 'button',
                      className: 'oikos-btn',
                      style: { height: 22, padding: '0 6px', fontSize: 10.5 },
                      onClick: () => {
                        const res = runtime.contributeToCivicProject(selected.id, proj.id);
                        if (res) sound.playProjectContribute();
                      },
                      title: `${selected.name}: fund coins (+ required item if held)`
                    }, '🪙 Fund')
                  ),
                  h('div', { className: 'oikos-bar-track', style: { marginTop: 3 } },
                    h('div', { className: 'oikos-bar-fill', style: { width: `${proj.completed ? 100 : Math.max(4, pct)}%`, background: proj.completed ? '#34d399' : '#facc15' } })
                  ),
                  h('div', { className: 'oikos-muted', style: { marginTop: 2 } }, proj.buffLabel)
                );
              }))
            ),

            liveAgents.length > 0 && h('div', { className: 'oikos-card' },
              h('strong', { style: { fontSize: 12 } }, `Hermes Visitors (${liveAgents.length})`),
              ...liveAgents.map((a) =>
                h('div', { key: a.id, className: 'oikos-muted' }, `${a.name} — ${a.statusLabel} (${a.sectorId})`)
              )
            ),

            h('div', { className: 'oikos-card' },
              h('strong', { style: { fontSize: 12 } }, `📌 Pinned Station Artifacts (${(snap.artifacts || []).length})`),
              ...(snap.artifacts && snap.artifacts.length
                ? snap.artifacts.slice(-6).reverse().map((art) =>
                    h('div', { key: art.id, style: { fontSize: 11, color: '#cbd5e1', padding: '2px 0', borderBottom: '1px solid rgba(148,163,184,0.1)' } },
                      h('strong', { style: { color: '#fde68a' } }, `[${art.title}] `),
                      `${art.authorName}: ${art.deliverable || art.summary}`
                    )
                  )
                : [h('div', { key: 'empty_art', className: 'oikos-muted' }, 'Dispatch station tasks in Citizens tab to pin artifacts here.')])
            ),

            h('div', { className: 'oikos-card' },
              h('strong', { style: { fontSize: 12 } }, 'Habitat Chronicle'),
              ...(snap.chronicle && snap.chronicle.length
                ? snap.chronicle.slice(-16).reverse().map((c, idx) =>
                    h('div', { key: idx, style: { fontSize: 11, color: '#cbd5e1', padding: '2px 0', borderBottom: '1px solid rgba(148,163,184,0.1)' } },
                      `[${c.time}] ${c.text}`
                    )
                  )
                : [h('div', { key: 'empty_chron', className: 'oikos-muted' }, 'Your habitat chronicle fills as citizens live & explore.')])
            ),

            h('div', { className: 'oikos-muted' },
              'Oikos · Tiles & characters by LimeZu (limezu.itch.io)'
            )
          )
        )
      ),

      // Bottom Floating HUD (Mini Radar + Selected Citizen Context Pill; clears open right drawer)
      !uiHidden && h('div', { className: `oikos-bottom-hud ${activeTab ? 'drawer-open' : ''}` },
        !snap.activeInterior && h('div', { className: 'oikos-radar-box' },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 10.5 } },
            h('strong', null, radarOpen ? 'Radar (384×384)' : '🗺'),
            h('button', {
              type: 'button',
              className: 'oikos-btn icon',
              style: { height: 20, minWidth: 20, fontSize: 10 },
              onClick: () => setRadarOpen((v) => !v),
              title: radarOpen ? 'Minimize Radar' : 'Expand Radar'
            }, radarOpen ? '−' : '+')
          ),
          radarOpen && h('canvas', {
            ref: miniRadarRef,
            width: 88,
            height: 88,
            className: 'oikos-radar',
            onClick: (ev) => handleRadarClick(ev, miniRadarRef.current),
            title: 'Click anywhere to pan camera'
          })
        ),

        selected && h('div', { className: 'oikos-context-pill' },
          h(AvatarPreview, { appearance: selected.appearance, entityId: selected.id, tick: tickView, width: 34, height: 48 }),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' } },
              h('strong', null, selected.name),
              h('span', { className: 'oikos-pill' }, snap.activeInterior ? snap.activeInterior.shortName : selected.sectorId),
              h('div', { className: 'oikos-micro-bars', title: 'Energy · Focus · Social · Inspiration' },
                ...[
                  [selected.stats?.energy ?? 80, '#34d399'],
                  [selected.stats?.focus ?? 75, '#38bdf8'],
                  [selected.stats?.social ?? 70, '#f472b6'],
                  [selected.stats?.inspiration ?? 65, '#fbbf24']
                ].map(([v, col], idx) =>
                  h('div', { key: idx, className: 'oikos-micro-track' },
                    h('div', { className: 'oikos-micro-fill', style: { width: `${Math.max(5, Math.min(100, Math.round(v)))}%`, background: col } })
                  )
                )
              ),
              ...(selected.inventory || []).slice(0, 3).map((itemId, idx) => {
                const it = ITEM_CATALOG[itemId];
                return it ? h('span', { key: `${itemId}_${idx}`, title: it.name, style: { fontSize: 11 } }, it.icon) : null;
              }),
              h('span', { style: { fontSize: 11, color: '#fde68a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                selected.speech ? `"${selected.speech}"` : selected.statusLabel
              )
            ),
            h('div', { className: 'oikos-hint', style: hoverSummary ? { color: '#fef08a' } : undefined },
              hoverSummary || (snap.activeInterior
                ? 'Inside building · Click furniture station or Exit mat · Esc to step outside'
                : 'Click building to enter · Click station to visit · Double-click tile to walk · Drag / WASD to pan')
            )
          ),
          snap.activeInterior
            ? h('button', {
                type: 'button',
                className: 'oikos-btn primary',
                onClick: () => {
                  runtime.exitBuilding();
                  sound.playDoor(false);
                },
                title: 'Step outside (Esc)'
              }, `🚪 Exit`)
            : nearbyBuilding && h('button', {
                type: 'button',
                className: 'oikos-btn primary',
                onClick: () => {
                  if (runtime.enterBuilding(nearbyBuilding.id)) sound.playDoor(true);
                },
                title: `Step inside ${nearbyBuilding.name}`
              }, `🚪 Enter ${nearbyBuilding.shortName}`),
          !snap.activeInterior && h('button', {
            type: 'button',
            className: 'oikos-btn',
            onClick: centerOnSelected,
            title: 'Center camera on selected citizen'
          }, '🎯')
        )
      )
    )
  );
}
