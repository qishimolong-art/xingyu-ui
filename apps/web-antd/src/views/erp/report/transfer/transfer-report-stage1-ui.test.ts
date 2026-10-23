import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('business report M4 transfer real-data pages', () => {
  it('renders six independent report pages with a shared real-data shell', () => {
    for (const title of [
      '调拨出入库台账',
      '调拨在途明细',
      '仓库移货明细报表',
      '调拨差价分析',
      '调拨链路追踪',
      '历史调拨口径',
    ]) {
      expect(source).toContain(title);
    }
    expect(source).toContain("| 'in-transit'");
    expect(source).toContain("| 'price-difference'");
    expect(source).toContain("| 'chain'");
    expect(source).toContain('const DEFAULT_PAGE_SIZE = 10');
    expect(source).toContain(":page-size-options=\"['10', '20', '50']\"");
    expect(source).toContain('导出');
  });

  it('connects existing transfer, ledger and warehouse move APIs', () => {
    for (const apiName of [
      'getStockTransferLedgerPage',
      'getStockTransferLedgerTotal',
      'exportStockTransferLedger',
      'getStockTransferOutPage',
      'exportStockTransferOut',
      'getStockTransferInPage',
      'exportStockTransferIn',
      'getWarehouseMovePage',
      'getWarehouseMoveSummary',
      'exportWarehouseMove',
    ]) {
      expect(source).toContain(apiName);
    }
    expect(source).toContain("params.matchStatus = 'ABNORMAL'");
    expect(source).toContain("historyType: 'transferOut'");
  });

  it('keeps customer pages free from internal development notes', () => {
    for (const phrase of [
      '第一阶段',
      '只读复用',
      '依赖 SQL',
      '未完成原因',
      '后续接入',
      '待客户确认',
      '双成本开关',
      '库存游标',
      '不提供新增',
      '待数据接入',
    ]) {
      expect(source).not.toContain(phrase);
    }
    expect(source).toContain('待规则确认');
    expect(source).toContain('不可计算');
  });

  it('uses business report route authorization with old query permissions only as fallback', () => {
    expect(source).toContain('/erp/business-report/transfer');
    expect(source).toContain('canCurrentMenu.value ||');
    expect(source).toContain('erp:stock-transfer-ledger:query');
    expect(source).toContain('erp:stock-transfer-out:query');
    expect(source).toContain('erp:stock-transfer-in:query');
    expect(source).toContain('erp:warehouse-move:query');
  });
});
