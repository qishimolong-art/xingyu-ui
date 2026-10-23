import { describe, expect, it } from 'vitest';

import {
  acceptFinanceDecimalInput,
  createRequiredNumberRule,
  normalizeFinanceDecimalInput,
} from './text-number';

describe('finance text number validation', () => {
  it('allows signed non-zero required amounts', () => {
    const rule = createRequiredNumberRule('实际收款', { nonZero: true });

    expect(rule.safeParse(-20).success).toBe(true);
    expect(rule.safeParse('15.5').success).toBe(true);
    expect(rule.safeParse(0).success).toBe(false);
    expect(rule.safeParse('').success).toBe(false);
  });

  it('keeps min validation for fields that still require non-negative values', () => {
    const rule = createRequiredNumberRule('优惠金额', { min: 0 });

    expect(rule.safeParse(0).success).toBe(true);
    expect(rule.safeParse(-0.01).success).toBe(false);
  });

  it('keeps valid decimal intermediate states and rejects invalid characters', () => {
    expect(acceptFinanceDecimalInput('')).toBe('');
    expect(acceptFinanceDecimalInput('-')).toBe('-');
    expect(acceptFinanceDecimalInput('12.')).toBe('12.');
    expect(acceptFinanceDecimalInput('-12.30')).toBe('-12.30');
    expect(acceptFinanceDecimalInput('1e3')).toBeUndefined();
    expect(acceptFinanceDecimalInput('12.345')).toBe('12.345');
    expect(normalizeFinanceDecimalInput('-12.30')).toBe('-12.3');
    expect(normalizeFinanceDecimalInput('-')).toBeUndefined();
  });
});
