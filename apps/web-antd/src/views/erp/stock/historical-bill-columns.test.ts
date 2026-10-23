import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { useStockDocumentColumns } from './utils/document-columns';

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
class RuntimeColumn {
  visible = true;
  fixed = '';
  width = 80;
  resizeWidth = 0;
  constructor(public field: string) {}
  getKey() {
    return this.field;
  }
}
describe('实际 VXE 原型列的存储恢复', () => {
  for (const fill of [false, true]) {
    it(`restores order, visibility and widths for prototype methods, fill=${fill}`, () => {
      const runtime = [
        new RuntimeColumn('productName'),
        new RuntimeColumn('remark'),
      ];
      let columns!: ReturnType<typeof useStockDocumentColumns>;
      const element = document.createElement('div');
      const app = createApp(
        defineComponent({
          setup() {
            columns = useStockDocumentColumns({
              columns: () => [
                { field: 'productName', title: '商品', width: 120 },
                { field: 'remark', title: '备注', width: 150 },
              ],
              grid: () => undefined,
              wrapper: () => undefined,
              fill,
            });
            return () => h('div');
          },
        }),
      );
      app.mount(element);
      cleanups.push(() => app.unmount());
      const restored = columns.restoreStore({
        $table: { getFullColumns: () => runtime },
        storeData: {
          sortData: [{ k: 'remark' }, { k: 'productName' }],
          visibleData: { remark: false },
          fixedData: { productName: 'left' },
          resizableData: { productName: 233 },
        },
      });
      expect(restored.visibleData.remark).toBe(false);
      expect(restored.fixedData.productName).toBe('left');
      expect(restored.resizableData.productName).toBeGreaterThanOrEqual(233);
      expect(restored.sortData).toEqual([
        { k: 'remark' },
        { k: 'productName' },
      ]);
    });
  }
});

describe('仓单双入口列表统一合同', () => {
  const entries = [
    'inbill/index.vue',
    'outbill/index.vue',
    '../purchase/inbill/index.vue',
  ];
  it('does not steal keyword focus and uses independent query summaries', () => {
    for (const entry of entries) {
      const source = readFileSync(new URL(entry, import.meta.url), 'utf8');
      expect(source).not.toContain('queueFocusStockKeywordSearchInput');
      expect(source).not.toContain('queueFocusPurchaseKeywordSearchInput');
      expect(source).toContain('<StockListQuerySummary');
      expect(source).not.toContain('footerMethod:');
      expect(source).toContain('@keydown.enter.capture="handleSearchEnter"');
      expect(source).toContain('canQueryHistory');
    }
  });
  it('keeps independent list identities and shared runtime column restoration', () => {
    const ids = [
      'erp-stock-in-bill-list-v2',
      'erp-stock-out-bill-list-v2',
      'erp-purchase-in-bill-list-v1',
    ];
    entries.forEach((entry, index) => {
      const source = readFileSync(new URL(entry, import.meta.url), 'utf8');
      expect(source).toContain(ids[index]);
      if (index === 2) expect(source).toContain('cellClick: handleCellClick');
      expect(source).toContain('restoreStore: listColumnState.restoreStore');
      expect(source).toContain('afterReload: () => restoreSortState(gridApi)');
      expect(source).toContain('resizable: true');
    });
  });
});

it('keeps current business rows when the grid adapter clones data during column restore', async () => {
  let liveRows = [{ count: '1', totalPrice: '0' }];
  let rendered = structuredClone(liveRows);
  let configuredData = structuredClone(liveRows);
  let controls!: ReturnType<typeof useStockDocumentColumns>;
  const api = {
    setGridOptions(options: any) {
      if (options.data) configuredData = options.data;
      rendered = structuredClone(configuredData);
    },
    grid: { reloadColumn: async () => {}, getFullColumns: () => [] },
  };
  const element = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        controls = useStockDocumentColumns({
          columns: () => [{ field: 'totalPrice', width: 150 }],
          data: () => liveRows,
          grid: () => api,
          wrapper: () => undefined,
        });
        return () => h('div');
      },
    }),
  );
  app.mount(element);
  cleanups.push(() => app.unmount());
  await nextTick();
  await nextTick();
  liveRows = [{ count: '0.5', totalPrice: '5.055556' }];
  await controls.reload();
  await nextTick();
  await expect.poll(() => rendered[0]?.count).toBe('0.5');
  expect(rendered[0]?.totalPrice).toBe('5.055556');
});
