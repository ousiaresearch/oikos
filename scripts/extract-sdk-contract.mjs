#!/usr/bin/env node
// Extract the slice of the Hermes Desktop SDK / gateway contract that Oikos depends on, from a
// hermes-agent source checkout, into tests/fixtures/hermes-sdk-contract.json.
//
//   node scripts/extract-sdk-contract.mjs /path/to/hermes-agent            # print JSON
//   node scripts/extract-sdk-contract.mjs /path/to/hermes-agent --write    # update the fixture
//
// The tests build their mock hosts and event frames from that fixture, and when HERMES_AGENT_SRC
// points at a checkout they re-extract and fail on drift. Reads source text only; runs nothing.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = path.resolve(here, '..', 'tests', 'fixtures', 'hermes-sdk-contract.json');

// Event types Oikos handles, plus the payload interfaces whose field names it relies on.
const EVENTS_OF_INTEREST = [
  'gateway.ready', 'message.start', 'message.delta', 'message.interim', 'message.complete',
  'reasoning.delta', 'reasoning.available', 'thinking.delta',
  'tool.generating', 'tool.start', 'tool.progress', 'tool.complete',
  'subagent.spawn_requested', 'subagent.start', 'subagent.progress', 'subagent.thinking', 'subagent.tool', 'subagent.complete',
  'approval.cancelled', 'error'
];

function read(root, rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`missing ${rel} under the given hermes-agent checkout`);
  return fs.readFileSync(p, 'utf8');
}

function block(src, startRe, endRe) {
  const m = startRe.exec(src);
  if (!m) throw new Error(`pattern not found: ${startRe}`);
  const rest = src.slice(m.index + m[0].length);
  const e = endRe.exec(rest);
  return e ? rest.slice(0, e.index) : rest;
}

function interfaceKeys(src, name) {
  const body = block(src, new RegExp(`export interface ${name}(?:\\s+extends[^{]+)?\\s*\\{`), /^\}/m);
  return [...body.matchAll(/^ {2}([A-Za-z_][A-Za-z0-9_]*)\??:/gm)].map((m) => m[1]).sort();
}

export function extractContract(root) {
  const shared = read(root, 'apps/shared/src/json-rpc-gateway.ts');
  const generated = read(root, 'apps/shared/src/gateway-contract.generated.ts');
  const events = read(root, 'apps/shared/src/gateway-events.ts');
  const sdk = read(root, 'apps/desktop/src/sdk/index.ts');
  const contrib = read(root, 'apps/desktop/src/contrib/plugin.ts');

  const cs = /export type ConnectionState\s*=\s*([^\n]+)/.exec(shared);
  const connectionStates = [...cs[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

  const hostBody = block(sdk, /export const host = \{/, /^\}/m);
  const stateBody = block(hostBody, /^ {2}state: \{/m, /^ {2}\},?$/m);
  const hostStateAtoms = [...stateBody.matchAll(/^ {4}([A-Za-z]+): readonlyAtom/gm)].map((m) => m[1]).sort();
  const hostMembers = [...hostBody.matchAll(/^ {2}([A-Za-z]+)(?::|,$)/gm)].map((m) => m[1]).sort();

  const typesBody = block(generated, /export const GATEWAY_EVENT_TYPES = \[/, /\]/);
  const backendEventTypes = [...typesBody.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  const localBody = block(events, /export interface ClientLocalGatewayEventMap \{/, /^\}/m);
  const clientLocalEventTypes = [...localBody.matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1]).sort();

  const mapBody = block(generated, /export interface BackendGatewayEventMap \{/, /^\}/m);
  const payloadFor = Object.fromEntries([...mapBody.matchAll(/^ {2}'?([A-Za-z_.]+)'?: ([A-Za-z]+)/gm)].map((m) => [m[1], m[2]]));
  const eventPayloadKeys = {};
  for (const type of EVENTS_OF_INTEREST) {
    if (!payloadFor[type]) continue;
    eventPayloadKeys[type] = { interface: payloadFor[type], keys: interfaceKeys(generated, payloadFor[type]) };
  }
  const statusType = /export type SubagentStatus\s*=\s*([^\n]+)/.exec(generated);
  const turnStatus = /export type TurnStatus\s*=\s*([^\n]+)/.exec(generated);

  const envelopeBody = block(events, /export interface GatewayEvent<[^{]*\{/, /^\}/m);
  const envelopeKeys = [...envelopeBody.matchAll(/^ {2}([A-Za-z_][A-Za-z0-9_]*)\??:/gm)].map((m) => m[1]).sort();

  let commit = null;
  try {
    commit = execFileSync('git', ['-C', root, 'rev-parse', '--short=10', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {}

  return {
    source: { repo: 'hermes-agent', commit },
    connectionStates,
    hostStateAtoms,
    hostMembers,
    gatewayEventEnvelopeKeys: envelopeKeys,
    backendEventTypes,
    clientLocalEventTypes,
    eventPayloadKeys,
    subagentStatus: [...statusType[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
    turnStatus: [...turnStatus[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
    profilesListResultKeys: interfaceKeys(generated, 'ProfilesListResult'),
    profileRowKeys: interfaceKeys(generated, 'ProfileRow'),
    llmOneshotParamKeys: interfaceKeys(generated, 'LlmOneshotParams'),
    pluginStorageMethods: [...block(contrib, /export interface PluginStorage \{/, /^\}/m).matchAll(/^ {2}([a-z]+)[<(]/gm)].map((m) => m[1]).sort()
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || process.env.HERMES_AGENT_SRC;
  if (!root) {
    console.error('usage: node scripts/extract-sdk-contract.mjs <hermes-agent checkout> [--write]');
    process.exit(2);
  }
  const contract = extractContract(path.resolve(root));
  const json = `${JSON.stringify(contract, null, 2)}\n`;
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
    fs.writeFileSync(FIXTURE_PATH, json);
    console.log(`wrote ${path.relative(process.cwd(), FIXTURE_PATH)} (${contract.source.commit || 'unknown commit'})`);
  } else {
    process.stdout.write(json);
  }
}
