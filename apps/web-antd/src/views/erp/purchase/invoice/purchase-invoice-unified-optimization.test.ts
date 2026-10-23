import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormItemColumns } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const itemSource = readFileSync(
  join(currentDir, 'modules', 'item-form.vue'),
  'utf8',
);
const importSource = readFileSync(
  join(currentDir, 'modules', 'import-form.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'purchase',
    'invoice',
    'index.ts',
  ),
  'utf8',
);

describe('purchase invoice unified optimization contract', () => {
  it('keeps list focus passive while guarding Insert and I shortcuts', () => {
    expect(indexSource).not.toContain('useKeywordAutoFocus');
    expect(indexSource).not.toContain('focusKeywordInput');
    expect(indexSource).toContain('usePurchaseShortcut({');
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:purchase-invoice:create'])",
    );
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:purchase-invoice:import'])",
    );
    expect(indexSource).toContain('activationRefreshMaskVisible.value');
  });

  it('uses explicit width fitting and recoverable column tools', () => {
    expect(indexSource).toContain('fitPurchaseDocumentColumnsToWidth(');
    expect(indexSource).toContain('settleVxeColumnCustomization(');
    expect(indexSource).toContain('custom: true');
    expect(indexSource).toContain('zoom: true');
    expect(indexSource).toContain('fit: false');
    expect(indexSource).toContain('clearCheckboxRow');

    expect(itemSource).toContain('fitPurchaseDocumentColumnsToWidth(');
    expect(itemSource).toContain('settleVxeColumnCustomization(');
    expect(itemSource).toContain('fit: false');
  });

  it('removes the detail action column instead of reserving hidden width', () => {
    const editable = useFormItemColumns([], false) ?? [];
    const detail = useFormItemColumns([], true) ?? [];

    expect(editable.find((column) => column.field === 'actions')).toMatchObject(
      {
        fixed: 'right',
      },
    );
    expect(detail.some((column) => column.field === 'actions')).toBe(false);
  });

  it('keeps real focus styling and does not rebuild columns on ordinary edits', () => {
    expect(formSource).toContain(
      "'erp-form-focus-highlight': formType !== 'detail'",
    );
    expect(formSource).toContain(
      'void queueFocusFirstBasicFormControl(sequence);',
    );
    expect(formSource).toContain(
      ':shortcut-active="isPurchaseInvoiceFormOpen"',
    );

    const start = itemSource.indexOf('function handleRowChange(');
    const end = itemSource.indexOf('function handleCountBlur(', start);
    const handler = itemSource.slice(start, end);
    expect(handler).toContain('if (activeItemSort.value)');
    expect(handler).not.toContain('reloadColumn');
    expect(handler).not.toContain('refreshItemColumns');
  });

  it('uses decimal text inputs and keeps source prices read only', () => {
    expect(itemSource.match(/inputmode="decimal"/g)).toHaveLength(3);
    expect(itemSource).toContain('decimals: 6');
    expect(itemSource).toContain('max: 100');
    expect(itemSource).toContain('本次开票数量必须大于 0');
    expect(itemSource).toContain('row.sourceItemId !== undefined');
    expect(itemSource).toContain('row.sourceItemId !== null');
  });

  it('owns Space Shift S Q and W without enabling F or item Insert', () => {
    for (const hint of [
      '<kbd>Space</kbd><b>采购历史</b>',
      '<kbd>Shift</kbd><b>采购订单历史</b>',
      '<kbd>S</kbd><b>销售历史</b>',
      '<kbd>Q</kbd><b>报价订单历史</b>',
      '<kbd>W</kbd><b>全部价格</b>',
    ]) {
      expect(itemSource).toContain(hint);
    }
    expect(itemSource).toContain(':product-edit-enabled="false"');
    expect(itemSource).not.toContain('<kbd>F</kbd>');
    expect(itemSource).not.toContain('<kbd>Insert</kbd>');
    expect(itemSource).toContain(
      "window.addEventListener('keydown', handleShortcut, true)",
    );
    expect(itemSource).toContain(
      "window.removeEventListener('keydown', handleShortcut, true)",
    );
  });

  it('keeps import as a list-only whole-order contract', () => {
    expect(importSource).toContain('importPurchaseInvoice(uploadFile.value)');
    expect(indexSource).toContain('<ImportFormModal');
    expect(formSource).not.toContain('ImportForm');
    expect(formSource).not.toContain('importPurchaseInvoice');
    expect(itemSource).not.toContain('导入明细');
    expect(apiSource).toContain("'/erp/purchase-invoice/import'");
    expect(apiSource).not.toContain("'/erp/purchase-invoice/import-order'");
  });
});
