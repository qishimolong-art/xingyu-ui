import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormItemColumns } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);

describe('sale price adjust item adaptive layout', () => {
  it('lets editable controls consume Insert before the business shortcut', () => {
    const editableGuardIndex = itemFormSource.indexOf(
      'if (isEditableEnterTarget(event.target)) return;',
    );
    const insertShortcutIndex = itemFormSource.indexOf(
      'if (!props.disabled && isCreateShortcutKey(event))',
    );
    expect(editableGuardIndex).toBeGreaterThan(-1);
    expect(editableGuardIndex).toBeLessThan(insertShortcutIndex);
  });

  it('uses remark as the only trailing flexible business column', () => {
    const columns = useFormItemColumns(false, [], {
      rows: [{ itemRemark: '销售调价明细备注' }],
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];
    const remarkIndex = columns.findIndex(
      (column) => column.field === 'itemRemark',
    );
    const actionIndex = columns.findIndex(
      (column) => column.field === 'actions',
    );

    expect(remarkIndex).toBe(actionIndex - 1);
    expect(columns[remarkIndex]?.minWidth).toBeGreaterThanOrEqual(150);
    expect(columns[remarkIndex]?.width).toBeUndefined();
    expect(columns[actionIndex]).toMatchObject({
      fixed: 'right',
      width: 64,
    });
  });

  it('keeps long remark width and falls back to the previous visible column', () => {
    const longRemarkColumns = useFormItemColumns(true, [], {
      rows: [
        {
          itemRemark:
            '销售调价明细备注需要完整保留当前页内容计算出来的较长显示宽度',
        },
      ],
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];
    const hiddenRemarkColumns = useFormItemColumns(true, ['item_itemRemark'], {
      rows: [{ adjustReason: '价格调整' }],
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];

    expect(
      longRemarkColumns.find((column) => column.field === 'itemRemark')
        ?.minWidth,
    ).toBeGreaterThan(180);
    expect(
      hiddenRemarkColumns.find((column) => column.field === 'itemRemark'),
    ).toBeUndefined();
    expect(
      hiddenRemarkColumns.find((column) => column.field === 'adjustReason'),
    ).toMatchObject({ minWidth: 150 });
  });

  it('keeps the opt-in isolated and reapplies it after runtime column changes', () => {
    const originalColumns = useFormItemColumns(false, [], {
      rows: [{ itemRemark: '备注' }],
    }) as any[];

    const originalRemark = originalColumns.find(
      (column) => column.field === 'itemRemark',
    );
    expect(originalRemark?.width).toBeGreaterThan(0);
    expect(originalRemark?.minWidth).toBeUndefined();
    expect(itemFormSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemFormSource).toContain(
      'applySaleDocumentItemColumnCustomization',
    );
    expect(itemFormSource).toContain('custom: handleItemColumnCustom');
    expect(itemFormSource).toContain('fit: false');
    expect(itemFormSource).toContain('fitSaleDocumentItemColumnsToWidth');
    expect(itemFormSource).toContain("window.addEventListener('resize'");
  });

  it('exposes refresh, fullscreen, and persistent column settings tools', () => {
    expect(itemFormSource).toContain('custom: true');
    expect(itemFormSource).toContain('refresh: {');
    expect(itemFormSource).toContain('queryMethod: () => refreshItemGrid()');
    expect(itemFormSource).toContain('zoom: true');
    expect(itemFormSource).toContain(
      "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
    );
    expect(itemFormSource).toContain('<template #toolbar-tools>');
    expect(itemFormSource).toContain(
      "id: 'erp-sale-price-adjust-item-list-v1'",
    );
    expect(itemFormSource).toMatch(
      /customConfig:\s*\{[\s\S]*?storage:\s*\{\s*fixed:\s*true,\s*resizable:\s*true,\s*sort:\s*true,\s*visible:\s*true/,
    );
  });

  it('keeps editable detail actions beside the item grid tools', () => {
    const toolbarSlot = formSource.slice(
      formSource.indexOf('<template #toolbar>'),
      formSource.indexOf(
        '</ItemForm>',
        formSource.indexOf('<template #toolbar>'),
      ),
    );

    expect(formSource).not.toContain(
      'class="sale-price-adjust-detail-section__tools"',
    );
    expect(formSource.indexOf('sale-price-adjust-detail-count')).toBeLessThan(
      formSource.indexOf('<ItemForm'),
    );
    expect(toolbarSlot).toContain("formType !== 'detail'");
    expect(toolbarSlot).toContain('handleImport');
    expect(toolbarSlot).toContain('导入明细');
    expect(toolbarSlot).toContain('handleAddItems');
    expect(toolbarSlot).toContain('新增明细');
    expect(itemFormSource).toContain('<slot name="toolbar"></slot>');
    expect(itemFormSource).toContain('sale-price-adjust-item-toolbar');
  });
});
