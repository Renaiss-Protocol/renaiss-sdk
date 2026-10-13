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
import { selectMessages } from './error-messages.mjs';

const SOURCE = process.env.RENAISS_OPENAPI_SOURCE;
if (!SOURCE)
  throw new Error(
    'Set RENAISS_OPENAPI_SOURCE to the v2 OpenAPI URL or a saved snapshot.',
  );
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../api/error-codes.generated.ts',
);

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

// `/v2/gacha/packs/{slug}` + `get` -> `GACHA_PACKS_BY_SLUG_GET`
// (exported with a `V2_` prefix; see below).
function constName(path, method) {
  const segments = path
    .replace(/^\/v\d+\//, '')
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

function collectCodes(operation) {
  const codes = new Set();
  for (const response of Object.values(operation.responses ?? {})) {
    const schema = response?.content?.['application/json']?.schema;
    const alternatives = [schema];
    while (alternatives.length) {
      const part = alternatives.pop();
      if (!part || typeof part !== 'object') continue;
      alternatives.push(...(part.anyOf ?? []), ...(part.oneOf ?? []));
      const codeSchema = part.properties?.code;
      const values =
        codeSchema?.enum ??
        (typeof codeSchema?.const === 'string' ? [codeSchema.const] : []);
      for (const code of values) codes.add(code);
    }
  }
  return [...codes];
}

// Codes shown as `example.code` of a response (callers keep only the ones the
// route does not list itself). The OpenAPI document carries an
// example on the media type (`example`, or `examples.<name>.value`) or on its
// schema; the API returns these codes from routes that do not list them.
function exampleCodes(operation, found = new Set()) {
  for (const response of Object.values(operation.responses ?? {})) {
    const media = response?.content?.['application/json'];
    const examples = [
      media?.example,
      media?.schema?.example,
      ...Object.values(media?.examples ?? {}).map((entry) => entry?.value),
    ];
    for (const example of examples)
      if (typeof example?.code === 'string') found.add(example.code);
  }
  return found;
}

// A route documents the text of a code in a bullet of the form
//   - `CODE`: text
// anywhere in its descriptions.
const BULLET_CODE = /^\s*[-*]\s*`([A-Z][A-Z0-9_]+)`\s*:\s*(.+?)\s*$/gm;
function bulletTexts(node, found = {}) {
  if (typeof node === 'string') {
    for (const match of node.matchAll(BULLET_CODE)) {
      const texts = found[match[1]] ?? [];
      texts.push(match[2]);
      found[match[1]] = texts;
    }
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) bulletTexts(value, found);
  }
  return found;
}

const documents = [await loadDocument(SOURCE)];

const operations = [];
const routes = [];
const shownInExamples = new Set();

for (const document of documents) {
  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== 'object' || !operation?.responses) continue;
      const codes = collectCodes(operation);
      const texts = bulletTexts(operation);
      routes.push({ listed: codes, texts });
      // An example on a route that does not list the code shows that the API
      // returns the code from that route too.
      for (const code of exampleCodes(operation))
        if (!codes.includes(code) && !(code in texts))
          shownInExamples.add(code);
      if (!codes.length) continue;
      operations.push({
        name: `V2_${constName(path, method)}`,
        path,
        method,
        codes,
      });
    }
  }
}

// Routes whose 5xx bodies type `code` as an open string still document their
// codes in `Possible codes` bullets. Those codes are real API codes, so they
// join the code universe without becoming per-operation lists: consumers
// handle those 5xx bodies as one case.
const documentedCodes = new Set();
for (const document of documents)
  for (const code of Object.keys(bulletTexts(document.paths)))
    documentedCodes.add(code);

const { messages, kept } = selectMessages(routes, shownInExamples);

const missingMessages = [];
for (const op of operations) {
  for (const code of op.codes) {
    if (!messages.has(code)) missingMessages.push({ code, op: op.name });
  }
}

if (missingMessages.length) {
  console.warn('⚠️  codes in an enum with no documented text:');
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

const allCodes = [
  ...new Set([...operations.flatMap((op) => op.codes), ...documentedCodes]),
].sort();
const codeList = [
  '/** Every error code any v2 route can return, including codes with no parsed message. */',
  'export const GENERATED_ERROR_CODES = [',
  ...allCodes.map((c) => `  '${c}',`),
  '] as const;',
].join('\n');

const messageMap = [
  `/** Messages from the routes' \`Possible codes\` descriptions: the shared text when every route documents the same one, otherwise a neutral sentence. Not every code has one. */`,
  'export const GENERATED_ERROR_MESSAGES = {',
  messageEntries,
  '} as const;',
].join('\n');

const body = `${[header, ...operations.map(renderArray), codeList, messageMap].join('\n\n')}\n`;

writeFileSync(OUT, body);
console.log(
  `✓ ${operations.length} operation(s), ${sortedMessages.length} message(s) (${kept.size} documented, ${sortedMessages.length - kept.size} neutral) -> api/error-codes.generated.ts`,
);
