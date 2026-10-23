import { describe, expect, it } from 'vitest';

import {
  buildCopyPurchaseOrderDraft,
  hasValidPurchaseOrderDraftItems,
  normalizePurchaseOrderDateFields,
  normalizePurchaseOrderGiftItems,
  normalizePurchaseOrderNumberFields,
  normalizePurchaseOrderSubmitData,
  parsePurchaseOrderCountText,
  parsePurchaseOrderPriceText,
  parsePurchaseInQtyText,
} from './purchase-order-form-utils';

describe('purchase order form utils', () => {
  it('normalizes backend date strings for date picker value formats', () => {
    const normalized = normalizePurchaseOrderDateFields({
      orderTime: '2026-05-19 10:20:30',
      orderDate: '2026-05-18 00:00:00',
      arrivalDate: '2026-05-20T00:00:00',
      latestOrderDate: '2026-05-17 09:08:07',
      sendDate: null,
    });

    expect(normalized.orderTime).toBe(
      new Date('2026-05-19T10:20:30').getTime(),
    );
    expect(normalized.orderDate).toBe('2026-05-18');
    expect(normalized.arrivalDate).toBe('2026-05-20');
    expect(normalized.latestOrderDate).toBe(
      new Date('2026-05-17T09:08:07').getTime(),
    );
    expect(normalized.sendDate).toBeUndefined();
  });

  it('forces gift item prices and amount fields to zero', () => {
    const normalized = normalizePurchaseOrderGiftItems([
      {
        gift: true,
        productPrice: 12.5,
        taxPrice: 1.25,
        totalPrice: 13.75,
        totalProductPrice: 12.5,
      },
      {
        gift: false,
        productPrice: 8,
        totalProductPrice: 16,
      },
    ]);

    expect(normalized[0]).toMatchObject({
      productPrice: 0,
      taxPrice: 0,
      totalPrice: 0,
      totalProductPrice: 0,
    });
    expect(normalized[1]).toMatchObject({
      productPrice: 8,
      totalProductPrice: 16,
    });
  });

  it('detects whether draft creation has selectable detail items', () => {
    expect(hasValidPurchaseOrderDraftItems([])).toBe(false);
    expect(
      hasValidPurchaseOrderDraftItems([
        {
          productId: 200,
          warehouseId: 7,
          count: 2,
          productPrice: 0,
          gift: false,
        },
      ] as any),
    ).toBe(true);
    expect(
      hasValidPurchaseOrderDraftItems([
        {
          productId: 200,
          warehouseId: 7,
          count: 2,
          gift: false,
        },
      ] as any),
    ).toBe(true);
    expect(
      hasValidPurchaseOrderDraftItems([
        {
          productId: 200,
          warehouseId: 7,
          count: 2,
          productPrice: 0,
          gift: true,
        },
      ] as any),
    ).toBe(true);
    expect(
      hasValidPurchaseOrderDraftItems([
        {
          productId: 200,
          warehouseId: 7,
          count: '2',
          productPrice: '5',
        },
      ] as any),
    ).toBe(true);
  });

  it('normalizes numeric text fields before submit', () => {
    const normalized = normalizePurchaseOrderNumberFields({
      taxPercent: '13.5',
      purchaseCycle: '30',
    } as any);

    expect(normalized.taxPercent).toBe(13.5);
    expect(normalized.purchaseCycle).toBe(30);
  });

  it('normalizes date fields to timestamps before submit', () => {
    const normalized = normalizePurchaseOrderSubmitData({
      orderDate: '2026-05-18',
      arrivalDate: '2026-05-20',
      sendDate: '2026-05-21',
      orderTime: '2026-05-19 10:20:30',
    } as any);

    expect(normalized.orderDate).toBe(
      new Date('2026-05-18T00:00:00').getTime(),
    );
    expect(normalized.arrivalDate).toBe(
      new Date('2026-05-20T00:00:00').getTime(),
    );
    expect(normalized.sendDate).toBe(new Date('2026-05-21T00:00:00').getTime());
    expect(normalized.orderTime).toBe(
      new Date('2026-05-19T10:20:30').getTime(),
    );
  });

  it('treats zero date-only values as empty when displaying', () => {
    const normalized = normalizePurchaseOrderDateFields({
      sendDate: 0,
      latestArrivalDate: '0',
    });

    expect(normalized.sendDate).toBeUndefined();
    expect(normalized.latestArrivalDate).toBeUndefined();
  });

  it('parses purchase-in quantity text as number', () => {
    expect(parsePurchaseInQtyText('10')).toMatchObject({ ok: true, value: 10 });
    expect(parsePurchaseInQtyText('10.5')).toMatchObject({
      ok: true,
      value: 10.5,
    });
    expect(parsePurchaseInQtyText('10.123')).toMatchObject({
      ok: true,
      value: 10.123,
    });
  });

  it('rejects invalid purchase-in quantity text', () => {
    expect(parsePurchaseInQtyText('')).toMatchObject({
      ok: false,
      message: '请输入入库数量',
    });
    expect(parsePurchaseInQtyText('abc')).toMatchObject({
      ok: false,
      message: '入库数量必须为数字，最多 6 位小数',
    });
    expect(parsePurchaseInQtyText('-1')).toMatchObject({
      ok: false,
      message: '入库数量不能为负数',
    });
    expect(parsePurchaseInQtyText('0')).toMatchObject({
      ok: false,
      message: '入库数量必须大于 0',
    });
    expect(parsePurchaseInQtyText('10.1234567')).toMatchObject({
      ok: false,
      message: '入库数量必须为数字，最多 6 位小数',
    });
    expect(parsePurchaseInQtyText('11', { max: 10 })).toMatchObject({
      ok: false,
      message: '入库数量不能超过可入库数量(10)',
    });
  });

  it('parses purchase quantity text with natural decimal precision', () => {
    expect(parsePurchaseOrderCountText('1')).toMatchObject({
      ok: true,
      value: 1,
    });
    expect(parsePurchaseOrderCountText('1.250')).toMatchObject({
      ok: true,
      value: 1.25,
    });
    expect(parsePurchaseOrderCountText('1e2')).toMatchObject({
      ok: false,
    });
    expect(parsePurchaseOrderCountText('1.234567')).toMatchObject({
      ok: true,
      value: 1.234567,
    });
    expect(parsePurchaseOrderCountText('1.2345678')).toMatchObject({
      ok: false,
    });
    expect(parsePurchaseOrderCountText('0')).toMatchObject({
      ok: false,
    });
  });

  it('parses purchase price text with six-decimal precision', () => {
    expect(parsePurchaseOrderPriceText('1')).toMatchObject({
      ok: true,
      value: 1,
    });
    expect(parsePurchaseOrderPriceText('1.20')).toMatchObject({
      ok: true,
      value: 1.2,
    });
    expect(parsePurchaseOrderPriceText('1e2')).toMatchObject({
      ok: false,
    });
    expect(parsePurchaseOrderPriceText('1.234567')).toMatchObject({
      ok: true,
      value: 1.234567,
    });
    expect(parsePurchaseOrderPriceText('1.2345678')).toMatchObject({
      ok: false,
    });
    expect(parsePurchaseOrderPriceText('0')).toMatchObject({
      ok: false,
    });
  });

  it('builds a copied order draft without source order identity fields', () => {
    const draft = buildCopyPurchaseOrderDraft({
      id: 100,
      no: 'PO20260531001',
      status: 20,
      supplierId: 1,
      orderDate: '2026-05-31 00:00:00',
      fileUrl: 'https://example.test/a.pdf',
      discountPercent: 12,
      taxPercent: '13',
      createTime: new Date('2026-05-31T01:00:00'),
      updateTime: '2026-05-31 02:00:00',
      updater: '9',
      updaterName: '张三',
      creatorName: '李四',
      inCount: 1,
      returnCount: 2,
      inStatus: 1,
      returnStatus: 1,
      latestOrderDate: '2026-05-30 10:00:00',
      items: [
        {
          id: 10,
          orderId: 100,
          productId: 200,
          productPrice: 5,
          count: 3,
          totalProductPrice: 15,
          taxPercent: 13,
          inCount: 1,
          returnCount: 0,
        },
      ],
    } as any);

    expect(draft).toMatchObject({
      id: undefined,
      no: undefined,
      status: undefined,
      supplierId: 1,
      orderDate: '2026-05-31',
      fileUrl: 'https://example.test/a.pdf',
      discountPercent: 12,
      taxPercent: 13,
      createTime: undefined,
      updateTime: undefined,
      updater: undefined,
      updaterName: undefined,
      creatorName: undefined,
      inCount: undefined,
      returnCount: undefined,
      inStatus: undefined,
      returnStatus: undefined,
      latestOrderDate: undefined,
    });
    expect(draft.items?.[0]).toMatchObject({
      id: undefined,
      orderId: undefined,
      seq: 1,
      productId: 200,
      productPrice: 5,
      count: 3,
      totalProductPrice: 15,
      taxPercent: 13,
      inCount: undefined,
      returnCount: undefined,
    });
  });
});
