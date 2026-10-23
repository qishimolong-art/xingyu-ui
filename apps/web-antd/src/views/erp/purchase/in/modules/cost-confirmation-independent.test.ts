import type { PurchaseCostApi } from '#/api/erp/purchase/cost-confirmation';

import { beforeEach, expect, it, vi } from 'vitest';

const items = vi.hoisted(() => vi.fn());
vi.mock('#/api/erp/purchase/cost-confirmation', () => ({
  getPurchaseCostItems: items,
}));
import {
  costText,
  formatCostAmountInput,
  loadCompleteCostItems,
  validateCostConfirmation,
} from './cost-confirmation';

const header: PurchaseCostApi.Header = {
  purchaseInId: 401,
  sourceSignature: 'stable-source',
  sourceItemCount: 101,
  latestRevision: 1,
  status: 'CONFIRMED',
  priceBasis: 'INCLUSIVE_UNCONFIRMED',
  taxStatus: 'UNKNOWN',
  costMasked: false,
  canConfirm: true,
};
const row = (id: number): PurchaseCostApi.Item => ({
  sourceItemId: id,
  sourceSignature: header.sourceSignature,
  productId: id,
  warehouseId: 201,
  quantity: '3',
  rawLineAmount: '123456789012345.123456',
});
beforeEach(() => items.mockReset());

it('loads the final source row beyond the displayed hundred without changing decimal text', async () => {
  items.mockResolvedValueOnce({
    total: 101,
    list: Array.from({ length: 100 }, (_, i) => row(i + 1)),
  });
  items.mockResolvedValueOnce({ total: 101, list: [row(101)] });
  const all = await loadCompleteCostItems(header);
  expect(all).toHaveLength(101);
  expect(all[100]?.rawLineAmount).toBe('123456789012345.123456');
  expect(items.mock.calls).toEqual([
    [401, 'stable-source', 1, 100],
    [401, 'stable-source', 2, 100],
  ]);
});

it.each(['duplicate', 'missing', 'changed-total', 'changed-signature'])(
  'rejects a torn second page: %s',
  async (mode) => {
    items.mockResolvedValueOnce({
      total: 101,
      list: Array.from({ length: 100 }, (_, i) => row(i + 1)),
    });
    items.mockResolvedValueOnce({
      total: mode === 'changed-total' ? 102 : 101,
      list:
        mode === 'missing'
          ? []
          : [
              {
                ...row(mode === 'duplicate' ? 1 : 101),
                sourceSignature:
                  mode === 'changed-signature' ? 'new-source' : 'stable-source',
              },
            ],
    });
    await expect(loadCompleteCostItems(header)).rejects.toThrow();
    expect(items).toHaveBeenCalledTimes(2);
  },
);

it('requires explicit net cost even for zero and preserves the full precision boundary', () => {
  const source = row(1);
  expect(validateCostConfirmation([source], '核对', '无费用')).toBeTruthy();
  source.confirmedNetTotalAmount = '0';
  expect(validateCostConfirmation([source], '核对', '无费用')).toBeUndefined();
  source.confirmedNetTotalAmount = '999999999999999999.123456';
  expect(validateCostConfirmation([source], '核对', '无费用')).toBeUndefined();
  source.confirmedNetTotalAmount = '9999999999999999999.123456';
  expect(validateCostConfirmation([source], '核对', '无费用')).toBeTruthy();
});

it('formats cost amounts to two decimals without losing large-number precision', () => {
  expect(costText('1')).toBe('1.00');
  expect(costText('123.456')).toBe('123.46');
  expect(costText('9007199254740993.123456')).toBe('9007199254740993.12');
  expect(costText('1.999')).toBe('2.00');
  expect(costText('123.456', true)).toBe('****');
  expect(costText('not-a-number')).toBe('不可用');
});

it('keeps the precise cost text while the user is typing', () => {
  expect(
    formatCostAmountInput('9007199254740993.123456', {
      input: '9007199254740993.123456',
      userTyping: true,
    }),
  ).toBe('9007199254740993.123456');
  expect(formatCostAmountInput('123.456')).toBe('123.46');
});
