import { describe, expect, it, vi } from 'vitest';

import {
  formatPickDeliveryQuantity,
  quantityUnits,
  usePickDeliveryQuantities,
} from './pick-delivery-quantity';

const row = (id: number, remaining = '10') => ({
  id,
  productName: `配件${id}`,
  remainingPickCount: remaining,
  remainingDeliveryCount: remaining,
  availableDeliveryCount: remaining,
});
const enabled = () => true;
describe('拣货送货分批数量', () => {
  it('精确校验18位整数，兼容数据库整数尾零但拒绝实际小数', () => {
    expect(quantityUnits('999999999999999999')).toBe(999_999_999_999_999_999n);
    expect(quantityUnits('10.000000')).toBe(10n);
    expect(formatPickDeliveryQuantity('0.000000')).toBe('0');
    expect(formatPickDeliveryQuantity('1.000000')).toBe('1');
    expect(formatPickDeliveryQuantity('999999999999999999.000000')).toBe(
      '999999999999999999',
    );
    expect(formatPickDeliveryQuantity('1.230000')).toBe('1.23');
    for (const invalid of [
      '',
      null,
      '-1',
      'abc',
      '0.000001',
      '1.5',
      '1.0000001',
      '1e3',
      '1000000000000000000',
    ])
      expect(quantityUnits(invalid)).toBeUndefined();
  });
  for (const kind of ['pick', 'delivery'] as const) {
    it(`${kind}跨页保留输入，取消重选恢复剩余值`, () => {
      const draft = usePickDeliveryQuantities(kind);
      draft.setSelection([1], [row(1, '10.000000')], enabled);
      expect(draft.quantities.value[1]).toBe('10');
      draft.quantities.value[1] = '6';
      draft.setSelection([1, 2], [row(2, '4')], enabled);
      expect(draft.getItems()).toEqual([
        { itemId: 1, quantity: '6' },
        { itemId: 2, quantity: '4' },
      ]);
      draft.setSelection([2], [row(1)], enabled);
      expect(draft.quantities.value[1]).toBeUndefined();
      draft.setSelection([1, 2], [row(1)], enabled);
      expect(draft.quantities.value[1]).toBe('10');
      draft.reset();
      expect(draft.getItems()).toEqual([]);
    });
  }
  it('拒绝空、零、负数、超量、小数，且保留原输入', () => {
    const draft = usePickDeliveryQuantities('pick');
    draft.setSelection([1], [row(1, '3.000000')], enabled);
    for (const value of ['', '0', '-1', '4', '0.3', '1.0', '0.1234567']) {
      draft.quantities.value[1] = value;
      expect(() => draft.getItems()).toThrow();
      expect(draft.quantities.value[1]).toBe(value);
    }
    draft.quantities.value[1] = '3';
    expect(draft.getItems()[0]?.quantity).toBe('3');
  });
  it('送货数量以上次已拣未送数量为上限', () => {
    const draft = usePickDeliveryQuantities('delivery');
    const item = row(1, '4');
    item.remainingDeliveryCount = '10';
    draft.setSelection([1], [item], enabled);
    expect(draft.quantities.value[1]).toBe('4');
    draft.quantities.value[1] = '5';
    expect(() => draft.getItems()).toThrow('当前可送数量');
  });
  it('全选只包含允许操作的行', () => {
    const draft = usePickDeliveryQuantities('pick');
    draft.setSelection(
      [1, 2],
      [row(1), row(2, '0')],
      (item) => Number(item.remainingPickCount) > 0,
    );
    expect(draft.selectedItemIds.value).toEqual([1]);
  });
  it('同批重试复用请求及凭证，数量变更后创建新批次', async () => {
    const draft = usePickDeliveryQuantities('pick');
    draft.setSelection([1], [row(1)], enabled);
    const upload = vi.fn(async () => [{ fileUrl: '/voucher.png' }]);
    const first = await draft.prepareSubmission('备注', ['file1'], upload);
    const retry = await draft.prepareSubmission('备注', ['file1'], upload);
    expect(retry).toBe(first);
    expect(upload).toHaveBeenCalledTimes(1);
    draft.quantities.value[1] = '6';
    const changed = await draft.prepareSubmission('备注', ['file1'], upload);
    expect(changed.requestId).not.toBe(first.requestId);
  });
});
