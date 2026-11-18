// The resident model mind: opt-in, routed through Hermes's llm.oneshot gateway RPC, budgeted,
// and always falling back to the deterministic scheduler. No real model is ever called here:
// every host below is a mock that mirrors the gateway's own param validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHermesLlmCompleter, isHermesGatewayReady, OIKOS_ONESHOT_METHOD, OIKOS_ONESHOT_TASK } from '../src/bridge.js';
import { createLlmMindController, clampMindBudget, DEFAULT_MIND_BUDGET, MIND_INSTRUCTIONS } from '../src/llm-mind.js';
import { createLivingWorldRuntime } from '../src/runtime.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function memoryStorage() {
  const m = new Map();
  return {
    get: (k, d) => (m.has(k) ? JSON.parse(m.get(k)) : d),
    set: (k, v) => m.set(k, JSON.stringify(v)),
    raw: m
  };
}

// Mirrors gateway/session_llm_oneshot.py::_validate (fields, types) and the -32601 the real
// gateway returns for methods it does not have (llm.complete, chat.complete).
const ONESHOT_FIELDS = new Set(['session_id', 'profile', 'template', 'instructions', 'input', 'variables', 'task', 'temperature', 'max_tokens']);
function rpcError(code, message) {
  return Object.assign(new Error(message), { code });
}
function mockHost({ reply = 'decide', gateway = 'open', fail = null } = {}) {
  const calls = [];
  return {
    calls,
    state: { gateway: { get: () => gateway } },
    async request(method, params = {}, timeoutMs) {
      calls.push({ method, params, timeoutMs });
      if (method !== 'llm.oneshot') throw rpcError(-32601, `Method not found: ${method}`);
      for (const key of Object.keys(params)) {
        if (!ONESHOT_FIELDS.has(key)) throw rpcError(4002, 'invalid_params');
      }
      for (const key of ['instructions', 'input', 'task', 'session_id', 'template']) {
        if (params[key] != null && typeof params[key] !== 'string') throw rpcError(4002, 'invalid_params');
      }
      for (const key of ['temperature', 'max_tokens']) {
        if (params[key] != null && (typeof params[key] !== 'number' || typeof params[key] === 'boolean')) throw rpcError(4002, 'invalid_params');
      }
      if (!String(params.instructions || '').trim() && !String(params.input || '').trim()) throw rpcError(4002, 'invalid_params');
      if (fail) throw fail;
      if (reply === 'decide') {
        const data = JSON.parse(params.input.replace(/^DATA_JSON:\n/, ''));
        const st = data.stations[0].id;
        return { text: JSON.stringify(data.inhabitants.map((r) => ({ id: r.id, stationId: st, speech: 'Model says hi', mood: 'curious', memory: 'model step' }))) };
      }
      return { text: reply };
    }
  };
}

function llmCalls(host) {
  return host.calls.filter((c) => c.method.startsWith('llm.') || c.method.startsWith('chat.'));
}

test('default off: no saved opt-in means no model request, and the tick still moves residents', async () => {
  const host = mockHost();
  const rt = createLivingWorldRuntime({ storage: memoryStorage(), mind: { complete: createHermesLlmCompleter(host) } });
  const decisions = await rt.runMindTick('10:00');
  assert.equal(llmCalls(host).length, 0, 'no llm.* request while off');
  assert.ok(decisions.length > 0, 'deterministic decisions are produced');
  assert.ok(decisions.every((d) => d.source === 'deterministic'));
  const ms = rt.getSnapshot().mindStats;
  assert.equal(ms.enabled, false);
  assert.equal(ms.totalCalls, 0);
  assert.equal(ms.lastSkip, 'disabled');
  rt.destroy();

  // A legacy caller passing enabled:true with no saved choice is honoured only as literal true;
  // truthy non-booleans do not opt in.
  const ctl = createLlmMindController({ complete: async () => 'x', enabled: 'yes' });
  assert.equal(ctl.getStats().enabled, false);
  const ctl2 = createLlmMindController({ complete: async () => 'x' });
  assert.equal(ctl2.getStats().enabled, false, 'a provider alone does not enable the mind');
});

test('opt-in: one llm.oneshot request with exactly the gateway-accepted params, no session, model decisions applied, choice persisted', async () => {
  const storage = memoryStorage();
  const host = mockHost();
  const rt = createLivingWorldRuntime({ storage, mind: { complete: createHermesLlmCompleter(host), route: { method: OIKOS_ONESHOT_METHOD, task: OIKOS_ONESHOT_TASK } } });
  rt.setMindEnabled(true);
  assert.deepEqual(storage.get('oikos.mind.v1').enabled, true);

  const decisions = await rt.runMindTick('10:00');
  const calls = llmCalls(host);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'llm.oneshot');
  assert.deepEqual(Object.keys(calls[0].params).sort(), ['input', 'instructions', 'max_tokens', 'task', 'temperature']);
  assert.equal(calls[0].params.task, 'oikos_mind');
  assert.equal(calls[0].params.instructions, MIND_INSTRUCTIONS);
  assert.ok(calls[0].params.input.startsWith('DATA_JSON:\n'));
  assert.equal(calls[0].params.max_tokens, DEFAULT_MIND_BUDGET.maxTokensPerCall);
  assert.equal('session_id' in calls[0].params, false, 'no chat session is borrowed');
  assert.equal(calls[0].timeoutMs, 60_000);

  assert.ok(decisions.length > 0);
  assert.ok(decisions.every((d) => d.source === 'llm'));
  const snap = rt.getSnapshot();
  assert.equal(snap.mindStats.okCalls, 1);
  assert.equal(snap.mindStats.lastSource, 'llm');
  assert.ok(snap.mindStats.tokensToday > 0, 'estimated tokens are charged');
  assert.ok(snap.feed.some((f) => f.text.includes('Model says hi')), 'model speech reaches the feed');
  assert.deepEqual(snap.mindRoute, { method: 'llm.oneshot', task: 'oikos_mind' });
  rt.destroy();

  // The opt-in survives a restart; turning it off is persisted and stops requests.
  const host2 = mockHost();
  const rt2 = createLivingWorldRuntime({ storage, mind: { complete: createHermesLlmCompleter(host2) } });
  assert.equal(rt2.getSnapshot().mindStats.enabled, true);
  rt2.setMindEnabled(false);
  await rt2.runMindTick('10:05');
  assert.equal(llmCalls(host2).length, 0);
  rt2.destroy();
  const rt3 = createLivingWorldRuntime({ storage, mind: { complete: createHermesLlmCompleter(host2), enabled: true } });
  assert.equal(rt3.getSnapshot().mindStats.enabled, false, 'a saved "off" beats a caller default');
  rt3.destroy();
});

test('failures fall back to non-empty deterministic decisions: gateway error, -32601, empty and unusable replies, offline', async () => {
  const cases = [
    { name: 'generic gateway error', host: mockHost({ fail: rpcError(5030, 'one-shot generation failed: no provider') }), err: /one-shot generation failed/ },
    { name: 'empty text', host: mockHost({ reply: '   ' }), err: /hermes_empty_completion/ },
    { name: 'unusable text', host: mockHost({ reply: 'I would rather not.' }), err: /unusable_reply/ },
    { name: 'bogus station ids', host: mockHost({ reply: '[{"id":"x","stationId":"nope"}]' }), err: /unusable_reply/ }
  ];
  for (const c of cases) {
    const rt = createLivingWorldRuntime({ storage: memoryStorage(), mind: { complete: createHermesLlmCompleter(c.host) } });
    rt.setMindEnabled(true);
    const decisions = await rt.runMindTick('10:00');
    assert.equal(llmCalls(c.host).length, 1, c.name);
    assert.ok(decisions.length > 0, `${c.name}: non-empty fallback`);
    assert.ok(decisions.every((d) => d.source === 'deterministic'), c.name);
    const ms = rt.getSnapshot().mindStats;
    assert.equal(ms.failedCalls, 1, c.name);
    assert.match(ms.lastError, c.err, c.name);
    rt.destroy();
  }

  // Offline gateway (a real ConnectionState that is not 'open'): the completer refuses before
  // sending anything, and wired like the plugin (ready = isHermesGatewayReady) the step is skipped
  // without being charged.
  const offline = mockHost({ gateway: 'connecting' });
  const rtOff = createLivingWorldRuntime({ storage: memoryStorage(), mind: { complete: createHermesLlmCompleter(offline) } });
  rtOff.setMindEnabled(true);
  const offDecisions = await rtOff.runMindTick('10:00');
  assert.equal(offline.calls.length, 0);
  assert.ok(offDecisions.length > 0);
  assert.match(rtOff.getSnapshot().mindStats.lastError, /hermes_gateway_offline/);
  rtOff.destroy();
  const rtReady = createLivingWorldRuntime({ storage: memoryStorage(), mind: { complete: createHermesLlmCompleter(offline), ready: () => isHermesGatewayReady(offline) } });
  rtReady.setMindEnabled(true);
  await rtReady.runMindTick('10:00');
  assert.equal(offline.calls.length, 0);
  assert.equal(rtReady.getSnapshot().mindStats.lastSkip, 'gateway_offline');
  assert.equal(rtReady.getSnapshot().mindStats.tokensToday, 0, 'offline skip is not charged');
  rtReady.destroy();

  // A gateway without llm.oneshot (-32601): stop asking until the user re-enables.
  const noMethod = mockHost({ fail: rpcError(-32601, 'Method not found') });
  const rtNo = createLivingWorldRuntime({ storage: memoryStorage(), mind: { complete: createHermesLlmCompleter(noMethod) } });
  rtNo.setMindEnabled(true);
  await rtNo.runMindTick('10:00');
  await rtNo.runMindTick('10:03');
  assert.equal(llmCalls(noMethod).length, 1, 'no retry storm against a missing method');
  assert.equal(rtNo.getSnapshot().mindStats.unsupported, true);
  assert.equal(rtNo.getSnapshot().mindStats.lastSkip, 'unsupported');
  rtNo.setMindEnabled(true);
  assert.equal(rtNo.getSnapshot().mindStats.unsupported, false, 're-enabling retries once');
  rtNo.destroy();
});

test('budget: hourly call cap, daily token cap with worst-case reservation, in-flight guard, window reset, clamped settings', async () => {
  let now = 1_000_000;
  let calls = 0;
  const complete = async () => { calls++; return { text: '[]' }; };
  const residents = [{ id: 'r1', name: 'A', sectorId: 'midtown' }];
  const stations = [{ id: 's1', sectorId: 'midtown', kind: 'work' }];

  const hourly = createLlmMindController({ enabled: true, complete, now: () => now, budget: { maxCallsPerHour: 2 } });
  for (let i = 0; i < 3; i += 1) {
    const out = await hourly.stepResidents({ residents, stations });
    assert.ok(out.length > 0, 'every tick returns decisions');
  }
  assert.equal(calls, 2);
  assert.equal(hourly.getStats().lastSkip, 'hourly_call_limit');
  now += 3_600_000;
  await hourly.stepResidents({ residents, stations });
  assert.equal(calls, 3, 'the hourly window resets');

  // Daily cap: the reservation is prompt estimate + the full reply allowance, so a call that
  // could overshoot is never sent.
  calls = 0;
  const daily = createLlmMindController({ enabled: true, complete, now: () => now, budget: { maxTokensPerDay: 1000, maxTokensPerCall: 400 } });
  const big = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, name: `N${i}`, persona: 'x'.repeat(160), sectorId: 'midtown' }));
  await daily.stepResidents({ residents: big, stations });
  assert.equal(calls, 0);
  assert.equal(daily.getStats().lastSkip, 'daily_token_limit');

  // In-flight guard: two overlapping ticks send one request.
  calls = 0;
  let release;
  const slow = createLlmMindController({ enabled: true, now: () => now, complete: () => { calls++; return new Promise((r) => { release = r; }); } });
  const p1 = slow.stepResidents({ residents, stations });
  const second = await slow.stepResidents({ residents, stations });
  assert.ok(second.length > 0 && second[0].source === 'deterministic');
  assert.equal(slow.getStats().lastSkip, 'in_flight');
  release({ text: '[{"id":"r1","stationId":"s1"}]' });
  const first = await p1;
  assert.equal(first[0].source, 'llm');
  assert.equal(calls, 1);

  // Settings are clamped to safe ranges and persisted.
  assert.deepEqual(clampMindBudget({ maxCallsPerHour: 999, maxTokensPerDay: 5, maxTokensPerCall: 'abc', batchSize: 0 }), {
    ...DEFAULT_MIND_BUDGET, maxCallsPerHour: 20, maxTokensPerDay: 1000, batchSize: 1
  });
  const storage = memoryStorage();
  const rt = createLivingWorldRuntime({ storage });
  rt.setMindBudget({ maxCallsPerHour: 5, maxTokensPerDay: 10_000 });
  assert.equal(storage.get('oikos.mind.v1').budget.maxCallsPerHour, 5);
  assert.equal(storage.get('oikos.mind.v1').enabled, false);
  rt.destroy();
  const rt2 = createLivingWorldRuntime({ storage });
  assert.equal(rt2.getSnapshot().mindStats.maxCallsPerHour, 5);
  assert.equal(rt2.getSnapshot().mindStats.maxTokensPerDay, 10_000);
  rt2.destroy();
});

test('shipped bundle calls only llm.oneshot, defaults the mind off, and drops the overstated copy', () => {
  const bundle = fs.readFileSync(path.join(root, 'desktop/plugin.js'), 'utf8');
  assert.ok(bundle.includes('"llm.oneshot"'));
  assert.ok(bundle.includes('"oikos_mind"'));
  assert.equal(bundle.includes('llm.complete'), false);
  assert.equal(bundle.includes('chat.complete'), false);
  assert.equal(bundle.includes('cheap-model'), false);
  assert.equal(bundle.includes('LLM Mind: ON'), false);
  assert.ok(bundle.includes('This can cost money'));
});
