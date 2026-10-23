import { describe, expect, it } from 'vitest';

import { getTransferAmountError } from './misc-transfer-amount';

describe('misc transfer amount', () => {
  it.each([
    [700, 700],
    [300, 700],
    [-300, -700],
    [0, 0],
    ['0.3', '0.3'],
  ])('allows %s within %s', (value, limit) => {
    expect(getTransferAmountError(value, limit)).toBe('');
  });
  it.each([
    [701, 700],
    ['0.300001', '0.3'],
    [-701, -700],
    [-1, 700],
    [1, -700],
    [1, 0],
  ])('rejects %s outside %s', (value, limit) => {
    expect(getTransferAmountError(value, limit)).toContain('不能超过');
  });
  it('fails closed when permission masks the limit', () => {
    expect(getTransferAmountError(100, null)).toContain('暂不可用');
  });
});
