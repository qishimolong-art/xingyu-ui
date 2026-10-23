import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);

describe('stock-move page UI contract', () => {
  it('wires basic-form keyboard focus and submit flow', () => {
    expect(formSource).toContain('focusFirstEditableFormControl');
    expect(formSource).toContain('focusNextEditableFormControlOnEnter');
    expect(formSource).toContain('queueFocusFirstBasicFormControl(sequence)');
    expect(formSource).toContain('@keydown.capture="handleBasicFormEnter"');
    expect(formSource).toContain(
      '@request-submit="handleLastInputEnterConfirm"',
    );
    expect(formSource).toContain('void modalApi.onConfirm()');
    expect(formSource).toContain("formType.value !== 'detail'");
    expect(formSource).toContain('!detailLoading.value');
    expect(formSource).toContain('!detailLoadError.value');
    expect(formSource).not.toContain('attachStockInputEnterFocus');
  });

  it('submits from the last editable detail input and focuses the added row after selection', () => {
    expect(itemFormSource).toContain("'request-submit'");
    expect(itemFormSource).toContain('data-stock-move-count-input="true"');
    expect(itemFormSource).toContain(
      "itemRowFocusController.focus(focusRow, 'count')",
    );
    expect(itemFormSource).toContain(
      ':data-erp-item-row-key="getItemRowKey(row)"',
    );
    expect(itemFormSource).toContain('handleItemInputPressEnter');
    expect(itemFormSource).toContain("enterFocusResult === 'last-input'");
    expect(itemFormSource).toContain("emit('request-submit', event)");
    expect(itemFormSource).toContain('createErpItemRowFocusController');
    expect(itemFormSource).not.toContain(
      '@press-enter="focusNextInputOnEnter"',
    );
  });

  it('uses inline stock selection for stock move product rows', () => {
    expect(itemFormSource).toContain('<ErpInlineStockSelect');
    expect(itemFormSource).toContain(':stock-page-api="getStockPage"');
    expect(itemFormSource).toContain("bizType: 'stock'");
    expect(itemFormSource).toContain('function handleGlobalInsertShortcut');
    expect(itemFormSource).toContain('void handleAddBlankItemRow();');
    expect(itemFormSource).not.toContain('source="product"');
    expect(itemFormSource).not.toContain('enable-stock-shortcuts');
  });

  it('lazy-loads from and to warehouse detail selects with current row options', () => {
    expect(itemFormSource).toContain('<ErpLazyPageSelect');
    expect(itemFormSource).toContain(
      ':api="getStockMoveFromWarehouseSimplePage"',
    );
    expect(itemFormSource).toContain("getCurrentWarehouseOption(row, 'from')");
    expect(itemFormSource).toContain("getCurrentWarehouseOption(row, 'to')");
    expect(itemFormSource).toContain('hydrateMissingWarehouseNamesFromApi');
    expect(itemFormSource).toContain('mergeResolvedStockDocumentOptions');
    expect(itemFormSource).not.toContain('await getWarehouseSimpleList()');
  });
});
