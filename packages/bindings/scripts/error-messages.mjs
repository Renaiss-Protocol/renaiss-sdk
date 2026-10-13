// Chooses the message of each API error code from what the routes document.
//
// A route documents a code's text in a "Possible codes" bullet. That text often
// describes the situation on that one route, so it becomes the code's global
// message only when every route that lists the code documents the same text.
// Otherwise the code gets a neutral message with no route detail. A whole
// response description is never used as a message.

/** The message of a code whose routes disagree or that some routes leave undocumented. */
export const NEUTRAL_MESSAGE = 'Something went wrong.';

/** Collapses whitespace, drops a leading bullet, capitalises, and ends with a full stop. */
export function normalizeMessage(text) {
  const collapsed = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-*]\s+/, '');
  if (!collapsed) return '';
  const capitalised = collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

/**
 * @param routes one entry per route: `listed` is every code the route lists
 *   (in an error enum or in a bullet) and `texts` maps a code to the raw bullet
 *   texts the route documents for it.
 * @param exampleCodes codes that a response example shows on some route. The
 *   API returns such a code from more than the routes that list it, so it is
 *   treated as shared by several routes and gets the neutral message.
 * @returns `messages` (code to message, for every code with at least one
 *   documented text) and `kept`, the codes whose documented text was used.
 */
export function selectMessages(routes, exampleCodes = new Set()) {
  const listedBy = new Map();
  const textsBy = new Map();
  for (const route of routes) {
    const codes = new Set([...route.listed, ...Object.keys(route.texts)]);
    for (const code of codes) {
      const normalized = (route.texts[code] ?? [])
        .map(normalizeMessage)
        .filter(Boolean);
      const entry = listedBy.get(code) ?? [];
      entry.push(normalized);
      listedBy.set(code, entry);
      if (normalized.length > 0) {
        const all = textsBy.get(code) ?? new Set();
        for (const text of normalized) all.add(text);
        textsBy.set(code, all);
      }
    }
  }

  const messages = new Map();
  const kept = new Set();
  for (const [code, perRoute] of listedBy) {
    const texts = textsBy.get(code);
    if (!texts) continue;
    const everyRouteDocuments = perRoute.every((found) => found.length > 0);
    if (everyRouteDocuments && texts.size === 1 && !exampleCodes.has(code)) {
      messages.set(code, [...texts][0]);
      kept.add(code);
    } else {
      messages.set(code, NEUTRAL_MESSAGE);
    }
  }
  return { messages, kept };
}
