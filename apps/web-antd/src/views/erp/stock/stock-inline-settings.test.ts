import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(module: string) {
  return readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      module,
      'modules/item-form.vue',
    ),
    'utf8',
  );
}

function formSource(module: string) {
  return readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), module, 'modules/form.vue'),
    'utf8',
  );
}

describe('inventory inline settings integration', () => {
  it.each(['in', 'out', 'check', 'move', 'transfer-out', 'warehouse-move'])(
    '%s opts in without replacing inventory queries or selection handlers',
    (module) => {
      const code = source(module);
      const picker = code.match(/<ErpInlineStockSelect[\s\S]*?\/>/)?.[0];
      expect(picker).toContain(`settings-scope="stock-${module}"`);
      expect(picker).toContain('v-if="!disabled"');
      expect(picker).toContain(':stock-page-api="getStockPage"');
      expect(picker).toContain(
        ':stock-page-params="getInlineStockPageParams()"',
      );
      expect(picker).toContain(':require-dept="false"');
      expect(picker).not.toContain(':before-confirm=');
      expect(picker).toContain(
        '@select="(stocks) => handleInlineStockSelected(row, stocks)"',
      );
      expect(picker).toContain('@open-change="handleInlineStockOpenChange"');
      expect(code).toContain("bizType: 'stock'");
      expect(code).not.toContain('StockSelectionReviewModal');
      expect(code).not.toContain('handleBeforeInlineStockConfirm');
      expect(code).toContain('isCreateShortcutKey(event)');
      expect(code).not.toContain('allSaleProductPermission');
    },
  );

  it('warehouse move remounts for both warehouse IDs and retains opening and source-warehouse guards', () => {
    const code = source('warehouse-move');
    expect(code).toMatch(
      /:key="`\$\{fromWarehouseId \?\? ''\}:\$\{toWarehouseId \?\? ''\}`"/,
    );
    expect(code).toContain(':before-open="canOpenWarehouseMoveStockSelect"');
    expect(code).toContain(
      'if (!props.fromWarehouseId || !props.toWarehouseId)',
    );
    expect(code).toContain('props.fromWarehouseId === props.toWarehouseId');
    expect(code).toContain('warehouseId: props.fromWarehouseId');
    expect(code).toContain('count: stock.count || 0');
  });

  it('keeps inventory-specific direct-fill defaults after removing review', () => {
    const stockIn = source('in');
    const stockOut = source('out');
    const stockCheck = source('check');
    const stockMove = source('move');
    const transferOut = source('transfer-out');

    for (const code of [stockIn, stockOut, stockMove, transferOut]) {
      expect(code).toContain('count: 1');
      expect(code).toContain('product.lastPurchasePrice ?? 0');
      expect(code).toContain(
        "emit('append-items', additionalRows, 'count', replacement",
      );
    }
    expect(stockCheck).toContain('actualCount: product.count ?? 0');
    expect(stockCheck).toContain('count: 0');
    expect(stockCheck).toContain('totalPrice: 0');
    expect(stockCheck).toContain(
      "emit('append-items', additionalRows, 'count', replacement)",
    );
  });

  it.each(['in', 'out', 'check', 'move', 'transfer-out', 'warehouse-move'])(
    '%s keeps a replaced remote row as the preferred focus target',
    (module) => {
      const code = formSource(module);
      expect(code).toContain('preferredFocusItem?');
      expect(code).toContain('pageNo: previousPage.pageNo');
      expect(code).toContain('preferredFocusItem,');
      expect(code).toContain(
        'handleAppendItems(items, focusField, preferredFocusItem)',
      );
    },
  );

  it('keeps ordinary stock-out edits from reloading the entire grid', () => {
    const code = source('out');
    const handler = code.slice(
      code.indexOf('function handleRowChange'),
      code.indexOf('function refreshRowAmount'),
    );
    expect(handler).not.toContain('refreshItemGrid');
    expect(handler).toContain("emit('update:items', internalRows)");
    expect(handler).not.toContain(
      "emit('update:items', [...tableData.value]);\n  void refreshItemGrid();",
    );
  });
});
