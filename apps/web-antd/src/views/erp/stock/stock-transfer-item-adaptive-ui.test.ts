import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readStockSource(path: string) {
  return readFileSync(join(currentDir, path), 'utf8').replaceAll('\r', '');
}

function readItemColumns(path: string) {
  const source = readStockSource(path);
  const match = source.match(
    /export function useFormItemColumns\([\s\S]*?return applyStockItemColumnPermission\(columns, hiddenFields\);\n}/,
  );
  expect(match).not.toBeNull();
  return match?.[0] ?? '';
}

describe('stock transfer item adaptive layout', () => {
  it.each([
    [
      'transfer out',
      'transfer-out/data.ts',
      'transfer-out/modules/item-form.vue',
      "id: 'erp-stock-transfer-out-item-list-v2'",
    ],
    [
      'transfer in',
      'transfer-in/data.ts',
      'transfer-in/modules/form.vue',
      "id: 'erp-stock-transfer-in-item-list-v2'",
    ],
  ])(
    '%s places remark after amount and enables the trailing flexible column',
    (_, dataPath, formPath, gridId) => {
      const columns = readItemColumns(dataPath);
      const form = readStockSource(formPath);
      const totalPriceIndex = columns.indexOf("field: 'totalPrice'");
      const remarkIndex = columns.indexOf("field: 'remark'");
      const actionsIndex = columns.indexOf("field: 'actions'");

      expect(totalPriceIndex).toBeGreaterThanOrEqual(0);
      expect(remarkIndex).toBeGreaterThan(totalPriceIndex);
      if (actionsIndex !== -1)
        expect(actionsIndex).toBeGreaterThan(remarkIndex);
      expect(columns.slice(remarkIndex)).toContain('minWidth: 150');

      expect(form).toContain('trailingFlexibleColumnMinWidth: 150');
      expect(form).toContain(gridId);
      expect(form).toContain('fit: false');
      expect(form).toContain('useStockDocumentColumns({');
      expect(form).toContain('restoreStore: itemColumns.restoreStore');
      expect(form).toContain('custom: itemColumns.custom');
    },
  );

  it('adds refresh, fullscreen and column settings to the transfer-in item table', () => {
    const form = readStockSource('transfer-in/modules/form.vue');

    expect(form).toContain('custom: true');
    expect(form).toContain('queryMethod: () => handleItemToolbarRefresh()');
    expect(form).toContain('zoom: true');
    expect(form).toContain(
      "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
    );
    expect(form).toContain('<template #toolbar-tools>');
    expect(form).toContain('<span aria-hidden="true"></span>');
    expect(form).toContain('pageNo: itemPageState.value.pageNo');
    expect(form).toContain('pageSize: itemPageState.value.pageSize');
    expect(form).toContain('orderField: activeItemSort.value?.field');
    expect(form).toContain('orderDirection: activeItemSort.value?.order');
    expect(form).toContain('<span><kbd>W</kbd><b>全部价格</b></span>');
  });
});
