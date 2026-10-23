import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const erpViewsDir = join(currentDir, '..');

const stockPages = [
  {
    apiCall: 'getStockCheckPage',
    maskClass: 'stock-check-activation-mask',
    name: 'stock check',
    path: 'check/index.vue',
  },
  {
    apiCall: 'getStockInPage',
    maskClass: 'stock-in-activation-mask',
    name: 'stock in',
    path: 'in/index.vue',
  },
  {
    apiCall: 'getStockInBillPage',
    maskClass: 'stock-in-bill-activation-mask',
    name: 'stock in bill',
    path: 'inbill/index.vue',
  },
  {
    apiCall: 'getStockMovePage',
    maskClass: 'stock-move-activation-mask',
    name: 'stock move',
    path: 'move/index.vue',
  },
  {
    apiCall: 'getStockOutPage',
    maskClass: 'stock-out-activation-mask',
    name: 'stock out',
    path: 'out/index.vue',
  },
  {
    apiCall: 'getStockOutBillPage',
    maskClass: 'stock-out-bill-activation-mask',
    name: 'stock out bill',
    path: 'outbill/index.vue',
  },
  {
    apiCall: 'getStockPage',
    maskClass: 'stock-list-activation-mask',
    name: 'stock list',
    path: 'stock/index.vue',
  },
  {
    apiCall: 'getStockTransferInPage',
    maskClass: 'stock-transfer-in-activation-mask',
    name: 'stock transfer in',
    path: 'transfer-in/index.vue',
  },
  {
    apiCall: 'getStockTransferLedgerPage',
    maskClass: 'stock-transfer-ledger-activation-mask',
    name: 'stock transfer ledger',
    path: 'transfer-ledger/index.vue',
  },
  {
    apiCall: 'getStockTransferOutPage',
    maskClass: 'stock-transfer-out-activation-mask',
    name: 'stock transfer out',
    path: 'transfer-out/index.vue',
  },
  {
    apiCall: 'getWarehousePage',
    maskClass: 'stock-warehouse-activation-mask',
    name: 'warehouse',
    path: 'warehouse/index.vue',
  },
  {
    apiCall: 'getWarehouseMovePage',
    maskClass: 'warehouse-move-activation-mask',
    name: 'warehouse move',
    path: 'warehouse-move/index.vue',
  },
  {
    apiCall: 'getStockRecordReportPage',
    maskClass: 'stock-record-activation-mask',
    name: 'stock record',
    path: 'record/modules/stock-record-tab.vue',
  },
];

function readStockPage(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function readErpFile(path: string) {
  return readFileSync(join(erpViewsDir, path), 'utf8');
}

describe('stock activation refresh', () => {
  it('uses direct VXE data replacement in the activation refresh helper', () => {
    const source = readErpFile('utils/activation-refresh.ts');
    const refreshStart = source.indexOf(
      'async function refreshActivatedPage()',
    );
    const refreshSource = source.slice(refreshStart);

    expect(source).toContain('onActivated(() =>');
    expect(source).toContain('let activatedOnce = false;');
    expect(source).toContain('let activationRefreshVersion = 0;');
    expect(source).toContain(
      'const activationRefreshMaskVisible = ref(false);',
    );
    expect(refreshSource.match(/await waitForFrame\(\);/g)?.length).toBe(2);
    expect(refreshSource).toContain('await gridApi.grid?.loadData?.(rows);');
    expect(refreshSource).not.toContain('gridApi.query()');
  });

  it.each(stockPages)(
    'wires $name activation refresh without replacing manual refresh behavior',
    ({ apiCall, maskClass, path }) => {
      const source = readStockPage(path);

      expect(source).toContain('useVxeActivationRefresh');
      expect(source).toContain(apiCall);
      expect(source).toContain('ErpActivationRefreshMask');
      expect(source).toContain('v-if="activationRefreshMaskVisible"');
      expect(source).toContain(`class="${maskClass}"`);
    },
  );

  it('keeps page-specific transforms and summary refreshes', () => {
    expect(readStockPage('inbill/index.vue')).toContain(
      'normalizeStockInBillRow(row)',
    );
    expect(readStockPage('stock/index.vue')).toContain(
      "getStockSummary({ ...params, decimalMode: 'string' }, signal)",
    );
    expect(readStockPage('warehouse/index.vue')).toContain('fillPageUserNames');
    expect(readStockPage('warehouse-move/index.vue')).toContain(
      'getWarehouseMoveSummary(summaryParams)',
    );
    expect(readStockPage('transfer-ledger/index.vue')).toContain(
      'getStockTransferLedgerTotal',
    );
    expect(readStockPage('record/modules/stock-record-tab.vue')).toContain(
      'getStockRecordSummary(summaryParams)',
    );
  });

  it('keeps the stock record report page full-height for fixed-height grids', () => {
    const source = readStockPage('record/index.vue');

    expect(source).toContain('class="stock-record-report-page"');
    expect(source).toContain(
      'content-class="stock-record-report-page__content"',
    );
    expect(source).toContain('<StockRecordTab fixed-height');
    expect(source).toContain(
      'min-height: min(640px, max(360px, calc(100vh - 188px)))',
    );
    expect(source).toMatch(
      /:global\(\.stock-record-report-page__content\)\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow:\s*hidden;[\s\S]*?\}/,
    );
  });
});
