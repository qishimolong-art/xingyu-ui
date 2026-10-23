import { describe, expect, it } from 'vitest';

import { overridesPreferences } from './preferences';

describe('web-antd preferences', () => {
  it('uses light theme as the project default for new users', () => {
    expect(overridesPreferences.theme?.mode).toBe('light');
  });
});
