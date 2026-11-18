// Hermes Desktop Gateway Telemetry Bridge
// Maps live Hermes SDK state atoms and gateway events into Living World agent activities.
//
// Contract (Hermes Desktop SDK, checked against hermes-agent da9c2bd; fixture in
// tests/fixtures/hermes-sdk-contract.json):
// - `host.state.gateway` is the socket ConnectionState: 'idle' | 'connecting' | 'open' | 'closed' |
//   'error'. A usable gateway is 'open'. There is no 'connected' value.
// - `host.state` has no `profiles` atom and no session-title atom. Profiles come from
//   `host.profiles.list()` ({ profiles: [...] }), else the `profiles.list` gateway RPC (same shape)
//   while the socket is open, plus `host.profileRoutes()` ([{ connectionId, profile }]) additively.
// - `host.onEvent('*', fn)` delivers GatewayEvent envelopes `{ type, session_id?, payload?, profile?,
//   replayed?, ... }`. Every name used below is in the gateway's generated GATEWAY_EVENT_TYPES or
//   the Desktop's client-local approval/clarify events.
//
// Privacy: activity labels are built ONLY from the event type and the tool's name. Tool args,
// args_text, previews, results, summaries, message text, subagent goals/text and file paths are
// never read, so none of them can reach the world state, ctx.storage or a model request.

const ACTIVITY = Object.freeze({
  thinking: { state: 'thinking', stationKind: 'think', prop: 'thought', label: 'Thinking' },
  responding: { state: 'responding', stationKind: 'work', prop: 'laptop', label: 'Drafting reply' },
  tooling: { state: 'tooling', stationKind: 'work', prop: 'laptop', label: 'Using a tool' },
  reading: { state: 'reading', stationKind: 'read', prop: 'book', label: 'Reading files' },
  searching: { state: 'reading', stationKind: 'read', prop: 'book', label: 'Searching' },
  browsing: { state: 'reading', stationKind: 'read', prop: 'book', label: 'Browsing the web' },
  editing: { state: 'tooling', stationKind: 'work', prop: 'laptop', label: 'Editing files' },
  command: { state: 'tooling', stationKind: 'work', prop: 'laptop', label: 'Running a command' },
  delegating: { state: 'delegating', stationKind: 'delegate', prop: 'drone_controller', label: 'Coordinating subagents' },
  waiting: { state: 'waiting', stationKind: 'rest', prop: 'smartphone', label: 'Needs your answer' },
  idle: { state: 'idle', stationKind: 'idle', prop: null, label: 'Taking a breather' },
  failed: { state: 'idle', stationKind: 'idle', prop: null, label: 'Turn ended with an error' }
});

// Real Hermes gateway event names → activity ('tool' = derived from the tool's name only).
const EVENT_ACTIVITY = Object.freeze({
  'message.start': ACTIVITY.thinking,
  'reasoning.delta': ACTIVITY.thinking,
  'reasoning.available': ACTIVITY.thinking,
  'thinking.delta': ACTIVITY.thinking,
  'message.delta': ACTIVITY.responding,
  'message.interim': ACTIVITY.responding,
  'tool.generating': 'tool',
  'tool.start': 'tool',
  'tool.progress': 'tool',
  'tool.complete': ACTIVITY.thinking,
  'subagent.spawn_requested': ACTIVITY.delegating,
  'subagent.start': ACTIVITY.delegating,
  'subagent.progress': ACTIVITY.delegating,
  'subagent.thinking': ACTIVITY.delegating,
  'subagent.tool': ACTIVITY.delegating,
  'subagent.complete': ACTIVITY.delegating,
  'approval.request': ACTIVITY.waiting,
  'clarify.request': ACTIVITY.waiting,
  'approval.settled': ACTIVITY.thinking,
  'clarify.settled': ACTIVITY.thinking,
  'approval.cancelled': ACTIVITY.thinking,
  'message.complete': 'complete',
  error: ACTIVITY.failed
});

/** Every gateway event type Oikos reacts to (tests check each against the real contract). */
export const HANDLED_GATEWAY_EVENTS = Object.freeze([...Object.keys(EVENT_ACTIVITY), 'gateway.ready']);

const SUBAGENT_LIVE_EVENTS = new Set([
  'subagent.spawn_requested', 'subagent.start', 'subagent.progress', 'subagent.thinking', 'subagent.tool'
]);
// Turn-ending events: every subagent worker of that session is retired.
const TURN_END_EVENTS = new Set(['message.complete', 'error']);

/** The tool name only, reduced to a safe identifier. Never args, paths or previews. */
export function safeToolName(raw) {
  return String(raw ?? '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 24);
}

function activityForTool(rawName) {
  const name = safeToolName(rawName);
  if (!name) return ACTIVITY.tooling;
  if (/delegate|subagent|swarm/.test(name)) return ACTIVITY.delegating;
  if (/^(web|browser)/.test(name)) return ACTIVITY.browsing;
  if (/search|grep|find|glob/.test(name)) return ACTIVITY.searching;
  if (/read|view|list|vision/.test(name)) return ACTIVITY.reading;
  if (/write|patch|edit|manage/.test(name)) return ACTIVITY.editing;
  if (/terminal|process|exec|shell|code/.test(name)) return ACTIVITY.command;
  return { ...ACTIVITY.tooling, label: `Using ${name}` };
}

export function mapGatewayEventToActivity(event) {
  if (!event || typeof event !== 'object') return null;
  const type = String(event.type || '');
  const entry = EVENT_ACTIVITY[type];
  if (!entry) return null;
  if (entry === 'tool') return activityForTool(event.payload?.name);
  if (entry === 'complete') {
    return event.payload?.status === 'error' ? ACTIVITY.failed : ACTIVITY.idle;
  }
  return entry;
}

/** Stable worker id for one subagent of one session, from the real SubagentEventPayload keys. */
function subagentKey(sid, payload = {}) {
  const raw = payload.subagent_id
    || (payload.delegation_id ? `${payload.delegation_id}:${payload.task_index ?? 0}` : null)
    || (Number.isFinite(Number(payload.task_index)) ? `task${Number(payload.task_index)}` : '0');
  return `sub:${sid}:${String(raw).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 64)}`;
}

const MAX_TRACKED_SESSIONS = 64;

export function connectHermesTelemetry(host, runtime) {
  const disposers = [];
  let disposed = false;

  const readAtom = (name) => {
    try {
      return host?.state?.[name]?.get?.();
    } catch {
      return undefined;
    }
  };
  const gatewayOpen = () => {
    const gw = readAtom('gateway');
    return gw === undefined || gw === 'open';
  };

  // ── profiles ──────────────────────────────────────────────────────────────
  let profilesLoaded = false;
  let profileRequestInFlight = false;
  function applyProfileList(rawList, fromPrimary = false) {
    if (disposed || !Array.isArray(rawList) || rawList.length === 0) return false;
    const prevLoaded = profilesLoaded;
    if (fromPrimary) profilesLoaded = true;
    runtime.syncHermesProfiles?.(rawList, prevLoaded && !fromPrimary ? { additiveOnly: true } : {});
    return true;
  }

  function syncProfiles() {
    if (disposed || profilesLoaded || profileRequestInFlight) return;
    // Primary: the SDK's `host.profiles.list()` (Desktop REST /api/profiles, no socket needed).
    // Fallback: the `profiles.list` gateway RPC, only while the socket is 'open'.
    const viaSdk = typeof host?.profiles?.list === 'function' ? () => host.profiles.list() : null;
    const viaRpc = typeof host?.request === 'function' && gatewayOpen()
      ? () => host.request('profiles.list', { include_sessions: false })
      : null;
    const loaders = [viaSdk, viaRpc].filter(Boolean);
    if (loaders.length) {
      profileRequestInFlight = true;
      const attempt = (i) => {
        if (disposed || i >= loaders.length) return Promise.resolve(false);
        let pending;
        try {
          pending = Promise.resolve(loaders[i]());
        } catch (err) {
          pending = Promise.reject(err);
        }
        return pending
          .then((res) => applyProfileList(Array.isArray(res) ? res : res?.profiles, true) || attempt(i + 1))
          .catch(() => attempt(i + 1));
      };
      attempt(0).finally(() => { profileRequestInFlight = false; });
    }
    if (typeof host?.profileRoutes === 'function') {
      try {
        Promise.resolve(host.profileRoutes())
          .then((routes) => {
            if (disposed || profilesLoaded || !Array.isArray(routes) || !routes.length) return;
            const list = routes
              .map((r) => (typeof r === 'string' ? { name: r } : { name: r?.profile }))
              .filter((r) => typeof r.name === 'string' && r.name);
            if (list.length) applyProfileList(list, false);
          })
          .catch(() => {});
      } catch {}
    }
  }

  // ── live sessions ────────────────────────────────────────────────────────
  const lastActivity = new Map(); // sid → "state|label" (dedupes per-token delta events)
  const liveSubagents = new Map(); // sid → Set(worker id)

  function remember(map, key, value) {
    map.delete(key);
    map.set(key, value);
    while (map.size > MAX_TRACKED_SESSIONS) map.delete(map.keys().next().value);
  }

  function applyActivity(sid, profile, activity) {
    const key = `${activity.state}|${activity.label}`;
    if (lastActivity.get(sid) === key) return;
    remember(lastActivity, sid, key);
    runtime.upsertLiveAgent({
      id: `hermes:${sid}`,
      sessionId: sid,
      profile,
      name: `Session ${sid.slice(0, 8)}`,
      activity
    });
  }

  function retireSubagent(sid, workerId) {
    const set = liveSubagents.get(sid);
    set?.delete(workerId);
    if (set && set.size === 0) liveSubagents.delete(sid);
    runtime.completeSubagentWorker?.(workerId);
  }

  function retireAllSubagents(sid) {
    const set = liveSubagents.get(sid);
    if (set) {
      for (const workerId of [...set]) runtime.completeSubagentWorker?.(workerId);
      liveSubagents.delete(sid);
    }
    runtime.completeSubagentsForParent?.(`hermes:${sid}`);
  }

  function syncFocused() {
    if (disposed) return;
    const sessionId = readAtom('focusedSessionId') || readAtom('activeSessionId');
    if (!sessionId) return;
    const busy = Boolean(readAtom('busy'));
    applyActivity(String(sessionId), String(readAtom('profile') || 'default'), busy ? ACTIVITY.responding : ACTIVITY.idle);
  }

  function onGatewayStateChange() {
    if (disposed) return;
    // Retry the profile roster each time the socket (re)opens, until one load succeeds.
    if (readAtom('gateway') === 'open') syncProfiles();
    syncFocused();
  }

  for (const atomName of ['gateway', 'profile', 'focusedSessionId', 'activeSessionId', 'busy']) {
    const atom = host?.state?.[atomName];
    try {
      const handler = atomName === 'gateway' ? onGatewayStateChange : syncFocused;
      const off = typeof atom?.listen === 'function'
        ? atom.listen(handler)
        : typeof atom?.subscribe === 'function'
          ? atom.subscribe(handler)
          : null;
      if (typeof off === 'function') disposers.push(off);
    } catch {
      // Optional atom
    }
  }

  function handleEvent(event) {
    if (disposed || !event || typeof event !== 'object') return;
    const type = String(event.type || '');
    if (type === 'gateway.ready') {
      if (!event.replayed) {
        profilesLoaded = false;
        syncProfiles();
      }
      return;
    }
    const sid = typeof event.session_id === 'string' && event.session_id ? event.session_id : null;
    if (!sid) return;
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};

    // Cleanup runs even for replayed frames, so a reconnect replay can only ever retire workers.
    if (type === 'subagent.complete') {
      retireSubagent(sid, subagentKey(sid, payload));
      return;
    }
    if (TURN_END_EVENTS.has(type)) retireAllSubagents(sid);
    if (event.replayed === true) return;

    const activity = mapGatewayEventToActivity(event);
    if (!activity) return;
    const profile = String(event.profile || readAtom('profile') || 'default');
    applyActivity(sid, profile, activity);

    if (SUBAGENT_LIVE_EVENTS.has(type)) {
      const workerId = subagentKey(sid, payload);
      const set = liveSubagents.get(sid) || new Set();
      if (!set.has(workerId)) {
        const n = Number(payload.task_index);
        const spawned = runtime.spawnSubagentWorker?.({
          parentId: `hermes:${sid}`,
          profile,
          subagentId: workerId,
          name: Number.isFinite(n) ? `Subagent ${n + 1}` : 'Subagent',
          stationKind: 'delegate',
          label: 'Subagent task'
        });
        if (spawned) {
          set.add(workerId);
          remember(liveSubagents, sid, set);
        }
      }
    }
  }

  if (typeof host?.onEvent === 'function') {
    try {
      const off = host.onEvent('*', handleEvent);
      if (typeof off === 'function') disposers.push(off);
    } catch {
      // Unsupported event bus degrades cleanly to state atoms
    }
  }

  syncProfiles();
  syncFocused();

  return function dispose() {
    disposed = true;
    for (const off of disposers.splice(0).reverse()) {
      try { off(); } catch {}
    }
    lastActivity.clear();
    liveSubagents.clear();
  };
}

// Model calls go through Hermes's own gateway RPC `llm.oneshot` (the stateless one-shot the
// Desktop app uses for titles and project ideas), reached via the documented SDK door
// `host.request`. It is NOT a plugin-specific LLM API: Hermes documents `ctx.llm` from a plugin's
// Python half for that, and Oikos has no Python half. Params are exactly the fields the gateway
// accepts (it refuses unknown keys); no session_id is sent, so no chat session's model or content
// is borrowed and Hermes routes the call by `task` (config `auxiliary.oikos_mind`, else "auto").
export const OIKOS_ONESHOT_METHOD = 'llm.oneshot';
export const OIKOS_ONESHOT_TASK = 'oikos_mind';
const ONESHOT_TIMEOUT_MS = 60_000;

/** True when a model request could be sent now: `host.request` exists and the socket is 'open'
 *  (or the host exposes no gateway atom at all). */
export function isHermesGatewayReady(host) {
  if (typeof host?.request !== 'function') return false;
  let gw;
  try {
    gw = host?.state?.gateway?.get?.();
  } catch {
    return false;
  }
  return gw === undefined || gw === 'open';
}

export function createHermesLlmCompleter(host, { task = OIKOS_ONESHOT_TASK, temperature = 0.7 } = {}) {
  return async function completeWithHermes(prompt, request = {}) {
    if (typeof host?.request !== 'function') {
      throw new Error('hermes_request_unavailable');
    }
    if (!isHermesGatewayReady(host)) {
      throw new Error('hermes_gateway_offline');
    }
    const instructions = typeof request.instructions === 'string' ? request.instructions : '';
    const input = typeof request.input === 'string' ? request.input : String(prompt ?? '');
    const maxTokens = Math.max(1, Math.min(400, Math.round(Number(request.maxTokens) || 260)));
    const params = { instructions, input, max_tokens: maxTokens, temperature, task };
    const res = await host.request(OIKOS_ONESHOT_METHOD, params, ONESHOT_TIMEOUT_MS);
    const text = typeof res === 'string' ? res : String(res?.text ?? '');
    if (!text.trim()) {
      throw new Error('hermes_empty_completion');
    }
    // llm.oneshot reports no usage; the controller estimates tokens from characters.
    return { text };
  };
}
