// Clean Dark-Glass HUD, Collapsible Slide-Over Drawer & Playable Canvas Styles for Oikos.

export const oikosStyles = `
.oikos-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 460px;
  overflow: hidden;
  background: #070b14;
  color: var(--vscode-foreground, #e2e8f0);
  font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif);
  user-select: none;
  box-sizing: border-box;
}
.oikos-shell *, .oikos-shell *::before, .oikos-shell *::after {
  box-sizing: border-box;
}

/* 44px Non-Crowding Top Menu Bar */
.oikos-menubar {
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  background: rgba(11, 17, 32, 0.96);
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
  z-index: 30;
}
.oikos-menu-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  position: relative;
}
.oikos-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.oikos-btn:hover {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(148, 163, 184, 0.5);
}
.oikos-btn[aria-pressed="true"], .oikos-btn.active {
  background: rgba(250, 204, 21, 0.16);
  border-color: #facc15;
  color: #fef08a;
}
.oikos-btn.primary {
  background: rgba(14, 165, 233, 0.18);
  border-color: rgba(56, 189, 248, 0.55);
  color: #e0f2fe;
}
.oikos-btn.icon {
  padding: 0 7px;
  min-width: 26px;
  justify-content: center;
}
.oikos-segmented {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px;
  background: rgba(7, 11, 20, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 7px;
}

/* Biome Dropdown Popover (3x3 Sector Grid) */
.oikos-dropdown {
  position: absolute;
  top: 38px;
  left: 0;
  width: 440px;
  max-width: calc(100vw - 24px);
  padding: 10px;
  border-radius: 10px;
  background: rgba(11, 17, 32, 0.97);
  border: 1px solid rgba(250, 204, 21, 0.35);
  box-shadow: 0 12px 32px rgba(2, 6, 23, 0.85);
  backdrop-filter: blur(10px);
  z-index: 50;
}
.oikos-dropdown-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}
.oikos-biome-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 7px 8px;
  border-radius: 7px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}
.oikos-biome-tile:hover {
  border-color: rgba(148, 163, 184, 0.55);
  background: rgba(30, 41, 59, 0.9);
}
.oikos-biome-tile.active {
  border-color: #facc15;
  background: rgba(250, 204, 21, 0.14);
}
.oikos-biome-tile.locked {
  opacity: 0.62;
}

/* Playable Viewport & Stage */
.oikos-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}
.oikos-viewport {
  position: absolute;
  inset: 0;
  background: #070b14;
}
.oikos-viewport canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  cursor: grab;
}
.oikos-viewport canvas.dragging {
  cursor: grabbing;
}
.oikos-viewport canvas.pointer {
  cursor: pointer;
}

/* Slide-Over Right Drawer (340px) */
.oikos-drawer {
  position: absolute;
  top: 10px;
  right: 10px;
  bottom: 10px;
  width: 340px;
  max-width: calc(100% - 20px);
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  background: rgba(11, 17, 32, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.28);
  box-shadow: 0 14px 36px rgba(2, 6, 23, 0.82);
  backdrop-filter: blur(10px);
  z-index: 25;
  overflow: hidden;
}
.oikos-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 12px;
  font-weight: 700;
}
.oikos-drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.28) transparent;
}
.oikos-drawer-body::-webkit-scrollbar {
  width: 6px;
}
.oikos-drawer-body::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.28);
  border-radius: 999px;
}
.oikos-drawer-body::-webkit-scrollbar-track {
  background: transparent;
}

.oikos-card {
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.72);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.oikos-card.selected {
  border-color: #facc15;
  background: rgba(250, 204, 21, 0.08);
}
.oikos-hero-card {
  border-color: rgba(250, 204, 21, 0.42);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.88) 0%, rgba(15, 23, 42, 0.82) 100%);
  box-shadow: inset 0 1px 0 rgba(250, 204, 21, 0.16);
}
.oikos-roster-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.oikos-roster-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.65);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.oikos-roster-row:hover {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(148, 163, 184, 0.42);
}
.oikos-roster-row.selected {
  border-color: #facc15;
  background: rgba(250, 204, 21, 0.10);
}
.oikos-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(7, 11, 20, 0.65);
  font-size: 10px;
  color: #cbd5e1;
}
.oikos-field {
  width: 100%;
  padding: 5px 7px;
  font-size: 12px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(7, 11, 20, 0.85);
  color: #f8fafc;
}
.oikos-label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: #cbd5e1;
}

/* Bottom Floating HUD (Mini Radar + Active Citizen Pill) */
.oikos-bottom-hud {
  position: absolute;
  left: 10px;
  bottom: 10px;
  right: 10px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  pointer-events: none;
  z-index: 20;
  transition: right 0.18s ease;
}
.oikos-bottom-hud.drawer-open {
  right: 360px;
}
.oikos-radar-box {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 9px;
  background: rgba(11, 17, 32, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.28);
  backdrop-filter: blur(8px);
}
.oikos-radar {
  display: block;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  cursor: crosshair;
  image-rendering: pixelated;
}
.oikos-context-pill {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(11, 17, 32, 0.92);
  border: 1px solid rgba(250, 204, 21, 0.3);
  backdrop-filter: blur(8px);
  flex: 0 1 560px;
  min-width: 0;
  max-width: 100%;
  margin: 0 auto;
}
.oikos-hint {
  font-size: 10.5px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oikos-muted {
  color: #94a3b8;
  font-size: 11px;
}
.oikos-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px 10px;
  margin-top: 2px;
}
.oikos-stat-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 10px;
}
.oikos-bar-track {
  width: 100%;
  height: 5px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  overflow: hidden;
}
.oikos-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 180ms ease;
}
.oikos-rel-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.oikos-micro-bars {
  display: grid;
  grid-template-columns: repeat(4, 22px);
  gap: 4px;
  align-items: center;
}
.oikos-micro-track {
  width: 22px;
  height: 3.5px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.22);
  overflow: hidden;
}
.oikos-micro-fill {
  height: 100%;
  border-radius: 999px;
}

@media (max-width: 880px) {
  .oikos-menubar {
    height: auto;
    min-height: 44px;
    flex-wrap: wrap;
    padding: 5px 8px;
  }
  .oikos-bottom-hud.drawer-open {
    right: 10px;
  }
  .oikos-hint {
    display: none;
  }
}
`;
