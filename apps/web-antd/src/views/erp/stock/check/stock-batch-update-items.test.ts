import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const stockDir = resolve(currentDir, '..');

function readStockSource(path: string) {
  return readFileSync(join(stockDir, path), 'utf8');
}

describe('stock item batch warehouse update wiring', () => {
  it('wires the common modal to stock document APIs', () => {
    const source = readStockSource(
      'components/stock-batch-update-items-form.vue',
    );

    expect(source).toContain('batchUpdateStockInItems');
    expect(source).toContain('batchUpdateStockOutItems');
    expect(source).toContain('batchUpdateStockCheckItems');
    expect(source).toContain('getStockInWarehouseDeptSimpleList');
    expect(source).toContain('getStockOutWarehouseDeptSimpleList');
    expect(source).toContain('getStockCheckWarehouseDeptSimpleList');
    expect(source).toContain('StockBatchDocumentType');
    expect(source).toContain('warehouseId');
    expect(source).toContain('itemCount');
    expect(source).toContain('const currentIsLocalMode = !currentDocumentId');
    expect(source).toContain('const currentDocumentId = documentId.value');
    expect(source).toContain('const currentDocumentType = documentType.value');
    expect(source).toContain('const currentItemIds = [...itemIds.value]');
    expect(source).toContain(
      'const currentSelectedCount = currentItemIds.length || itemCount.value',
    );
    expect(source).toContain('currentDocumentType,');
    expect(source).toContain('currentDocumentId,');
    expect(source).toContain("emit('success', payload)");
    expect(source).toContain(
      'message.success(`已批量更新 ${currentSelectedCount} 条库存明细`)',
    );
    expect(source).not.toContain(
      'message.success(`已批量更新 ${selectedCount.value} 条库存明细`)',
    );
    expect(source).toContain('批量修改');
    expect(source).toContain('仓库/部门');
  });

  it('adds item selection, local updates and refresh callbacks to all three forms', () => {
    const cases = [
      {
        api: readFileSync(
          resolve(stockDir, '../../../api/erp/stock/in/index.ts'),
          'utf8',
        ),
        createAccess: 'erp:stock-in:create',
        documentProp: ':in-id="formData?.id"',
        form: readStockSource('in/modules/form.vue'),
        item: readStockSource('in/modules/item-form.vue'),
        updateApi: 'batchUpdateStockInItems',
        updateAccess: 'erp:stock-in:update',
      },
      {
        api: readFileSync(
          resolve(stockDir, '../../../api/erp/stock/out/index.ts'),
          'utf8',
        ),
        createAccess: 'erp:stock-out:create',
        documentProp: ':out-id="formData?.id"',
        form: readStockSource('out/modules/form.vue'),
        item: readStockSource('out/modules/item-form.vue'),
        updateApi: 'batchUpdateStockOutItems',
        updateAccess: 'erp:stock-out:update',
      },
      {
        api: readFileSync(
          resolve(stockDir, '../../../api/erp/stock/check/index.ts'),
          'utf8',
        ),
        createAccess: 'erp:stock-check:create',
        documentProp: ':check-id="formData?.id"',
        form: readStockSource('check/modules/form.vue'),
        item: readStockSource('check/modules/item-form.vue'),
        updateApi: 'batchUpdateStockCheckItems',
        updateAccess: 'erp:stock-check:update',
      },
    ];

    for (const itemCase of cases) {
      expect(itemCase.api).toContain(itemCase.updateApi);
      expect(itemCase.api).toContain('warehouse-dept-simple-list');
      expect(itemCase.form).toContain('const canBatchUpdateItems = computed');
      expect(itemCase.form).toContain("formType.value === 'create'");
      expect(itemCase.form).toContain("formType.value === 'edit'");
      expect(itemCase.form).toContain(
        ':enable-batch-edit="canBatchUpdateItems"',
      );
      expect(itemCase.form).toContain(itemCase.documentProp);
      expect(itemCase.form).toContain(
        '@batch-update-success="handleBatchUpdateItemsSuccess"',
      );
      expect(itemCase.form).toContain('getItemFormInstance');
      expect(itemCase.form).toContain('await nextTick()');
      expect(itemCase.form).toMatch(
        /reloadItemsFromProps\?\.\(\)|loadStock(?:In|Out|Check)ItemPage/,
      );
      expect(itemCase.item).toContain('StockBatchUpdateItemsForm');
      expect(itemCase.item).toContain("type: 'checkbox'");
      expect(itemCase.item).toContain('canBatchUpdateItemRow');
      expect(itemCase.item).toContain('selectedBatchItemCount');
      expect(itemCase.item).toContain(
        "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
      );
      expect(itemCase.item).toContain('stock-document-item-batch-summary');
      expect(itemCase.item).toContain('applyLocalBatchUpdateItems');
      expect(itemCase.item).toContain('ApplyBatchUpdateItemsOptions');
      expect(itemCase.item).toContain('showMessage?: boolean');
      expect(itemCase.item).toContain('syncItemsFromProps');
      expect(itemCase.item).toContain('reloadItemsFromProps');
      expect(itemCase.item).toContain('showMessage: !props.disabled');
      expect(itemCase.item).toContain("emit('batch-update-success')");
      expect(itemCase.item).toContain('warehouseDeptId');
      expect(itemCase.item).toContain('warehouseDeptName');
      expect(itemCase.item).toContain('documentId: props.disabled');
      expect(itemCase.item).toContain(itemCase.createAccess);
      expect(itemCase.item).toContain(itemCase.updateAccess);
      expect(itemCase.item).toContain('批量修改仓库/部门');
      expect(itemCase.item).toContain('handleOpenBatchUpdateItems');
      expect(itemCase.item).toContain('clearBatchItemSelection');
    }
  });

  it('keeps inventory-specific local batch side effects', () => {
    const stockInItem = readStockSource('in/modules/item-form.vue');
    const stockOutItem = readStockSource('out/modules/item-form.vue');
    const stockCheckItem = readStockSource('check/modules/item-form.vue');

    expect(stockInItem).toContain(
      'getStockCount(row.productId, row.warehouseId)',
    );
    expect(stockOutItem).toContain(
      'getStockCount(row.productId, row.warehouseId)',
    );
    expect(stockCheckItem).toContain('item.batchNo = undefined');
    expect(stockCheckItem).toContain('await loadBatchNoOptions(row)');
    expect(stockCheckItem).toContain('row.actualCount = row.stockCount || 0');
    expect(stockCheckItem).toContain(
      'seq: (item as StockCheckFormItem).seq ?? item.id ?? index + 1',
    );
  });
});
