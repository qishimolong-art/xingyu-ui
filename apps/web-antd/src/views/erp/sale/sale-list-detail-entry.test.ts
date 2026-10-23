import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSaleListSource(path: string) {
  return readFileSync(join(currentDir, path, 'index.vue'), 'utf8');
}

describe('sale list detail entry contract', () => {
  const listPages = [
    ['销售订单', 'order'],
    ['销售报价', 'quote'],
    ['销售手推车', 'cart'],
    ['销售出库', 'out'],
    ['销售退货', 'return'],
    ['销售调价', 'priceadjust'],
  ] as const;

  it.each(listPages)(
    '%s opens detail only from the document number cell',
    (_name, path) => {
      const source = readSaleListSource(path);

      expect(source).not.toContain('function handleCellClick');
      expect(source).not.toContain('cellClick: handleCellClick');
      expect(source).not.toContain('const linkColumnFields');
      expect(source).not.toContain('const rowActionColumnFields');
      expect(source).toContain('@click.stop="handleDetail(row)"');
    },
  );

  it('removes the extra detail action from sale order operations', () => {
    const source = readSaleListSource('order');

    expect(source).not.toContain("label: $t('common.detail')");
    expect(source).not.toContain('onClick: handleDetail.bind(null, row)');
  });

  it('keeps sale order actions other than detail', () => {
    const source = readSaleListSource('order');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('onClick: handlePrint.bind(null, row)');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleUpdateStatus.bind(null, row, 20)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
  });

  it('keeps sale quote actions', () => {
    const source = readSaleListSource('quote');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('onClick: handleRowExport.bind(null, row)');
    expect(source).toContain('@click="handlePrint(row)"');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('onClick: handleConvertCart.bind(null, row)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).toContain("label: '继续选购'");
  });

  it('keeps sale cart actions', () => {
    const source = readSaleListSource('cart');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('@click="handlePrint(row)"');
    expect(source).toContain('@click="handleEmail(row)"');
    expect(source).toContain('confirm: handleConvertQuote.bind(null, row)');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).toContain('confirm: handleFirstApprove.bind(null, row)');
    expect(source).toContain('confirm: handleFinalApprove.bind(null, row)');
    expect(source).toContain('继续选购');
  });

  it('keeps sale out actions', () => {
    const source = readSaleListSource('out');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('@click="handlePrint(row)"');
    expect(source).toContain('return handleCloudPrint(row)');
    expect(source).toContain('@click="handleLocalPrint(row)"');
    expect(source).toContain('本地打印');
    expect(source).toContain('@click="handleWxNotice(row)"');
    expect(source).toContain('@click="handleQuoteDetail(row)"');
    expect(source).toContain('onClick: handlePriceAdjust.bind(null, row)');
    expect(source).toContain('onClick: handleReturn.bind(null, row)');
    expect(source).toContain('confirm: handleAudit.bind(null, row)');
  });

  it('keeps sale return actions', () => {
    const source = readSaleListSource('return');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('@click="handlePrint(row)"');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleUpdateStatus.bind(null, row, 20)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).toContain("label: '继续选购'");
  });

  it('keeps sale price adjust actions', () => {
    const source = readSaleListSource('priceadjust');

    expect(source).toContain('onClick: handleExport');
    expect(source).toContain('@click="handlePrint(row)"');
    expect(source).toContain('onClick: handleEdit.bind(null, row)');
    expect(source).toContain('confirm: handleApprove.bind(null, row)');
    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
  });
});
