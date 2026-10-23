import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import StockTable from './modules/stock-v2-table.vue';

const api = vi.hoisted(() => ({ page: vi.fn(), summary: vi.fn() }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/utils', () => ({ downloadFileFromBlobPart: vi.fn() }));
vi.mock('#/api/erp/report/stock-v2', () => ({
  getStockReportStatus: async () => ({
    status: 'READY',
    cutoverAt: '2026-01-01T12:34:56',
  }),
  getStockReportPage: api.page,
  getStockReportSummary: api.summary,
  exportStockReportV2: vi.fn(),
  getReportProductOptions: async () => ({ list: [], total: 0 }),
  getStockReportOptions: async () => ({
    warehouses: [],
    stockDepartments: [],
  }),
}));
vi.mock('#/api/erp/stock/warehouse', () => ({
  getStockWarehouseFilterOptions: async () => [],
  getStockWarehouseOwnerDeptSimpleList: async () => [],
}));
vi.mock('./modules/source-detail.vue', () => ({
  default: { render: () => h('div') },
}));
vi.mock('ant-design-vue', () => {
  const box = defineComponent({
    props: ['message'],
    setup:
      (p, { slots }) =>
      () =>
        h('div', [p.message, slots.default?.()]),
  });
  const table = defineComponent({
    props: ['dataSource', 'columns'],
    setup:
      (p, { slots }) =>
      () =>
        h(
          'div',
          { 'data-testid': 'rows' },
          p.dataSource?.flatMap((record: unknown) =>
            p.columns.map((column: unknown) =>
              h('span', slots.bodyCell?.({ record, column })),
            ),
          ),
        ),
  });
  return {
    Alert: box,
    Button: box,
    Checkbox: Object.assign(box, { Group: box }),
    DatePicker: Object.assign(box, { RangePicker: box }),
    Input: box,
    Popover: box,
    Select: box,
    Table: table,
    Tag: box,
  };
});

let dispose = () => {};
afterEach(() => dispose());
describe('独立验收：实际库存表格精度与不可用状态', () => {
  it.each(['BALANCE', 'MOVEMENT'])(
    '未知起点不能伪装为人工期初或新库存：%s',
    async (reportType) => {
      vi.clearAllMocks();
      api.page.mockResolvedValue({
        total: 1,
        list: [
          {
            stockId: 7,
            postingId: 7,
            productId: 7,
            warehouseId: 1,
            dataStatus: 'READY',
            originKind: 'FUTURE_UNRECOGNIZED_KIND',
            availableFrom: null,
            cutoverAt: '2026-01-01T00:00:00',
            openingQuantity: '0',
            quantity: '0',
            financialMasked: true,
            openingFinancialAmount: '987654321.654321',
            financialMovement: '987654321.654321',
          },
        ],
      });
      api.summary.mockResolvedValue({
        rowCount: 1,
        dataStatus: 'COMPLETE',
        financialMasked: true,
      });
      const element = document.createElement('div');
      document.body.append(element);
      const app = createApp(StockTable, { reportType });
      app.mount(element);
      dispose = () => {
        app.unmount();
        element.remove();
      };
      for (let i = 0; i < 6; i++) {
        await Promise.resolve();
        await nextTick();
      }
      const cells = [
        ...element.querySelectorAll('[data-testid="rows"] span'),
      ].map((node) => node.textContent);
      expect(cells).toContain('未记录起点来源');
      expect(cells).toContain('未记录起点时间');
      expect(cells).not.toContain('人工核对期初');
      expect(cells).not.toContain('新库存受控起点');
      expect(cells.join('')).not.toContain('987,654,321.654321');
      expect(cells.join('')).not.toContain('FUTURE_UNRECOGNIZED_KIND');
      expect(api.page.mock.calls[0]?.[1]).not.toHaveProperty('availableFrom');
      expect(api.page.mock.calls[0]?.[1]).not.toHaveProperty('originKind');
    },
  );
  it('大于JS安全整数的明细和本页合计保持六位精度，空值与真零可区分', async () => {
    api.page.mockResolvedValue({
      total: 2,
      list: [
        {
          stockId: 1,
          postingId: 1,
          productId: 1,
          warehouseId: 1,
          dataStatus: 'READY',
          quantity: '1',
          financialMovement: '123456789012345.123456',
          settlementMovement: null,
          balanceQuantity: '0',
        },
        {
          stockId: 2,
          postingId: 2,
          productId: 2,
          warehouseId: 1,
          dataStatus: 'READY',
          quantity: '0',
          financialMovement: '0.000001',
          settlementMovement: '0',
          balanceQuantity: '0',
        },
      ],
    });
    api.summary.mockResolvedValue({
      rowCount: 2,
      dataStatus: 'COMPLETE',
      financialInAmount: '123456789012345.123457',
      inQuantity: '1',
      outQuantity: '0',
      settlementInAmount: null,
    });
    const element = document.createElement('div');
    document.body.append(element);
    const app = createApp(StockTable, { reportType: 'MOVEMENT' });
    app.mount(element);
    dispose = () => {
      app.unmount();
      element.remove();
    };
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      await nextTick();
    }
    const rowText = element.querySelector('[data-testid="rows"]')?.textContent;
    expect(rowText).toContain('123,456,789,012,345.123456');
    expect(rowText).toContain('不可用');
    expect(rowText).toContain('0.000001');
    const totals = [
      ...element.querySelectorAll('[data-testid="totals"] tbody tr'),
    ];
    expect(totals).toHaveLength(2);
    expect(totals[0]?.textContent).toContain('123,456,789,012,345.123457');
    expect(totals[1]?.textContent).toContain('123,456,789,012,345.123457');
    expect(totals[0]?.textContent).toContain('不可用');
    expect(rowText).not.toContain('123,456,789,012,345.12不可用');
  });
});

describe('独立验收：库存经营入口客户页面结构', () => {
  it('展示库存独立页面并移除内部开发说明', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/web-antd/src/views/erp/stock/report/index.vue'),
      'utf8',
    );
    expect(source).toContain('实时库存');
    expect(source).toContain('库存进出流水明细账');
    expect(source).toContain('收发存汇总');
    expect(source).toContain('table-title="收发存汇总"');
    expect(source).toContain('库龄分析');
    expect(source).toContain('库存周转分析');
    expect(source).toContain('商品追溯');
    expect(source).toContain('table-title="商品追溯"');
    expect(source).toContain('配件盈亏明细表');
    expect(source).toContain('历史口径');
    expect(source).not.toContain('收发存汇总待库存口径确认');
    expect(source).not.toContain('商品追溯待业务链数据接入');
    expect(source).not.toContain('第一阶段');
    expect(source).not.toContain('依赖 SQL');
    expect(source).not.toContain('库存游标 SQL');
    expect(source).not.toContain('双成本展示');
    expect(source).not.toContain('不自动启用双成本新核算');
  });
});
