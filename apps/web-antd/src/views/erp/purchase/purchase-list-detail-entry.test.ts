import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readPurchaseListSource(path: string) {
  return readFileSync(join(currentDir, path, 'index.vue'), 'utf8');
}

describe('purchase list detail entry contract', () => {
  const listPages = [
    ['采购订单', 'order'],
    ['采购入库', 'in'],
    ['采购退货', 'return'],
    ['采购票据', 'invoice'],
    ['采购调价', 'priceadjust'],
  ] as const;

  it.each(listPages)(
    '%s opens detail only from the document number cell',
    (_name, path) => {
      const source = readPurchaseListSource(path);

      expect(source).not.toContain('function handleCellClick');
      expect(source).not.toContain('cellClick: handleCellClick');
      expect(source).not.toMatch(/cellClick:\s*\(/);
      expect(source).not.toContain('const linkColumnFields');
      expect(source).toContain('@click.stop="handleDetail(row)"');
    },
  );

  it('keeps purchase order actions', () => {
    const source = readPurchaseListSource('order');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('onClick: handleImport');
    expect(source).toContain('onClick: handleOpenPurchaseIn.bind(null, row)');
    expect(source).toContain('onClick: handlePrint.bind(null, row)');
    expect(source).toContain('onClick: handleRowExport.bind(null, row)');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).toContain('confirm: handleSubmitOrder.bind(null, row)');
    expect(source).toContain(
      'confirm: handleOrderPurchaseOrder.bind(null, row)',
    );
    expect(source).toContain(
      'confirm: handleReverseSubmitOrder.bind(null, row)',
    );
    expect(source).toContain("label: '继续选购'");
  });

  it('keeps purchase inbound actions', () => {
    const source = readPurchaseListSource('in');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('onClick: handleOpenImport');
    expect(source).toContain('onClick: handlePrint.bind(null, row)');
    expect(source).toContain('onClick: handleRowExport.bind(null, row)');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).toContain('confirm: handleUpdateStatus.bind(null, row, 20)');
    expect(source).toContain("label: '继续选购'");
  });

  it('keeps purchase return actions', () => {
    const source = readPurchaseListSource('return');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('onClick: handleImport');
    expect(source).toContain('onClick: handlePrint.bind(null, row)');
    expect(source).toContain('onClick: handleRowExport.bind(null, row)');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).toContain('confirm: handleUpdateStatus.bind(null, row, 20)');
    expect(source).toContain("label: '继续选购'");
  });

  it('keeps purchase invoice actions', () => {
    const source = readPurchaseListSource('invoice');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('onClick: handleOpenImport');
    expect(source).toContain('onClick: handlePrint.bind(null, row)');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).toContain('confirm: handleUpdateStatus.bind(null, row, 20)');
  });

  it('keeps purchase price adjust actions', () => {
    const source = readPurchaseListSource('priceadjust');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('onClick: handleImport');
    expect(source).toContain('onClick: handlePrint.bind(null, row)');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).toContain('confirm: handleUpdateStatus.bind(null, row, 20)');
  });
});
