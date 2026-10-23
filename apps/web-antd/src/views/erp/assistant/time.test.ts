import { describe, expect, it } from 'vitest';

import { formatAssistantTime } from './time';

describe('assistant Beijing time', () => {
  it('formats epoch and offset instants independently of browser timezone', () => {
    expect(formatAssistantTime(1_789_920_000_000)).toBe('2026-09-21 00:00:00');
    expect(formatAssistantTime('1789920000000')).toBe('2026-09-21 00:00:00');
    expect(formatAssistantTime('2026-09-20T16:00:00Z')).toBe(
      '2026-09-21 00:00:00',
    );
  });
  it('preserves ERP local dates and handles missing/invalid values', () => {
    expect(formatAssistantTime('2026-09-27T16:25:11.205666900')).toBe(
      '2026-09-27 16:25:11',
    );
    expect(formatAssistantTime('2026-09-27')).toBe('2026-09-27');
    expect(formatAssistantTime()).toBe('—');
    expect(formatAssistantTime('invalid')).toBe('—');
  });
});
