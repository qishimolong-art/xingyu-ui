import { describe, expect, it } from 'vitest';

import {
  assistantDetailAvailable,
  assistantDetailLabel,
  assistantResponseMessage,
  assistantTableColumn,
  formatAssistantCell,
} from './assistant-result-format';

describe('assistant result formatting', () => {
  it('formats stock movement business types with readable labels', () => {
    expect(formatAssistantCell(50, 'biz_type')).toBe('销售出库');
    expect(formatAssistantCell(32, 'biz_type')).toBe('调拨出库');
    expect(formatAssistantCell(30, 'biz_type')).toBe('调拨入库');
    expect(formatAssistantCell(70, 'biz_type')).toBe('采购入库');
    expect(formatAssistantCell(999, 'biz_type')).toBe('业务类型 999');
  });

  it('formats date and time columns and keeps blank values readable', () => {
    expect(formatAssistantCell(1_789_980_970_000, 'biz_date')).toBe(
      '2026-09-21 16:56:10',
    );
    expect(formatAssistantCell('2026-09-28T09:30:05', 'order_time')).toBe(
      '2026-09-28 09:30:05',
    );
    expect(formatAssistantCell('', 'product_name')).toBe('—');
  });

  it('adds stable widths and a formatter to generated table columns', () => {
    const column = assistantTableColumn({
      key: 'product_name',
      title: '产品名称',
    });
    expect(column.width).toBeGreaterThanOrEqual(190);
    expect(column.customRender?.({ text: '路通源化油器清洗剂' } as any)).toBe(
      '路通源化油器清洗剂',
    );
  });

  it('uses the shared entry protocol for statuses and detail actions', () => {
    const value = {
      response: {
        detail: {
          available: false,
          label: '查看来源明细',
        },
        message: '当前结果只提供汇总',
        schemaVersion: 2,
      },
    };
    expect(assistantResponseMessage(value, '旧提示')).toBe(
      '当前结果只提供汇总',
    );
    expect(assistantDetailAvailable(value)).toBe(false);
    expect(assistantDetailLabel(value)).toBe('查看来源明细');
    expect(assistantDetailAvailable({})).toBeUndefined();
  });
});
