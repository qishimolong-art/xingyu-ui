import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSaleListSource(path: string) {
  return readFileSync(join(currentDir, path, 'index.vue'), 'utf8');
}

describe('sale list batch delete behavior', () => {
  const listPages = [
    ['销售订单', 'order'],
    ['销售报价', 'quote'],
    ['销售手推车', 'cart'],
    ['销售退货', 'return'],
    ['销售调价', 'priceadjust'],
  ] as const;

  it.each(listPages)(
    '%s shows batch delete for any selected row and warns when none are deletable',
    (_name, path) => {
      const source = readSaleListSource(path);

      expect(source).toContain('ifShow: () => checkedIds.length > 0');
      expect(source).toContain('const ids = deletableCheckedIds.value');
      expect(source).toContain("message.warning('当前勾选数据没有可删除项')");
      expect(source).toContain('deleteSale');
    },
  );

  it.each(listPages)(
    '%s filters selected rows before calling the delete API',
    (_name, path) => {
      const source = readSaleListSource(path);

      expect(source).toContain('const deletableCheckedRows = computed');
      expect(source).toContain('const skippedCheckedRows = computed');
      expect(source).toContain('const deletableCheckedIds = computed');
      expect(source).toContain('已跳过 ${skippedCount} 条不可删除数据');
      expect(source).toContain('await handleDelete(ids, successMessage)');
      expect(source).toContain('不可删除数据将自动跳过');
    },
  );

  it('keeps the confirmed per-document delete rules', () => {
    expect(readSaleListSource('order')).toContain('return row.status !== 20');
    expect(readSaleListSource('quote')).toContain(
      'checkedRows.value.filter((item) => isEditableQuote(item))',
    );
    expect(readSaleListSource('cart')).toContain(
      'checkedRows.value.filter((item) => isBeforeFirstApprove(item))',
    );
    expect(readSaleListSource('return')).toContain(
      'checkedRows.value.filter((item) => isEditableReturn(item))',
    );
    expect(readSaleListSource('priceadjust')).toContain(
      'return row.status === 0 || row.status === 10 || row.status === 30',
    );
  });

  it('does not add a row delete visibility guard to sale order', () => {
    const source = readSaleListSource('order');

    expect(source).toContain('confirm: handleDelete.bind(null, [row.id!])');
    expect(source).not.toContain(
      'ifShow: () => isSaleOrderBatchDeletable(row)',
    );
  });
});
