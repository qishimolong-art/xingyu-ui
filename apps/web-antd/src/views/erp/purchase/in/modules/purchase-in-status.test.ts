import { describe, expect, it } from 'vitest';

import {
  getPurchaseInStatusLegend,
  getPurchaseInStatusMarkers,
} from './purchase-in-status';

describe('purchase in status markers', () => {
  it('keeps the fixed invoice, adjusted, return, transfer order', () => {
    const markers = getPurchaseInStatusMarkers({
      adjusted: true,
      hasInvoice: true,
      returnCount: 3,
      returnStatus: 1,
      totalCount: 10,
      transferOutCount: 10,
      transferOutStatus: 2,
    });

    expect(markers.map((marker) => marker.key)).toEqual([
      'invoice',
      'adjusted',
      'return',
      'transfer',
    ]);
    expect(markers.map((marker) => marker.colorToken)).toEqual([
      'success',
      'primary',
      'warning',
      'purple',
    ]);
    expect(markers[2]?.description).toBe('已退货（部分，退货 3 / 入库 10）');
    expect(markers[3]?.description).toBe('已调拨（全部，调拨 10 / 入库 10）');
  });

  it('does not render placeholders for absent statuses', () => {
    expect(getPurchaseInStatusMarkers({ totalCount: 10 })).toEqual([]);
    expect(
      getPurchaseInStatusMarkers({
        returnCount: 0,
        returnStatus: 0,
        transferOutCount: 0,
        transferOutStatus: 0,
      }),
    ).toEqual([]);
  });

  it('keeps all four legend entries even when a row has no status', () => {
    const legend = getPurchaseInStatusLegend();

    expect(legend.map((marker) => marker.label)).toEqual([
      '已开票',
      '已调价',
      '已退货',
      '已调拨',
    ]);
    expect(legend.map((marker) => marker.explanation)).toEqual([
      '绿色点表示当前入库单存在已审批的采购发票记录。',
      '蓝色点表示当前入库单存在已审批并已生效的采购调价记录。',
      '橙色点表示当前入库单存在已审批的采购退货记录，悬浮单号后的圆点可查看部分或全部退货及数量。',
      '紫色点表示当前入库单存在由本单生成的调拨出库记录，悬浮单号后的圆点可查看部分或全部调拨及数量。',
    ]);
  });
});
