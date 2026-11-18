// Regression tests against the real Hermes Desktop SDK / gateway contract.
//
// Every mock host and event frame here is built from tests/fixtures/hermes-sdk-contract.json, which
// scripts/extract-sdk-contract.mjs extracts from a hermes-agent checkout (ConnectionState, host.state
// atoms, host members, GATEWAY_EVENT_TYPES, payload interfaces). A frame helper refuses payload keys
// the real interface does not have. Set HERMES_AGENT_SRC=/path/to/hermes-agent to also fail on drift
// between the fixture and that checkout. No network, no model, no paid call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  connectHermesTelemetry,
  createHermesLlmCompleter,
  isHermesGatewayReady,
  mapGatewayEventToActivity,
  HANDLED_GATEWAY_EVENTS,
  OIKOS_ONESHOT_METHOD
} from '../src/bridge.js';
import {
  createLlmMindController,
  buildMindRequest,
  estimateTokens,
  MIND_PAYLOAD_KEYS,
  MIND_INHABITANT_KEYS,
  PROFILE_PERSONA_PLACEHOLDER,
  HOUR_MS,
  MIND_BUDGET_LIMITS
} from '../src/llm-mind.js';
import * as mindModule from '../src/llm-mind.js';
import { createLivingWorldRuntime, MIND_LEDGER_STORAGE_KEY, MIND_LEDGER_MARKER_KEY } from '../src/runtime.js';
import { extractContract, FIXTURE_PATH } from '../scripts/extract-sdk-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const ALL_EVENT_TYPES = new Set([...C.backendEventTypes, ...C.clientLocalEventTypes]);
const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n = 4) => { for (let i = 0; i < n; i += 1) await tick(); };

function memoryStorage() {
  const m = new Map();
  return {
    get: (k, d) => (m.has(k) ? JSON.parse(m.get(k)) : d),
    set: (k, v) => m.set(k, JSON.stringify(v)),
    remove: (k) => m.delete(k),
    raw: m
  };
}

// Same semantics as Hermes Desktop's ctx.storage (apps/desktop/src/contrib/plugin.ts
// createPluginStorage over lib/storage.ts readKey/writeKey at da9c2bd): values are JSON strings in
// localStorage under `hermes.plugin.<id>.<key>`; get() returns the fallback both for a missing key
// AND for a value that fails JSON.parse; write errors (quota, disabled storage) are swallowed.
function sdkStorage(pluginId = 'oikos') {
  const ls = new Map();
  const scoped = (k) => `hermes.plugin.${pluginId}.${k}`;
  return {
    get(k, fallback) {
      const raw = ls.has(scoped(k)) ? ls.get(scoped(k)) : null;
      if (raw === null) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    },
    set: (k, v) => { ls.set(scoped(k), JSON.stringify(v)); },
    remove: (k) => { ls.delete(scoped(k)); },
    rawSet: (k, s) => { ls.set(scoped(k), s); },
    rawGet: (k) => (ls.has(scoped(k)) ? ls.get(scoped(k)) : null)
  };
}

// nanostores-shaped readable atom: get() + listen() (listen fires on change only).
function atom(initial) {
  let v = initial;
  const ls = new Set();
  return {
    get: () => v,
    set(next) { if (next === v) return; v = next; for (const l of [...ls]) l(next); },
    listen(l) { ls.add(l); return () => ls.delete(l); },
    listenerCount: () => ls.size
  };
}

// A host with exactly the real host.state atoms and the real host members Oikos may touch.
function realisticHost({ gateway = 'open', profileRpc, profilesList, routes, request } = {}) {
  const atoms = Object.fromEntries(C.hostStateAtoms.map((n) => [n, atom(null)]));
  atoms.gateway.set(gateway);
  atoms.profile.set('default');
  atoms.busy.set(false);
  const readNames = new Set();
  const state = new Proxy(atoms, { get(t, k) { if (typeof k === 'string') readNames.add(k); return t[k]; } });
  const listeners = new Map();
  const calls = [];
  const host = {
    state,
    calls,
    readNames,
    listeners,
    onEvent(type, fn) {
      const set = listeners.get(type) || new Set();
      set.add(fn);
      listeners.set(type, set);
      return () => set.delete(fn);
    },
    emit(frame) {
      for (const type of [frame.type, '*']) for (const fn of listeners.get(type) || []) fn(frame);
    },
    async request(method, params = {}, timeoutMs) {
      calls.push({ method, params, timeoutMs });
      if (request) return request(method, params);
      if (method === 'profiles.list') return profileRpc ? profileRpc(params) : { profiles: [] };
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
    }
  };
  if (profilesList) host.profiles = { list: profilesList };
  if (routes) host.profileRoutes = routes;
  for (const k of Object.keys(host)) {
    if (['calls', 'readNames', 'listeners', 'emit'].includes(k)) continue;
    assert.ok(C.hostMembers.includes(k), `mock uses a host member the SDK does not have: ${k}`);
  }
  return host;
}

// A GatewayEvent envelope with a payload restricted to the real interface's keys.
function frame(type, payload, extra = {}) {
  assert.ok(ALL_EVENT_TYPES.has(type), `not a real gateway event: ${type}`);
  if (payload) {
    const allowed = C.eventPayloadKeys[type]?.keys;
    if (allowed) for (const k of Object.keys(payload)) assert.ok(allowed.includes(k), `${type} payload has no field ${k}`);
  }
  const env = { type, ...(payload ? { payload } : {}), ...extra };
  for (const k of Object.keys(env)) assert.ok(C.gatewayEventEnvelopeKeys.includes(k), `GatewayEvent has no field ${k}`);
  return env;
}

const SECRET_PATH = '/home/user/private/acquisition-plan.txt';
const SECRET_CMD = 'rm -rf ~/tax-returns-2025';

test('contract fixture: gateway is "open" (never "connected"), no profiles/title atoms, every handled event is real', () => {
  assert.ok(C.source.commit, 'fixture records the hermes-agent commit it came from');
  assert.deepEqual(C.connectionStates, ['idle', 'connecting', 'open', 'closed', 'error']);
  assert.equal(C.connectionStates.includes('connected'), false);
  assert.equal(C.hostStateAtoms.includes('profiles'), false);
  assert.equal(C.hostStateAtoms.some((a) => /title/i.test(a)), false);
  for (const t of HANDLED_GATEWAY_EVENTS) assert.ok(ALL_EVENT_TYPES.has(t), `handled event ${t} is not in the contract`);
  for (const invented of ['tool.call', 'tool.read', 'subagent.spawn', 'session.idle', 'session.waiting']) {
    assert.equal(ALL_EVENT_TYPES.has(invented), false, `${invented} is not a real event`);
    assert.equal(mapGatewayEventToActivity({ type: invented, session_id: 's' }), null);
  }
  for (const m of ['state', 'onEvent', 'request', 'profiles', 'profileRoutes']) assert.ok(C.hostMembers.includes(m));
  assert.deepEqual(C.pluginStorageMethods, ['get', 'remove', 'set']);
  assert.deepEqual(C.profilesListResultKeys.includes('profiles'), true);
});

test('contract fixture matches the hermes-agent checkout in HERMES_AGENT_SRC (drift check)', (t) => {
  const src = process.env.HERMES_AGENT_SRC;
  if (!src) { t.skip('HERMES_AGENT_SRC not set'); return; }
  const live = extractContract(src);
  const { source: _a, ...liveRest } = live;
  const { source: _b, ...fixtureRest } = C;
  assert.deepEqual(liveRest, fixtureRest, `fixture drifted from ${src} (${live.source.commit}); re-run scripts/extract-sdk-contract.mjs --write`);
});

test('model completer: sends on gateway "open" and refuses every other real ConnectionState', async () => {
  for (const state of C.connectionStates) {
    const host = realisticHost({ gateway: state, request: async () => ({ text: '[]' }) });
    const complete = createHermesLlmCompleter(host);
    let err = null;
    try { await complete('p', { instructions: 'i', input: 'DATA_JSON:\n{}', maxTokens: 100 }); } catch (e) { err = e.message; }
    if (state === 'open') {
      assert.equal(err, null, 'open gateway sends');
      assert.equal(host.calls.length, 1);
      assert.equal(host.calls[0].method, OIKOS_ONESHOT_METHOD);
      for (const k of Object.keys(host.calls[0].params)) assert.ok(C.llmOneshotParamKeys.includes(k), `llm.oneshot has no param ${k}`);
    } else {
      assert.equal(err, 'hermes_gateway_offline', state);
      assert.equal(host.calls.length, 0, `${state}: nothing sent`);
    }
    assert.equal(isHermesGatewayReady(host), state === 'open');
  }
});

test('model mind wired like the plugin: offline steps are skipped uncharged, then the first "open" step calls', async () => {
  const host = realisticHost({ gateway: 'connecting', request: async (method, params) => {
    const data = JSON.parse(params.input.replace(/^DATA_JSON:\n/, ''));
    return { text: JSON.stringify(data.inhabitants.map((r) => ({ id: r.id, stationId: data.stations[0].id, mood: 'happy', memory: 'liked the plaza' }))) };
  } });
  const storage = memoryStorage();
  const rt = createLivingWorldRuntime({ storage, mind: { complete: createHermesLlmCompleter(host), ready: () => isHermesGatewayReady(host) } });
  rt.setMindEnabled(true);
  await rt.runMindTick('10:00');
  let ms = rt.getSnapshot().mindStats;
  assert.equal(ms.lastSkip, 'gateway_offline');
  assert.equal(ms.callsThisHour, 0, 'an offline skip is not charged');
  assert.equal(ms.tokensToday, 0);
  assert.equal(host.calls.length, 0);
  host.state.gateway.set('open');
  const decisions = await rt.runMindTick('10:03');
  ms = rt.getSnapshot().mindStats;
  assert.equal(host.calls.length, 1);
  assert.ok(decisions.every((d) => d.source === 'llm'));
  assert.equal(ms.lastSource, 'llm');
  rt.destroy();
});

test('profiles: no state.profiles atom is read; RPC waits for "open" and retries on every reopen until it loads', async () => {
  let rpcAttempts = 0;
  const host = realisticHost({
    gateway: 'connecting',
    profileRpc: () => {
      rpcAttempts += 1;
      if (rpcAttempts === 1) throw Object.assign(new Error('Hermes gateway unavailable'), { code: 5030 });
      return { profiles: [{ name: 'default', path: '/x', is_default: true }, { name: 'research', path: '/y', description: 'private notes about my health' }] };
    }
  });
  const rt = createLivingWorldRuntime({ storage: memoryStorage() });
  const stop = connectHermesTelemetry(host, rt);
  await settle();
  assert.equal(rpcAttempts, 0, 'no profiles.list while the socket is connecting');
  host.state.gateway.set('open');
  await settle();
  assert.equal(rpcAttempts, 1, 'first open triggers a load');
  host.state.gateway.set('closed');
  host.state.gateway.set('open');
  await settle();
  assert.equal(rpcAttempts, 2, 'the failed load is retried on the next open');
  const residents = rt.getSnapshot().entities.filter((e) => e.kind === 'resident');
  assert.deepEqual(residents.map((r) => r.profileKey).sort(), ['default', 'research']);
  host.state.gateway.set('closed');
  host.state.gateway.set('open');
  await settle();
  assert.equal(rpcAttempts, 2, 'no reload once loaded');
  assert.equal(host.readNames.has('profiles'), false, 'host.state.profiles (nonexistent) is never read');
  assert.equal(host.readNames.has('focusedSessionTitle'), false, 'no invented title atom');
  for (const n of host.readNames) assert.ok(C.hostStateAtoms.includes(n), `reads nonexistent atom ${n}`);
  stop();
  for (const n of C.hostStateAtoms) assert.equal(host.state[n].listenerCount(), 0, `${n} listener disposed`);
  rt.destroy();
});

test('profiles: host.profiles.list() loads with no gateway socket at all', async () => {
  const host = realisticHost({ gateway: 'idle', profilesList: async () => ({ profiles: [{ name: 'writer', path: '/p' }] }) });
  const rt = createLivingWorldRuntime({ storage: memoryStorage() });
  const stop = connectHermesTelemetry(host, rt);
  await settle();
  assert.deepEqual(rt.getSnapshot().entities.filter((e) => e.kind === 'resident').map((r) => r.profileKey), ['writer']);
  assert.equal(host.calls.length, 0, 'no RPC needed');
  stop();
  rt.destroy();
});

function spyRuntime(rt) {
  const counts = { upsert: 0, spawn: 0 };
  const spy = Object.create(rt);
  spy.upsertLiveAgent = (a) => { counts.upsert += 1; return rt.upsertLiveAgent(a); };
  spy.spawnSubagentWorker = (a) => { counts.spawn += 1; return rt.spawnSubagentWorker(a); };
  return { spy, counts };
}

test('events: real tool/message frames drive activity from the tool name only; args, paths and commands never stored', async () => {
  const storage = memoryStorage();
  const rt = createLivingWorldRuntime({ storage });
  const { spy, counts } = spyRuntime(rt);
  const host = realisticHost();
  const stop = connectHermesTelemetry(host, spy);
  const sid = 'rt_7f3a9c';

  host.emit(frame('message.start', { turn_id: 't1' }, { session_id: sid }));
  assert.equal(rt.getSnapshot().entities.find((e) => e.id === `hermes:${sid}`).statusLabel, 'Thinking');
  host.emit(frame('tool.start', { tool_id: 'c1', name: 'read_file', args: { path: SECRET_PATH }, args_text: SECRET_PATH, preview: SECRET_PATH }, { session_id: sid }));
  let agent = rt.getSnapshot().entities.find((e) => e.id === `hermes:${sid}`);
  assert.equal(agent.statusLabel, 'Reading files');
  assert.equal(agent.prop, 'book');
  host.emit(frame('tool.progress', { tool_id: 'c1', name: 'read_file', progress: 1, message: SECRET_PATH }, { session_id: sid }));
  host.emit(frame('tool.complete', { tool_id: 'c1', name: 'read_file', args: { path: SECRET_PATH }, summary: SECRET_PATH, result_text: 'TOP SECRET' }, { session_id: sid }));
  host.emit(frame('tool.start', { tool_id: 'c2', name: 'terminal', args: { command: SECRET_CMD }, args_text: SECRET_CMD }, { session_id: sid }));
  assert.equal(rt.getSnapshot().entities.find((e) => e.id === `hermes:${sid}`).statusLabel, 'Running a command');
  host.emit(frame('tool.start', { tool_id: 'c3', name: 'mcp_acme_tool', args: {} }, { session_id: sid }));
  assert.equal(rt.getSnapshot().entities.find((e) => e.id === `hermes:${sid}`).statusLabel, 'Using mcp_acme_tool');

  const before = counts.upsert;
  for (let i = 0; i < 50; i += 1) host.emit(frame('message.delta', { text: `secret token ${i}`, turn_id: 't1' }, { session_id: sid }));
  assert.equal(counts.upsert - before, 1, '50 streamed deltas update the world once, not 50 times');

  host.emit(frame('message.complete', { text: 'TOP SECRET answer', status: 'complete' }, { session_id: sid }));
  assert.equal(rt.getSnapshot().entities.find((e) => e.id === `hermes:${sid}`).statusLabel, 'Taking a breather');
  host.emit(frame('message.complete', { status: 'error', error: 'boom' }, { session_id: 'rt_other' }));
  assert.equal(rt.getSnapshot().entities.find((e) => e.id === 'hermes:rt_other').statusLabel, 'Turn ended with an error');

  host.emit(frame('approval.request', { prompt_id: 'p1', command: SECRET_CMD }, { session_id: sid }));
  assert.equal(rt.getSnapshot().entities.find((e) => e.id === `hermes:${sid}`).statusLabel, 'Needs your answer');

  // Session-less broadcasts are ignored.
  host.emit(frame('tool.start', { tool_id: 'c9', name: 'read_file' }));

  const everything = JSON.stringify(rt.getSnapshot()) + JSON.stringify([...storage.raw.values()]);
  for (const leak of ['acquisition-plan', 'private', 'tax-returns', 'TOP SECRET', 'secret token', 'boom']) {
    assert.equal(everything.includes(leak), false, `"${leak}" leaked into world state or storage`);
  }
  stop();
  assert.equal(host.listeners.get('*').size, 0, 'onEvent listener disposed');
  rt.destroy();
});

test('events: subagents spawn per real SubagentEventPayload, retire on subagent.complete / message.complete / error, replay never spawns', async () => {
  const rt = createLivingWorldRuntime({ storage: memoryStorage() });
  const host = realisticHost({ profilesList: async () => ({ profiles: [{ name: 'default', path: '/p' }] }) });
  const { spy, counts } = spyRuntime(rt);
  const stop = connectHermesTelemetry(host, spy);
  await settle();
  const subs = () => rt.getSnapshot().entities.filter((e) => e.kind === 'subagent');
  const sid = 'rt_parent';
  const sub = (i, extra = {}) => ({ goal: 'SECRET GOAL', task_count: 2, task_index: i, subagent_id: `sa_${i}`, delegation_id: 'dg1', ...extra });

  // The session's profile matches a resident, so workers attach to the resident, not hermes:<sid>.
  host.emit(frame('subagent.spawn_requested', sub(0), { session_id: sid, profile: 'default' }));
  host.emit(frame('subagent.start', sub(0, { model: 'm' }), { session_id: sid, profile: 'default' }));
  host.emit(frame('subagent.start', sub(1), { session_id: sid, profile: 'default' }));
  host.emit(frame('subagent.tool', sub(1, { tool_name: 'read_file', tool_preview: SECRET_PATH }), { session_id: sid, profile: 'default' }));
  host.emit(frame('subagent.progress', sub(0, { text: 'SECRET TEXT' }), { session_id: sid, profile: 'default' }));
  assert.equal(subs().length, 2, 'two distinct subagents, each spawned once');
  assert.equal(counts.spawn, 2);
  assert.ok(subs().every((s) => s.parentId === 'res_prof_default'));
  assert.equal(JSON.stringify(rt.getSnapshot()).includes('SECRET'), false, 'goal/text/preview never stored');

  host.emit(frame('subagent.complete', sub(0, { status: 'completed', summary: 'SECRET' }), { session_id: sid, profile: 'default' }));
  assert.deepEqual(subs().map((s) => s.id), [`sub:${sid}:sa_1`], 'subagent.complete retires exactly that worker');
  host.emit(frame('message.complete', { status: 'complete' }, { session_id: sid, profile: 'default' }));
  assert.equal(subs().length, 0, 'turn end retires the rest (even when attached to a resident)');

  // Replayed frames (reconnect) never spawn, but do clean up.
  host.emit(frame('subagent.start', sub(5), { session_id: 'rt_b', replayed: true }));
  assert.equal(subs().length, 0, 'replayed start spawns nothing');
  host.emit(frame('subagent.start', sub(6), { session_id: 'rt_b' }));
  assert.equal(subs().length, 1);
  host.emit(frame('error', { message: 'provider down' }, { session_id: 'rt_b', replayed: true }));
  assert.equal(subs().length, 0, 'replayed error still retires');

  // Fallback key when no subagent_id: delegation_id + task_index.
  host.emit(frame('subagent.start', { goal: 'g', task_count: 1, task_index: 0, delegation_id: 'dgX' }, { session_id: 'rt_c' }));
  host.emit(frame('subagent.complete', { goal: 'g', task_count: 1, task_index: 0, delegation_id: 'dgX', status: 'failed' }, { session_id: 'rt_c' }));
  assert.equal(subs().length, 0);
  stop();
  rt.destroy();
});

// ── data minimisation ──────────────────────────────────────────────────────
const TYPED_CHAT = 'my bank PIN is 4321 call mom';
const TYPED_TASK = 'draft layoff memo for Q3';
const PROFILE_DESC = 'private notes about my health';

test('model payload: typed chat, tasks, seeded memories, profile descriptions and Hermes activity never reach the model', async () => {
  const storage = memoryStorage();
  const inputs = [];
  const complete = async (_prompt, req) => {
    inputs.push(req.input);
    const data = JSON.parse(req.input.replace(/^DATA_JSON:\n/, ''));
    return { text: JSON.stringify(data.inhabitants.map((r) => ({ id: r.id, stationId: data.stations[0].id, mood: 'happy', memory: 'enjoyed the fountain' }))) };
  };
  const rt = createLivingWorldRuntime({ storage, mind: { complete } });
  rt.syncHermesProfiles([{ name: 'research', path: '/p', description: PROFILE_DESC }]);
  const custom = rt.createResident({ name: 'Wren', persona: 'Loves maps and tea', memories: ['SEEDED secret memory'] });
  const residents = rt.getSnapshot().entities.filter((e) => e.kind === 'resident');
  for (const r of residents) {
    rt.chatWithResident(r.id, TYPED_CHAT);
    rt.dispatchStationTask(r.id, rt.getSnapshot().worldSpec.stations[0].id, TYPED_TASK);
  }
  const host = realisticHost();
  const stop = connectHermesTelemetry(host, rt);
  host.emit(frame('tool.start', { tool_id: 'x', name: 'read_file', args: { path: SECRET_PATH } }, { session_id: 'rt_1', profile: 'research' }));
  rt.startGathering?.({ hostId: residents[0].id, title: 'SECRET PARTY' });

  rt.setMindEnabled(true);
  await rt.runMindTick('10:00');
  await rt.runMindTick('10:03');
  assert.equal(inputs.length, 2);
  for (const input of inputs) {
    for (const leak of [TYPED_CHAT.slice(0, 12), TYPED_TASK.slice(0, 12), 'Visitor asked', 'Task @', PROFILE_DESC, 'SEEDED', 'SECRET', 'acquisition', 'Reading files', 'Synced from Hermes']) {
      assert.equal(input.includes(leak), false, `model input contains "${leak}"`);
    }
    const data = JSON.parse(input.replace(/^DATA_JSON:\n/, ''));
    assert.deepEqual(Object.keys(data).sort(), [...MIND_PAYLOAD_KEYS].sort());
    for (const inh of data.inhabitants) {
      for (const k of Object.keys(inh)) assert.ok(MIND_INHABITANT_KEYS.includes(k), `unexpected inhabitant key ${k}`);
    }
    const research = data.inhabitants.find((i) => i.id === 'res_prof_research');
    if (research) assert.equal(research.persona, PROFILE_PERSONA_PLACEHOLDER, 'profile description replaced');
    const wren = data.inhabitants.find((i) => i.id === custom?.id);
    if (wren) assert.equal(wren.persona, 'Loves maps and tea', 'a persona typed for an Oikos citizen is sent (disclosed)');
  }
  // The model's own earlier memory is the only free text fed back.
  const second = JSON.parse(inputs[1].replace(/^DATA_JSON:\n/, ''));
  assert.ok(second.inhabitants.some((i) => i.memories.includes('enjoyed the fountain')), 'model-authored memory is reused');
  assert.ok(second.inhabitants.every((i) => i.memories.every((m) => m === 'enjoyed the fountain' || /^Visited |^Routine /.test(m))));
  stop();
  rt.destroy();
});

test('model payload: memories saved by an older build (no origin) and legacy string memories are never sent', () => {
  const now = Date.now();
  const resident = {
    id: 'r1', name: 'Ada', persona: 'p', sectorId: 'midtown', preferredKind: 'work',
    memories: ['LEGACY string memory'],
    memoryStream: [
      { text: 'OLD SAVE without origin', kind: 'obs', importance: 9, ts: now },
      { text: 'OLD hermes entry', kind: 'hermes', importance: 9, ts: now },
      { text: 'kept: model note', kind: 'obs', importance: 5, ts: now, origin: 'mind' }
    ]
  };
  const { input } = buildMindRequest({ residents: [resident], stations: [{ id: 's1', sectorId: 'midtown', kind: 'work' }], clockLabel: '10:00' });
  const data = JSON.parse(input.replace(/^DATA_JSON:\n/, ''));
  assert.deepEqual(data.inhabitants[0].memories, ['kept: model note']);
  for (const leak of ['LEGACY', 'OLD SAVE', 'OLD hermes']) assert.equal(input.includes(leak), false, leak);
  const noStream = buildMindRequest({ residents: [{ ...resident, memoryStream: [] }], stations: [{ id: 's1', sectorId: 'midtown', kind: 'work' }], clockLabel: '10:00' });
  assert.equal(noStream.input.includes('LEGACY'), false, 'the provenance-free string list is never a fallback');
});

// ── persisted budget ledger ────────────────────────────────────────────────
const RES = [{ id: 'r1', name: 'A', sectorId: 'midtown' }];
const ST = [{ id: 's1', sectorId: 'midtown', kind: 'work' }];
const okReply = async () => ({ text: '[{"id":"r1","stationId":"s1","mood":"calm"}]' });
function ledgerOf(storage) {
  return { load: () => storage.get(MIND_LEDGER_STORAGE_KEY, null), save: (r) => storage.set(MIND_LEDGER_STORAGE_KEY, r) };
}

test('budget survives reload: hourly cap and daily tokens persist across runtime instances', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const complete = async (...a) => { calls += 1; return okReply(...a); };
  const mk = () => createLivingWorldRuntime({ storage, mind: { complete } });
  let rt = mk();
  rt.setMindEnabled(true);
  rt.setMindBudget({ maxCallsPerHour: 1 });
  await rt.runMindTick('10:00');
  const spent = rt.getSnapshot().mindStats.tokensToday;
  assert.equal(calls, 1);
  assert.ok(spent > 0);
  assert.equal(rt.getSnapshot().mindStats.budgetScope, 'persisted');
  rt.destroy();

  rt = mk(); // reload
  await rt.runMindTick('10:01');
  const ms = rt.getSnapshot().mindStats;
  assert.equal(calls, 1, 'reload does not reset the hourly cap');
  assert.equal(ms.lastSkip, 'hourly_call_limit');
  assert.equal(ms.callsThisHour, 1);
  assert.equal(ms.tokensToday, spent, 'daily tokens survive reload');
  rt.destroy();

  // Two runtimes on the same storage (two windows) share one ceiling.
  const shared = memoryStorage();
  let n = 0;
  const c2 = async (...a) => { n += 1; return okReply(...a); };
  const a = createLivingWorldRuntime({ storage: shared, mind: { complete: c2 } });
  a.setMindEnabled(true);
  a.setMindBudget({ maxCallsPerHour: 2 });
  const b = createLivingWorldRuntime({ storage: shared, mind: { complete: c2 } });
  for (let i = 0; i < 3; i += 1) { await a.runMindTick('10:00'); await b.runMindTick('10:00'); }
  assert.equal(n, 2, 'both windows together stay within 2/hour');
  a.destroy();
  b.destroy();
});

test('budget is conservative: write-ahead charge survives a reload mid-request; failures keep the full reservation', async () => {
  const storage = memoryStorage();
  let prompt = '';
  let release;
  const pending = (p) => { prompt = p; return new Promise((r) => { release = r; }); };
  const rt = createLivingWorldRuntime({ storage, mind: { complete: pending } });
  rt.setMindEnabled(true);
  const inFlight = rt.runMindTick('10:00');
  await tick();
  const reserve = estimateTokens(prompt) + rt.getSnapshot().mindStats.maxTokensPerCall;
  rt.destroy(); // window reloads while the request is out
  const after = storage.get(MIND_LEDGER_STORAGE_KEY, null);
  assert.equal(after.calls, 1, 'the call was charged before it was sent');
  assert.equal(after.tokens, reserve, 'the full worst-case reservation is on disk');
  release({ text: '[]' });
  await inFlight;

  const s2 = memoryStorage();
  let p2 = '';
  const failing = async (p) => { p2 = p; throw Object.assign(new Error('timeout after 60000ms'), { code: 5030 }); };
  const rt2 = createLivingWorldRuntime({ storage: s2, mind: { complete: failing } });
  rt2.setMindEnabled(true);
  await rt2.runMindTick('10:00');
  const ms = rt2.getSnapshot().mindStats;
  assert.equal(ms.failedCalls, 1);
  assert.equal(ms.tokensToday, estimateTokens(p2) + ms.maxTokensPerCall, 'a failed/timed-out call keeps the whole reservation');
  assert.equal(s2.get(MIND_LEDGER_STORAGE_KEY, null).tokens, ms.tokensToday);
  rt2.destroy();
});

test('budget fails closed: unconfirmed writes, throwing storage and corrupt ledgers block calls', async () => {
  let calls = 0;
  const complete = async (...a) => { calls += 1; return okReply(...a); };

  // ctx.storage.set swallows quota errors; the read-back catches it.
  const silent = { load: () => null, save: () => {} };
  const c1 = createLlmMindController({ enabled: true, complete, ledger: silent });
  await c1.stepResidents({ residents: RES, stations: ST });
  assert.equal(calls, 0);
  assert.equal(c1.getStats().lastSkip, 'budget_not_persisted');
  assert.equal(c1.getStats().callsThisHour, 0, 'nothing sent, nothing charged');

  const throwing = { load: () => null, save: () => { throw new Error('QuotaExceededError'); } };
  const c2 = createLlmMindController({ enabled: true, complete, ledger: throwing });
  await c2.stepResidents({ residents: RES, stations: ST });
  assert.equal(calls, 0);
  assert.equal(c2.getStats().ledgerHealth, 'write_failed');

  for (const bad of [{ v: 1, hour: 'x', calls: 0, day: 0, tokens: 0 }, { v: 99 }, 'garbage', { v: 1, hour: 1, calls: -5, day: 1, tokens: 0 }]) {
    const s = memoryStorage();
    s.set(MIND_LEDGER_STORAGE_KEY, bad);
    const c = createLlmMindController({ enabled: true, complete, ledger: ledgerOf(s), budget: { maxCallsPerHour: 20, maxTokensPerDay: 50_000 } });
    await c.stepResidents({ residents: RES, stations: ST });
    assert.equal(calls, 0, `corrupt ledger ${JSON.stringify(bad)} blocks`);
    assert.equal(c.getStats().ledgerHealth, 'corrupt_assumed_spent');
    assert.ok(c.getStats().callsThisHour >= MIND_BUDGET_LIMITS.maxCallsPerHour[1]);
  }

  // Clock moved back: a record from a later hour still counts.
  let now = 10 * HOUR_MS;
  const s = memoryStorage();
  s.set(MIND_LEDGER_STORAGE_KEY, { v: 1, hour: 11, calls: 3, day: 0, tokens: 0 });
  const c3 = createLlmMindController({ enabled: true, complete, ledger: ledgerOf(s), now: () => now, budget: { maxCallsPerHour: 3 } });
  await c3.stepResidents({ residents: RES, stations: ST });
  assert.equal(calls, 0);
  assert.equal(c3.getStats().lastSkip, 'hourly_call_limit');
  now = 12 * HOUR_MS; // next real hour
  await c3.stepResidents({ residents: RES, stations: ST });
  assert.equal(calls, 1, 'a new clock hour opens the window again');
});

// ── stale runtime / reload races (post-review regressions) ───────────────────
// A plugin disable/re-enable or reload destroys runtime A and creates runtime B on the same
// ctx.storage while A's llm.oneshot request may still be out. A's late reply must not write
// anything (it would overwrite residents B created), and B must not send a second request
// while A's is still in flight.
const MIND_LEASE_MS = mindModule.MIND_LEASE_MS;
function pendingHost() {
  const pending = [];
  let sent = 0;
  const complete = () => { sent += 1; return new Promise((resolve) => pending.push(resolve)); };
  // Resolve everything still out, so a failing assertion can never leave a test hanging.
  const releaseAll = () => { for (const r of pending.splice(0)) r({ text: '[]' }); };
  return { complete, pending, sent: () => sent, releaseAll };
}
// Run a tick without awaiting a request that may never be answered.
const startTick = async (rt, label) => { const p = rt.runMindTick(label); await settle(); return p; };

test('stale runtime: a reply that lands after destroy() writes nothing and cannot erase residents a new runtime created', async () => {
  const storage = sdkStorage();
  const h = pendingHost();
  const A = createLivingWorldRuntime({ storage, mind: { complete: h.complete } });
  A.setMindEnabled(true);
  const aTick = A.runMindTick('10:00');
  await settle();
  assert.equal(h.sent(), 1);
  A.destroy();

  const B = createLivingWorldRuntime({ storage, mind: { complete: h.complete } });
  B.createResident({ name: 'Zelda', persona: 'made after reload' });
  const names = () => (storage.get('oikos.residents.v3', []) || []).map((r) => r.name);
  assert.ok(names().includes('Zelda'), 'B persisted its new resident');
  const before = storage.rawGet('oikos.residents.v3');
  const chronicleBefore = storage.rawGet('oikos.chronicle.v1');

  const stations = B.getSnapshot().worldSpec.stations;
  const residentId = A.getSnapshot().entities.find((e) => e.kind === 'resident').id;
  h.pending[0]({ text: JSON.stringify([{ id: residentId, stationId: stations[0].id, speech: 'late', mood: 'calm', memory: 'late reply' }]) });
  const late = await aTick;

  assert.deepEqual(late, [], 'a destroyed runtime applies no decisions');
  assert.ok(names().includes('Zelda'), 'the destroyed runtime did not overwrite B\'s residents');
  assert.equal(storage.rawGet('oikos.residents.v3'), before, 'residents key byte-identical after the late reply');
  assert.equal(storage.rawGet('oikos.chronicle.v1'), chronicleBefore, 'chronicle untouched by the late reply');
  B.destroy();
});

test('reload concurrency: a new runtime sends nothing while the old runtime\'s request is in flight', async () => {
  assert.ok(Number.isFinite(MIND_LEASE_MS) && MIND_LEASE_MS > 60_000, 'lease outlasts the 60 s llm.oneshot timeout');
  let now = 10 * HOUR_MS + 1000;
  const storage = sdkStorage();
  const h = pendingHost();
  const mk = () => createLivingWorldRuntime({ storage, mind: { complete: h.complete, now: () => now } });
  const A = mk();
  A.setMindEnabled(true);
  const aTick = A.runMindTick('10:00');
  await settle();
  A.destroy(); // reload while A's request is out

  const B = mk();
  try {
    startTick(B, '10:01'); // started; the request itself is not awaited
    await settle();
    assert.equal(h.sent(), 1, 'only one request in flight across the reload');
    assert.equal(B.getSnapshot().mindStats.lastSkip, 'in_flight_elsewhere');

    // A destroyed runtime never releases its lease (it writes nothing); B waits for the lease to
    // expire (request timeout + margin) instead of trusting a dead runtime.
    h.pending[0]({ text: '[]' });
    await aTick;
    startTick(B, '10:02');
    await settle();
    assert.equal(h.sent(), 1, 'the lease outlives the destroyed runtime until it expires');
    now += MIND_LEASE_MS + 1;
    startTick(B, '10:04');
    await settle();
    assert.equal(h.sent(), 2, 'after the lease expires B may send');
  } finally {
    h.releaseAll();
    await settle();
    B.destroy();
  }

  // Two live runtimes (two windows) in one JS thread: the second defers, and once the first
  // settles and releases its lease the second can send.
  const s2 = sdkStorage();
  const h2 = pendingHost();
  const W1 = createLivingWorldRuntime({ storage: s2, mind: { complete: h2.complete } });
  W1.setMindEnabled(true);
  const W2 = createLivingWorldRuntime({ storage: s2, mind: { complete: h2.complete } });
  try {
    const w1 = W1.runMindTick('10:00');
    await settle();
    startTick(W2, '10:00');
    await settle();
    assert.equal(h2.sent(), 1);
    assert.equal(W2.getSnapshot().mindStats.lastSkip, 'in_flight_elsewhere');
    h2.pending[0]({ text: '[]' });
    await w1;
    startTick(W2, '10:01');
    await settle();
    assert.equal(h2.sent(), 2, 'a live runtime releases its lease when its request settles');
  } finally {
    h2.releaseAll();
    await settle();
    W1.destroy();
    W2.destroy();
  }
});

test('corrupt ledger under real ctx.storage semantics (JSON.parse fallback) fails closed, a fresh store does not', async () => {
  let calls = 0;
  const complete = async (...a) => { calls += 1; return okReply(...a); };

  // Fresh storage: no ledger ever written, calls allowed.
  const fresh = sdkStorage();
  const f = createLivingWorldRuntime({ storage: fresh, mind: { complete } });
  f.setMindEnabled(true);
  await f.runMindTick('10:00');
  assert.equal(calls, 1, 'a never-written ledger is not treated as corrupt');
  f.destroy();

  // Same storage, ledger bytes truncated: ctx.storage.get returns the fallback, exactly like a
  // missing key. Oikos must still see that a ledger existed and treat the budget as spent.
  for (const raw of ['{"v":1,"hour":49', 'not json', '']) {
    calls = 0;
    const s = sdkStorage();
    const w = createLivingWorldRuntime({ storage: s, mind: { complete } });
    w.setMindEnabled(true);
    await w.runMindTick('10:00');
    assert.equal(calls, 1);
    w.destroy();
    s.rawSet(MIND_LEDGER_STORAGE_KEY, raw);
    calls = 0;
    const rt = createLivingWorldRuntime({ storage: s, mind: { complete } });
    await rt.runMindTick('10:01');
    const ms = rt.getSnapshot().mindStats;
    assert.equal(calls, 0, `truncated ledger ${JSON.stringify(raw)} blocks`);
    assert.equal(ms.ledgerHealth, 'corrupt_assumed_spent');
    rt.destroy();
  }

  // The block is for the current hour/day only: the corrupt record is rewritten as a valid
  // fully-spent record, so the next clock hour opens again (and the next UTC day restores tokens).
  let now = 30 * 24 * HOUR_MS + 5 * HOUR_MS;
  calls = 0;
  const r = sdkStorage();
  const w0 = createLivingWorldRuntime({ storage: r, mind: { complete, now: () => now } });
  w0.setMindEnabled(true);
  await w0.runMindTick('05:00');
  w0.destroy();
  r.rawSet(MIND_LEDGER_STORAGE_KEY, '{"v":1,');
  calls = 0;
  const w1 = createLivingWorldRuntime({ storage: r, mind: { complete, now: () => now } });
  await w1.runMindTick('05:01');
  assert.equal(calls, 0);
  assert.doesNotThrow(() => JSON.parse(r.rawGet(MIND_LEDGER_STORAGE_KEY)), 'corrupt record rewritten as valid JSON');
  now += 24 * HOUR_MS; // next UTC day, so both the hour and the day windows are fresh
  await w1.runMindTick('05:02');
  assert.equal(calls, 1, 'the corrupt-ledger block lifts with the next window instead of lasting forever');
  w1.destroy();

  // A ledger saved by the previous build has no marker; loading it adds the marker, so a later
  // corruption of that ledger is still caught.
  calls = 0;
  const legacy = sdkStorage();
  legacy.set(MIND_LEDGER_STORAGE_KEY, { v: 1, hour: 0, calls: 0, day: 0, tokens: 0 });
  assert.equal(legacy.rawGet(MIND_LEDGER_MARKER_KEY), null);
  const l1 = createLivingWorldRuntime({ storage: legacy, mind: { complete } });
  l1.getSnapshot();
  l1.destroy();
  assert.equal(legacy.rawGet(MIND_LEDGER_MARKER_KEY), 'true', 'marker healed on load');
  legacy.rawSet(MIND_LEDGER_STORAGE_KEY, 'not json');
  const l2 = createLivingWorldRuntime({ storage: legacy, mind: { complete } });
  l2.setMindEnabled(true);
  await l2.runMindTick('10:00');
  assert.equal(calls, 0, 'a corrupted legacy ledger blocks once it has been marked');
  l2.destroy();
});

test('without storage the limits are per runtime and labelled as such', async () => {
  const c = createLlmMindController({ enabled: true, complete: okReply });
  assert.equal(c.getStats().budgetScope, 'runtime');
  const rt = createLivingWorldRuntime({});
  assert.equal(rt.getSnapshot().mindStats.budgetScope, 'runtime');
  rt.destroy();
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  assert.ok(app.includes('reset when Oikos reloads'), 'UI labels runtime-only limits');
});

test('README and consent copy: no nonexistent host atoms, precise data disclosure', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  for (const bad of ['host.state.profiles', "session's id and title", 'tool.call', 'session.idle', 'file **basename**', 'last three activity labels', 'first 22 characters', 'hard ceiling', 'hard limit']) {
    assert.equal(readme.includes(bad), false, `README still says ${bad}`);
    assert.equal(app.includes(bad), false, `consent copy still says ${bad}`);
  }
  for (const must of ['host.profiles.list()', "'open'", 'never sent', 'typed']) assert.ok(readme.includes(must), `README missing ${must}`);
  assert.ok(app.includes('Never sent:'), 'consent lists what is never sent');
  assert.ok(readme.includes('not a spending cap'), 'README says the counters are not a spending cap');
  assert.ok(app.includes('not a billing cap'), 'consent says the counters are not a billing cap');
});
