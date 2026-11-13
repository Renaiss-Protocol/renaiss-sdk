import { describe, expect, it } from 'vitest';
import { offerExpiresAt } from './helpers';

const DAY_SECONDS = 86_400;
const now = Date.UTC(2026, 10, 10, 12, 0, 0);

describe('offerExpiresAt', () => {
  it('keeps the 180-day maximum ten minutes inside the API cap', () => {
    const expiresAt = offerExpiresAt(180 * DAY_SECONDS, now);
    expect(expiresAt.getTime()).toBe(now + (180 * DAY_SECONDS - 600) * 1000);
    // A device clock up to ten minutes ahead still lands within the cap.
    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      now - 600_000 + 180 * DAY_SECONDS * 1000,
    );
  });

  it.each([1, 7, 30, 90])('leaves a %i-day offer unchanged', (days) => {
    expect(offerExpiresAt(days * DAY_SECONDS, now).getTime()).toBe(
      now + days * DAY_SECONDS * 1000,
    );
  });
});
