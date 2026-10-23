import { createApp, h, nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import DecimalAmountInput from '../../components/DecimalAmountInput.vue';
import {
  financeMoney,
  financeSum,
  financeSubtract,
  financeMultiply,
  financeListMoney,
  validateFinanceStorage,
} from './finance-decimal';
import {
  normalizeFinanceAmount,
  createProgrammaticFinanceAmountGuard,
} from '../settlement/money';
import { acceptFinanceDecimalInput } from './text-number';

describe('finance exact decimals and amount display', () => {
  it('pads money to at least two places and retains extra business precision', () => {
    expect(
      [0, '0.1', 10, '10.1200', '10.123456'].map((value) =>
        financeMoney(value),
      ),
    ).toEqual(['0.00', '0.10', '10.00', '10.12', '10.123456']);
    expect(financeMoney('****')).toBe('****');
    expect(financeMoney(null)).toBe('-');
    expect(financeListMoney('10.123456')).toBe('10.12');
  });
  it('computes without cents rounding or binary tails', () => {
    expect(financeSum(['0.1', '0.2'])).toBe('0.3');
    expect(financeSubtract('10.123456', '0.1')).toBe('10.023456');
    expect(financeMultiply('0.5', '10.111111')).toBe('5.0555555');
    expect(financeSubtract('0.000002', '0.000001')).toBe('0.000001');
    expect(
      financeSum(['999999999999999999.123456', '-999999999999999999.123455']),
    ).toBe('0.000001');
    expect(normalizeFinanceAmount('10.123456')).toBe('10.123456');
  });
  it('compares actual user values in the programmatic write guard', () => {
    const guard = createProgrammaticFinanceAmountGuard();
    guard.expect('10.123456');
    expect(guard.isExpected('10.1234560')).toBe(true);
    expect(guard.isExpected('10.123457')).toBe(false);
  });
  it('keeps intermediate input and rejects letters and scientific notation', () => {
    for (const value of ['', '-', '10.', '10.1200', '10.123456789'])
      expect(acceptFinanceDecimalInput(value)).toBe(value);
    for (const value of ['1e2', 'a', '1.2.3'])
      expect(acceptFinanceDecimalInput(value)).toBeUndefined();
  });
  it('validates real storage capacity ignoring trailing zeroes', () => {
    expect(() => validateFinanceStorage('10.1234560')).not.toThrow();
    expect(() => validateFinanceStorage('10.1234567')).toThrow('6 位');
    expect(() => validateFinanceStorage('1000000000000000000')).toThrow(
      '18 位',
    );
    expect(() => validateFinanceStorage('0.1000', '额度', 2)).not.toThrow();
    expect(() => validateFinanceStorage('0.101', '额度', 2)).toThrow();
  });
  it('does not pad while typing and never emits display padding to the model', async () => {
    const value = ref('0.1');
    const updates: string[] = [];
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
      render: () =>
        h(DecimalAmountInput, {
          value: value.value,
          'onUpdate:value': (text: string) => {
            updates.push(text);
            value.value = text;
          },
        }),
    });
    app.mount(host);
    await nextTick();
    const input = host.querySelector('input')!;
    expect(input.value).toBe('0.10');
    input.dispatchEvent(new FocusEvent('focus'));
    await nextTick();
    expect(input.value).toBe('0.1');
    input.value = '10.123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(updates.at(-1)).toBe('10.123456');
    input.dispatchEvent(new FocusEvent('blur'));
    await nextTick();
    expect(input.value).toBe('10.123456');
    value.value = '10.';
    await nextTick();
    expect(input.value).toBe('10.00');
    value.value = '-';
    await nextTick();
    expect(input.value).toBe('-');
    app.unmount();
    host.remove();
  });
});
