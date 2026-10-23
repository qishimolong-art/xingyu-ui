import { describe, expect, it } from 'vitest';

import { getCurrentTimestamp } from './form-defaults';

describe('getCurrentTimestamp', () => {
  it('returns a numeric timestamp', () => {
    const value = getCurrentTimestamp();
    expect(typeof value).toBe('number');
    expect(Number.isFinite(value)).toBe(true);
  });
});
