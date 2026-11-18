// Oikos — Hermes Desktop Plugin Entrypoint (HermesPlugin contract)
import React, { useSyncExternalStore } from 'react';
import {
  host,
  Button,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  PALETTE_AREA,
  STATUSBAR_AREAS
} from '@hermes/plugin-sdk';
import { createLivingWorldRuntime } from './runtime.js';
import { connectHermesTelemetry, createHermesLlmCompleter, isHermesGatewayReady, OIKOS_ONESHOT_METHOD, OIKOS_ONESHOT_TASK } from './bridge.js';
import { OikosPage } from './app.js';

const h = React.createElement;

function OikosStatusChip({ runtime }) {
  const snap = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const residents = snap.entities.filter((e) => e.kind === 'resident').length;
  const unlockedSectors = snap.worldSpec.sectors.filter((s) => s.unlocked).length;
  return h(Button, {
    type: 'button',
    title: `Oikos · ${residents} inhabitants · ${unlockedSectors}/9 biomes active`,
    onClick: () => host.navigate('/oikos'),
    style: { fontSize: 10, padding: '0 6px', height: 22 }
  }, `❖ Oikos ${residents} · ${unlockedSectors}/9`);
}

export default {
  id: 'oikos',
  name: 'Oikos',
  description: 'Local pixel habitat where each Hermes profile is a resident with a home and daily routines. Residents run on a built-in deterministic scheduler; an optional, off-by-default model mind can be enabled in the Chronicle tab.',
  register(ctx) {
    if (typeof ctx.onDispose !== 'function') {
      throw new Error('Oikos requires ctx.onDispose');
    }

    const runtime = createLivingWorldRuntime({
      storage: ctx.storage,
      viewVisible: false,
      // No `enabled` here: the model mind stays off until the user opts in (saved in ctx.storage).
      mind: {
        complete: createHermesLlmCompleter(host),
        // host.state.gateway is 'open' when usable; while it is not, a step is skipped uncharged.
        ready: () => isHermesGatewayReady(host),
        route: { method: OIKOS_ONESHOT_METHOD, task: OIKOS_ONESHOT_TASK }
      }
    });
    const stopTelemetry = connectHermesTelemetry(host, runtime);
    runtime.startLoop();

    ctx.onDispose(() => {
      stopTelemetry();
      runtime.destroy();
    });

    ctx.register({
      id: 'oikos-page',
      area: ROUTES_AREA,
      title: 'Oikos',
      data: { path: '/oikos' },
      render: () => h(OikosPage, { runtime, host })
    });
    ctx.register({
      id: 'oikos-nav',
      area: SIDEBAR_NAV_AREA,
      data: { path: '/oikos', label: 'Oikos', codicon: 'globe' }
    });
    ctx.register({
      id: 'oikos-open',
      area: PALETTE_AREA,
      data: {
        id: 'oikos.open',
        label: 'Oikos: Open living pixel habitat',
        keywords: ['oikos', 'world', 'biome', 'pixel', 'habitat', 'residents'],
        run: () => host.navigate('/oikos')
      }
    });
    ctx.register({
      id: 'oikos-chip',
      area: STATUSBAR_AREAS.right,
      order: 108,
      render: () => h(OikosStatusChip, { runtime })
    });
  }
};
