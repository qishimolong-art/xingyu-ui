import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const realtimeSource = readFileSync(
  join(currentDir, 'modules/stock-realtime-table.vue'),
  'utf8',
);
const sourceModalSource = readFileSync(
  join(currentDir, 'modules/stock-quantity-source-readonly-modal.vue'),
  'utf8',
);
const stockCheckSource = readFileSync(
  join(currentDir, 'modules/stock-check-readonly-table.vue'),
  'utf8',
);

const stockRecordTabSource = readFileSync(
  join(currentDir, '../record/modules/stock-record-tab.vue'),
  'utf8',
);

describe('经营报表库存及商品追溯独立页面契约', () => {
  it('splits M3 inventory reports into clean independent customer pages', () => {
    expect(indexSource).toContain("'/erp/business-report/inventory'");
    for (const key of [
      'realtime',
      'movement',
      'balance',
      'age',
      'turnover',
      'trace',
      'check',
      'legacy',
    ]) {
      expect(indexSource).toContain(`${key}:`);
    }
    for (const title of [
      '实时库存',
      '库存进出流水明细账',
      '收发存汇总',
      '库龄分析',
      '库存周转分析',
      '商品追溯',
      '配件盈亏明细表',
      '历史口径',
    ]) {
      expect(indexSource).toContain(title);
    }
    expect(indexSource).not.toContain('Tabs');
    expect(indexSource).not.toContain('TabPane');
    expect(indexSource).not.toContain('第一阶段');
    expect(indexSource).not.toContain('依赖 SQL');
    expect(indexSource).not.toContain('库存游标 SQL');
    expect(indexSource).not.toContain('不自动启用双成本新核算');
    expect(indexSource).not.toContain('已复用');
  });

  it('keeps realtime stock readonly and focused on stock quantities without customer-facing developer notes', () => {
    expect(indexSource).toContain('StockRealtimeTable');
    expect(realtimeSource).toContain('getStockPage');
    expect(realtimeSource).toContain('getStockSummary');
    for (const field of [
      'count',
      'availableCount',
      'occupiedCount',
      'pendingInCount',
      'inTransitCount',
    ]) {
      expect(realtimeSource).toContain(`field: '${field}'`);
    }
    expect(realtimeSource).toContain('全部合计');
    expect(realtimeSource).toContain('totalStockCount');
    expect(realtimeSource).toContain('totalOccupiedCount');
    expect(realtimeSource).toContain('totalPendingInCount');
    expect(realtimeSource).toContain('totalInTransitCount');
    expect(realtimeSource).toContain("title: '采购在途'");
    expect(realtimeSource).not.toContain('实时库存复用');
    expect(realtimeSource).not.toContain('暂不展示成本金额');
    expect(realtimeSource).not.toContain('后续正式核算');
    expect(realtimeSource).not.toContain('erp.reporting.dual-cost-enabled');
    expect(realtimeSource).not.toContain('erp_stock_record_cursor');
    expect(realtimeSource).not.toContain('updateStockShelf');
    expect(realtimeSource).not.toContain('adjustStock');
    expect(realtimeSource).not.toContain("field: 'costPrice'");
    expect(realtimeSource).not.toContain("field: 'costAmount'");
    expect(realtimeSource).not.toContain("field: 'purchasePrice'");
  });

  it('实时库存明细链接和全部合计使用去尾零数量格式', () => {
    expect(realtimeSource).toContain(
      "import { formatStockReportQuantity } from './stock-report-number-format';",
    );
    expect(realtimeSource).toContain(
      'return formatStockReportQuantity(value ?? 0, 3);',
    );
    expect(realtimeSource).toMatch(
      /formatStockReportQuantity\(\s*stockSummary\.value\.totalStockCount \?\? 0,\s*3,?\s*\)/,
    );
    expect(realtimeSource).not.toContain('minimumFractionDigits: 3');
  });

  it('keeps source drilldown available without developer notes or business mutations', () => {
    expect(realtimeSource).toContain('StockQuantitySourceReadonlyModal');
    expect(realtimeSource).toContain("showSourceDetail('occupied', row)");
    expect(realtimeSource).toContain("showSourceDetail('pendingIn', row)");
    expect(realtimeSource).toContain("showSourceDetail('inTransit', row)");
    expect(sourceModalSource).toContain('getStockOccupiedDetails');
    expect(sourceModalSource).toContain('getStockPendingInDetails');
    expect(sourceModalSource).toContain('getStockInTransitDetails');
    expect(sourceModalSource).not.toContain('本弹窗只读展示库存数量来源');
    expect(sourceModalSource).not.toContain('不等同于调拨出库后的在途确认');
    expect(sourceModalSource).not.toContain(
      '不提供调整、审核、删除、导出或成本核算动作',
    );
    expect(sourceModalSource).not.toContain('updateStockShelf');
    expect(sourceModalSource).not.toContain('adjustStock');
    expect(sourceModalSource).not.toContain('exportStock');
    expect(sourceModalSource).not.toContain('PurchaseOrderForm');
    expect(sourceModalSource).not.toContain('SaleCartForm');
    expect(sourceModalSource).not.toContain('StockCheckForm');
  });

  it('reuses real stock record data for balance and trace pages with ten-row pages and export', () => {
    expect(indexSource).toContain(`v-else-if="pageKey === 'balance'"`);
    expect(indexSource).toContain('table-title="收发存汇总"');
    expect(indexSource).toContain(`v-else-if="pageKey === 'trace'"`);
    expect(indexSource).toContain('table-title="商品追溯"');
    expect(indexSource).not.toContain('收发存汇总待库存口径确认');
    expect(indexSource).not.toContain('商品追溯待业务链数据接入');
    expect(stockRecordTabSource).toContain('getStockRecordReportPage');
    expect(stockRecordTabSource).toContain('getStockRecordSummary');
    expect(stockRecordTabSource).toContain('exportStockRecordReport');
    expect(stockRecordTabSource).toContain('pageSize: 10');
    expect(stockRecordTabSource).toContain('pageSizes: [10, 20, 50, 100]');
  });

  it('adds stock profit/loss detail page without stock check mutations or internal notes', () => {
    expect(indexSource).toContain('StockCheckReadonlyTable');
    expect(stockCheckSource).toContain('getStockProfitLossDetailPage');
    expect(stockCheckSource).toContain('getStockProfitLossDetailSummary');
    expect(stockCheckSource).toContain('exportStockProfitLossDetail');
    expect(stockCheckSource).toContain('全条件合计');
    expect(stockCheckSource).toContain('const checkId = Number(row.checkId)');
    expect(stockCheckSource).toContain(
      'sourceDetailRef.value?.open(40, checkId)',
    );
    expect(stockCheckSource).not.toContain('只读复用库存盘点分页');
    expect(stockCheckSource).not.toContain('双成本、库存游标');
    expect(stockCheckSource).not.toContain('createStockCheck');
    expect(stockCheckSource).not.toContain('updateStockCheckStatus');
    expect(stockCheckSource).not.toContain('deleteStockCheck');
    expect(stockCheckSource).not.toContain('exportStockCheck(');
    expect(stockCheckSource).not.toContain('importStockCheck');
  });

  it('separates inventory page permissions by reusable report source', () => {
    expect(indexSource).toContain("hasAccessByCodes(['erp:stock:query'])");
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:stock-record:query'])",
    );
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:stock-check:query'])",
    );
    expect(indexSource).toContain('realtime: () => canQueryRealtime.value');
    expect(indexSource).toContain('movement: () => canQueryRecords.value');
    expect(indexSource).toContain('balance: () => canQueryRecords.value');
    expect(indexSource).toContain('check: () => canQueryCheck.value');
  });
});
