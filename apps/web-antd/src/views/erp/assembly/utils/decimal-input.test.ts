import { describe, expect, it } from 'vitest';

import {
  formatAssemblyAmountInput,
  formatAssemblyAmountList,
  formatAssemblyNaturalDecimal,
  isAssemblyDecimalDraft,
  isAssemblyPositiveIntegerDraft,
  validateAssemblyDecimal,
  validateAssemblyPositiveInteger,
} from './decimal-input';

describe('assembly decimal input', () => {
  it('keeps quantity precision without meaningless trailing zeros', () => {
    expect(formatAssemblyNaturalDecimal('2.000000')).toBe('2');
    expect(formatAssemblyNaturalDecimal('2.500000')).toBe('2.5');
    expect(formatAssemblyNaturalDecimal('2.345600')).toBe('2.3456');
    expect(formatAssemblyNaturalDecimal(0.1 * 3)).toBe('0.3');
  });

  it('uses two decimals by default while preserving meaningful money precision', () => {
    expect(formatAssemblyAmountInput(0)).toBe('0.00');
    expect(formatAssemblyAmountInput('12')).toBe('12.00');
    expect(formatAssemblyAmountInput('12.3')).toBe('12.30');
    expect(formatAssemblyAmountInput('12.3456')).toBe('12.3456');
    expect(formatAssemblyAmountInput('12.3400')).toBe('12.34');
  });

  it('formats list amounts to exactly two decimals', () => {
    expect(formatAssemblyAmountList('12.3456')).toBe('12.35');
    expect(formatAssemblyAmountList(12)).toBe('12.00');
    expect(formatAssemblyAmountList(undefined)).toBe('-');
  });

  it('accepts only non-negative decimal drafts with at most six decimals', () => {
    expect(isAssemblyDecimalDraft('')).toBe(true);
    expect(isAssemblyDecimalDraft('12.')).toBe(true);
    expect(isAssemblyDecimalDraft('12.123456')).toBe(true);
    expect(isAssemblyDecimalDraft('12.1234567')).toBe(false);
    expect(isAssemblyDecimalDraft('-1')).toBe(false);
    expect(isAssemblyDecimalDraft('1e2')).toBe(false);
  });

  it('validates zero rules and the decimal storage boundary', () => {
    expect(
      validateAssemblyDecimal('0', { allowZero: true, label: '金额' }),
    ).toMatchObject({ ok: true, value: 0 });
    expect(
      validateAssemblyDecimal('0', { allowZero: false, label: '数量' }),
    ).toMatchObject({ ok: false });
    expect(
      validateAssemblyDecimal('123456789012345678.123456', {
        allowZero: true,
        label: '金额',
      }),
    ).toMatchObject({ ok: true });
    expect(
      validateAssemblyDecimal('1234567890123456789.1', {
        allowZero: true,
        label: '金额',
      }),
    ).toMatchObject({ ok: false });
  });

  it('keeps assembly set count as a positive integer', () => {
    expect(isAssemblyPositiveIntegerDraft('12')).toBe(true);
    expect(isAssemblyPositiveIntegerDraft('1.2')).toBe(false);
    expect(validateAssemblyPositiveInteger('2')).toMatchObject({
      ok: true,
      value: 2,
    });
    expect(validateAssemblyPositiveInteger('0')).toMatchObject({ ok: false });
  });
});
