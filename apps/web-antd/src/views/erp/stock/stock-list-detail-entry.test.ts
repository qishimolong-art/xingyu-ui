import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readStockSource(path: string) {
  return readFileSync(join(currentDir, path, 'index.vue'), 'utf8');
}

function readStockDataSource(path: string) {
  return readFileSync(join(currentDir, path, 'data.ts'), 'utf8');
}

describe('stock list detail entry contract', () => {
  const documentPages = [
    ['库存入库', 'in'],
    ['库存出库', 'out'],
    ['库存盘点', 'check'],
    ['调拨入库', 'transfer-in'],
    ['调拨出库', 'transfer-out'],
    ['仓库调拨', 'warehouse-move'],
    ['入仓单', 'inbill'],
    ['出仓单', 'outbill'],
    ['库存调拨历史', 'move'],
  ] as const;

  it.each(documentPages)(
    '%s opens detail only from the document number cell',
    (_name, path) => {
      const source = readStockSource(path);

      expect(source).not.toContain('function handleCellClick');
      expect(source).not.toContain('cellClick: handleCellClick');
      expect(source).not.toMatch(/cellClick:\s*\(/);
      expect(source).not.toContain('const rowActionColumnFields');
      expect(source).not.toContain('onClick: handleDetail.bind(null, row)');
      expect(source).not.toContain("label: $t('common.detail')");
      expect(source).toContain('@click.stop="handleDetail(row)"');
    },
  );

  it('adds explicit number links and removes detail-only operation columns from historical stock lists', () => {
    const inBillData = readStockDataSource('inbill');
    const outBillData = readStockDataSource('outbill');
    const moveData = readStockDataSource('move');
    const moveMainListData = moveData.slice(
      moveData.indexOf('/** 列表的字段 */'),
    );

    expect(inBillData).toContain("slots: { default: 'no' }");
    expect(inBillData).not.toContain("field: 'actions'");
    expect(outBillData).not.toContain("field: 'actions'");
    expect(moveMainListData).toContain("slots: { default: 'no' }");
    expect(moveMainListData).not.toContain("slots: { default: 'actions' }");
  });

  it('keeps stock document list operations other than detail', () => {
    const stockIn = readStockSource('in');
    const stockOut = readStockSource('out');
    const stockCheck = readStockSource('check');
    const transferOut = readStockSource('transfer-out');
    const warehouseMove = readStockSource('warehouse-move');
    const stockInBill = readStockSource('inbill');
    const stockOutBill = readStockSource('outbill');
    const stockMove = readStockSource('move');

    for (const source of [
      stockIn,
      stockOut,
      stockCheck,
      transferOut,
      warehouseMove,
    ]) {
      expect(source).toContain('onClick: handleCreate');
      expect(source).toContain('onClick: handleExport');
      expect(source).toContain('onClick: handleOpenPrintTemplateDesigner');
    }

    expect(stockIn).toContain('@click.stop="handlePrint(row)"');
    expect(stockOut).toContain('@click.stop="handlePrint(row)"');
    expect(stockOut).toContain('onClick: handleContinueBuy.bind(null, row)');
    expect(stockCheck).toContain('handleUpdateStatus.bind(null, row');
    expect(transferOut).toContain('onClick: handleContinueBuy.bind(null, row)');
    expect(warehouseMove).toContain('confirm: handleUpdateStatus.bind(');

    for (const source of [stockInBill, stockOutBill, stockMove]) {
      expect(source).toContain('onClick: handleExport');
    }
  });
});
