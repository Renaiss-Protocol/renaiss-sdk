// Generates `api/error-codes.generated.ts` from the Renaiss OpenAPI document.
//
// The backend encodes per-route error contracts on each error response as a
// `code.enum` (the codes that response can return) plus a `description` of the
// form:
//
//   Possible codes:
//   - `CARD_PACK_NOT_FOUND`: Card pack not found
//
// `openapi-typescript` turns those into literal-union *types* with the messages
// trapped in JSDoc — unusable for runtime guards (`codes.includes(...)`) or
// `errMsg`. This script reads the raw document instead and emits runtime
// `as const` arrays per operation plus a parsed message map, so `@renaiss-protocol/error-codes`
// can compose action code lists and source messages from the contract.

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  process.env.RENAISS_OPENAPI_SOURCE ?? 'https://api.renaiss.xyz/openapi.json';
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../api/error-codes.generated.ts',
);

const CODE_LINE = /`([A-Z0-9_]+)`\s*:\s*(.+?)\s*$/;

async function loadDocument(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${source}: ${res.status}`);
    }
    return res.json();
  }
  const { readFileSync } = await import('node:fs');
  return JSON.parse(readFileSync(source, 'utf8'));
}

// `/v0/gacha/vrf/packs/{slug}/contents` + `get` -> `GACHA_VRF_PACKS_BY_SLUG_CONTENTS_GET`
function constName(path, method) {
  const segments = path
    .replace(/^\/v0\//, '')
    .split('/')
    .filter((s) => s)
    .flatMap((segment) => {
      const param = segment.match(/^\{(.+)\}$/);
      const normalized = (param?.[1] ?? segment)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toUpperCase();

      return param === null ? [normalized] : ['BY', normalized];
    });
  return `${segments.join('_')}_${method.toUpperCase()}`;
}

function collectOperation(operation) {
  const codes = new Set();
  const messages = new Map();
  for (const response of Object.values(operation.responses ?? {})) {
    const schema = response?.content?.['application/json']?.schema;
    const codeSchema = schema?.properties?.code;
    if (!Array.isArray(codeSchema?.enum)) continue;
    for (const code of codeSchema.enum) codes.add(code);
    for (const line of (codeSchema.description ?? '').split('\n')) {
      const match = line.match(CODE_LINE);
      if (match) messages.set(match[1], match[2]);
    }
  }
  return { codes: [...codes], messages };
}

const document = await loadDocument(SOURCE);

const operations = [];
const messages = new Map();
const conflicts = [];

for (const [path, methods] of Object.entries(document.paths ?? {})) {
  for (const [method, operation] of Object.entries(methods)) {
    if (typeof operation !== 'object' || !operation?.responses) continue;
    const { codes, messages: opMessages } = collectOperation(operation);
    if (!codes.length) continue;
    operations.push({ name: constName(path, method), path, method, codes });
    for (const [code, message] of opMessages) {
      const existing = messages.get(code);
      if (existing && existing !== message) {
        conflicts.push({ code, existing, incoming: message });
      }
      messages.set(code, message);
    }
  }
}

const missingMessages = [];
for (const op of operations) {
  for (const code of op.codes) {
    if (!messages.has(code)) missingMessages.push({ code, op: op.name });
  }
}

if (conflicts.length) {
  console.warn('⚠️  conflicting messages for codes (kept last seen):');
  for (const c of conflicts) {
    console.warn(`   ${c.code}: "${c.existing}" vs "${c.incoming}"`);
  }
}
if (missingMessages.length) {
  console.warn('⚠️  codes in an enum with no parsed message:');
  for (const m of missingMessages) console.warn(`   ${m.code} (${m.op})`);
}

operations.sort((a, b) => a.name.localeCompare(b.name));
const sortedMessages = [...messages.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
);

function renderArray(op) {
  const items = op.codes.map((c) => `  '${c}',`).join('\n');
  return [
    `/** Error codes for \`${op.method.toUpperCase()} ${op.path}\`. */`,
    `export const ${op.name}_CODES = [`,
    items,
    '] as const;',
  ].join('\n');
}

const header = `// Auto-generated from the Renaiss OpenAPI document. Do not edit by hand.
// Regenerate with: pnpm --filter @renaiss-protocol/bindings generate:error-codes`;

const messageEntries = sortedMessages
  .map(([code, message]) => `  ${code}: ${JSON.stringify(message)},`)
  .join('\n');

const messageMap = [
  `/** Messages parsed from each route's \`Possible codes\` description. */`,
  'export const GENERATED_ERROR_MESSAGES = {',
  messageEntries,
  '} as const;',
].join('\n');

const body = `${[header, ...operations.map(renderArray), messageMap].join('\n\n')}\n`;

writeFileSync(OUT, body);
console.log(
  `✓ ${operations.length} operation(s), ${sortedMessages.length} message(s) -> api/error-codes.generated.ts`,
);
