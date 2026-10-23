import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
} from './data';
import {
  formatWarehouseMoveCountInput,
  normalizeWarehouseMoveCount,
  parseWarehouseMoveCountText,
} from './modules/warehouse-move-item-number';
import {
  isWarehouseMoveRowDeletable,
  WAREHOUSE_MOVE_APPROVED_STATUS,
} from './warehouse-move-list-ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/stock/warehouse-move/index.ts'),
  'utf8',
);
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const stockDocumentFormLayoutSource = readFileSync(
  join(currentDir, '../components/StockDocumentFormLayout.vue'),
  'utf8',
);
const inlineStockSelectSource = readFileSync(
  join(currentDir, '../../components/ErpInlineStockSelect.vue'),
  'utf8',
);
const stockSelectModalSource = readFileSync(
  join(currentDir, 'modules/stock-select-modal.vue'),
  'utf8',
);
const vxeTableAdapterSource = readFileSync(
  join(currentDir, '../../../../adapter/vxe-table.ts'),
  'utf8',
);

describe('warehouse move page UI contract', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('keeps leading list columns scrollable and fixes only operations', () => {
    const columns = useGridColumns() as any[];

    expect(columns[0]).toMatchObject({
      autoFixed: false,
      type: 'checkbox',
      width: 36,
    });
    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(columns.find((column) => column.field === 'no')?.slots).toEqual({
      default: 'no',
    });
    expect(
      columns
        .filter((column) => column.type !== 'checkbox')
        .map((column) => column.title),
    ).toEqual([
      '删除',
      '打印',
      '移货单号',
      '移货日期',
      '移货类型',
      '移出仓库',
      '移入仓库',
      '状态',
      '拣货进度',
      '项数',
      '移货数',
      '总成本金额',
      '移货总金额',
      '经办人',
      '初审人',
      '初审时间',
      '审核人',
      '审核时间',
      '来源',
      '备注',
      '操作',
    ]);
    expect(
      columns.find((column) => column.field === 'deleteAction')?.slots,
    ).toEqual({
      default: 'deleteAction',
    });
    expect(
      columns.find((column) => column.field === 'printAction')?.slots,
    ).toEqual({
      default: 'printAction',
    });
  });

  it('uses compact teleported search options and sortable item business fields', () => {
    const selectSchemas = useGridFormSchema().filter((schema) =>
      ['ApiSelect', 'Select'].includes(schema.component as string),
    );
    selectSchemas.forEach((schema) => {
      expect(schema.componentProps).toMatchObject({
        popupClassName:
          'warehouse-move-search-select-dropdown erp-candidate-focus-popup',
      });
    });

    const itemColumns = useFormItemColumns(false) as any[];
    itemColumns
      .filter((column) => column.field && column.field !== 'actions')
      .forEach((column) => expect(column.sortable).toBe(true));
    expect(
      itemColumns.find((column) => column.type === 'seq')?.sortable,
    ).not.toBe(true);
    const actionsColumn = itemColumns.find((column) => column.title === '操作');
    expect(actionsColumn?.field).toBe('actions');
    expect(actionsColumn?.sortable).not.toBe(true);
  });

  it('communicates product keyword search supports unit tokens', () => {
    const productKeywordSchema = useGridFormSchema().find(
      (schema) => schema.fieldName === 'productKeyword',
    );

    expect(productKeywordSchema?.componentProps).toMatchObject({
      allowClear: true,
      placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
    });
  });

  it('exposes batch delete after any rows are selected and skips unavailable rows', () => {
    const rowDeleteActionSource = indexSource.slice(
      indexSource.indexOf('<template #deleteAction'),
      indexSource.indexOf('<template #printAction'),
    );

    expect(
      isWarehouseMoveRowDeletable({
        status: WAREHOUSE_MOVE_APPROVED_STATUS,
      }),
    ).toBe(false);
    expect(isWarehouseMoveRowDeletable({ status: 10 })).toBe(true);
    expect(isWarehouseMoveRowDeletable({ status: 15 })).toBe(false);
    expect(indexSource).toContain('ifShow: () => canBatchDelete');
    expect(indexSource).toContain(
      'const canBatchDelete = computed(() => checkedRows.value.length > 0);',
    );
    expect(indexSource).toContain('rows.filter((row) => isDeleteAllowed(row))');
    expect(indexSource).toContain('await deleteWarehouseMove(targetIds)');
    expect(rowDeleteActionSource).toContain("label: '删除'");
    expect(rowDeleteActionSource).not.toContain('icon:');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain(
      `\`已删除 \${targetIds.length} 条，已跳过 \${skippedCount} 条\``,
    );
    expect(indexSource).not.toContain('checkMethod:');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
  });

  it('uses confirm-pick-auto-approve actions instead of direct manual approval', () => {
    expect(indexSource).toContain("auth: ['erp:warehouse-move:confirm']");
    expect(indexSource).toContain(
      "auth: ['erp:warehouse-move:cancel-confirm']",
    );
    expect(indexSource).toContain('await confirmWarehouseMove(row.id!)');
    expect(indexSource).toContain('await cancelConfirmWarehouseMove(row.id!)');
    expect(indexSource).not.toContain("label: '审核'");
    expect(formSource).toContain('canConfirmFromDetail');
    expect(formSource).toContain('canCancelConfirmFromDetail');
    expect(formSource).toContain('拣货进度：{{ formData.pickProgress }}');
  });

  it('supports system-managed assembly moves and their voided state', () => {
    expect(apiSource).toContain('VOIDED: 30');
    expect(dataSource).toContain("{ label: '已作废', value: 30 }");
    expect(formSource).toContain('formData.value?.sourceType !== 30');
  });

  it('wires warehouse move printing through the shared template flow', () => {
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'warehouse_move'",
    );
    expect(indexSource).toContain("const PRINT_MODULE_NAME = '仓库移货单'");
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain(
      '<PrintTemplateDesignModal @printed="handleRefresh" />',
    );
    expect(indexSource).toContain('<PrintTemplateSelector');
    expect(indexSource).toContain(
      "auth: ['erp:warehouse-move:print-template']",
    );
    expect(indexSource).toContain(
      'v-access:code="[\'erp:warehouse-move:print\']"',
    );
    expect(indexSource).toContain('@click.stop="handlePrint(row)"');
    expect(indexSource).not.toContain('打印模板暂未接入');
    expect(indexSource).not.toContain('row.printCount');
  });

  it('removes the obsolete distribution marker while preserving move selection', () => {
    expect(inlineStockSelectSource).not.toContain(
      'getStockSelectionRowClassName',
    );
    expect(inlineStockSelectSource).not.toContain(
      '浅蓝色行表示仅因销售仓库分配而可见',
    );
    expect(inlineStockSelectSource).not.toContain(
      'stock-selection-sale-distribution-row',
    );
    expect(itemFormSource).toContain('<ErpInlineStockSelect');
    expect(itemFormSource).toContain(
      ':before-open="canOpenWarehouseMoveStockSelect"',
    );
    expect(itemFormSource).toContain('warehouseId: props.fromWarehouseId');
  });

  it('keeps warehouse move stock selection under the stock price-mask contract', () => {
    [
      "'productPurchasePrice'",
      "'salePrice'",
      "'lastSalePrice'",
      "'minPrice'",
      "'referencePrice'",
      "'retailPrice'",
      "'lastPurchasePrice'",
      "'grossProfitRate'",
      "'backupPrice1'",
      "'wholesalePrice'",
      "'sharePrice'",
    ].forEach((field) => expect(inlineStockSelectSource).toContain(field));

    expect(inlineStockSelectSource).toContain(
      'const INLINE_STOCK_PRICE_FIELDS',
    );
    expect(inlineStockSelectSource).toContain('function isPriceHidden');
    expect(inlineStockSelectSource).toContain('function formatStockPrice');
    expect(itemFormSource).toContain('<ErpInlineStockSelect');
    expect(itemFormSource).toContain("bizType: 'stock'");
    expect(itemFormSource).toContain(':hidden-fields="hiddenFields"');
    expect(itemFormSource).toContain(
      ':before-open="canOpenWarehouseMoveStockSelect"',
    );
    expect(stockSelectModalSource).toContain('stockNatural(cellValue)');
    expect(vxeTableAdapterSource).toContain(
      'return erpCountInputFormatter(cellValue);',
    );
  });

  it('wires full keyboard entry flow for warehouse move forms', () => {
    expect(formSource).toContain('focusFirstEditableFormControl');
    expect(formSource).toContain('focusNextEditableFormControlOnEnter');
    expect(formSource).toContain('queueFocusFirstBasicFormControl(sequence)');
    expect(formSource).toContain('@keydown.capture="handleBasicFormEnter"');
    expect(formSource).toContain(
      '@request-submit="handleLastInputEnterConfirm"',
    );
    expect(formSource).toContain('void modalApi.onConfirm()');
    expect(formSource).not.toContain('attachStockInputEnterFocus');

    expect(itemFormSource).toContain("'request-submit'");
    expect(itemFormSource).toContain('data-warehouse-move-count-input="true"');
    expect(itemFormSource).toContain('queueFocusFirstItemCountInput()');
    expect(itemFormSource).toContain('handleItemInputPressEnter');
    expect(itemFormSource).toContain("enterFocusResult === 'last-input'");
    expect(itemFormSource).toContain("emit('request-submit', event)");
    expect(itemFormSource).not.toContain(
      '@press-enter="focusNextInputOnEnter"',
    );
  });

  it('enables warehouse move stock selector keyboard navigation', () => {
    expect(inlineStockSelectSource).toContain("event.key === 'ArrowUp'");
    expect(inlineStockSelectSource).toContain("event.key === 'ArrowDown'");
    expect(inlineStockSelectSource).toContain("event.key === 'ArrowLeft'");
    expect(inlineStockSelectSource).toContain("event.key === 'ArrowRight'");
    expect(inlineStockSelectSource).toContain("event.key === 'Insert'");
    expect(inlineStockSelectSource).toContain('toggleActiveSelection()');
    expect(inlineStockSelectSource).toContain('confirmSelection()');
    expect(stockSelectModalSource).toContain(
      'shouldFocusStockGridAfterQuery = true;',
    );
    expect(stockSelectModalSource).toContain(
      'queueAfterEditableControlRender(focusStockSelectGrid);',
    );
    expect(stockSelectModalSource).toContain(
      'const shouldFocusGrid = shouldFocusStockGridAfterQuery || open.value;',
    );
    expect(itemFormSource).toContain('function handleGlobalInsertShortcut');
    expect(itemFormSource).toContain('void handleAddBlankItemRow();');
    expect(itemFormSource).toContain('warehouseId: props.fromWarehouseId');
  });

  it('keeps detail item hydration and stale-request exits intact', () => {
    expect(formSource).toContain('hydrateStockDocumentFormSelectLabels');
    expect(formSource).toContain('await getWarehouseMove(data.id,');
    expect(formSource).toContain(
      "includeItems: !['detail', 'edit'].includes(data.type)",
    );
    expect(formSource).toContain(
      'await loadWarehouseMoveItemPage({ pageNo: 1 })',
    );
    expect(formSource).toMatch(
      /await loadWarehouseMoveItemPage\(\{ pageNo: 1 \}\);\s+if \(sequence !== detailLoadSequence\) return;\s+await reloadItemForm\(\);/,
    );
    expect(formSource).toContain(
      'await formApi.setValues(buildFormValues(formData.value))',
    );
    expect(formSource).toContain(':items="formData?.items ?? EMPTY_ITEMS"');
    expect(formSource).toContain('sequence !== detailLoadSequence');
    expect(formSource).toContain('detailLoading.value = false');
  });

  it('keeps move-count typing outside reactive VXE rows', () => {
    expect(formatWarehouseMoveCountInput('10.000')).toBe('10');
    expect(formatWarehouseMoveCountInput('1.250')).toBe('1.25');
    expect(formatWarehouseMoveCountInput('0.000')).toBe('0');
    expect(parseWarehouseMoveCountText('1.')).toEqual({ ok: true, value: '1' });
    expect(parseWarehouseMoveCountText('1.250')).toEqual({
      ok: true,
      value: '1.25',
    });
    expect(parseWarehouseMoveCountText('')).toEqual({
      message: '移货数量不能为空',
      ok: false,
    });
    expect(parseWarehouseMoveCountText('-1')).toEqual({
      message: '移货数量必须为数字',
      ok: false,
    });
    expect(normalizeWarehouseMoveCount(1.2346)).toBe('1.2346');
    expect(formatWarehouseMoveCountInput(null)).toBe('');
    expect(itemFormSource).toContain('<Input\n            v-if="!disabled"');
    expect(itemFormSource).toContain(':value="getCountText(row)"');
    expect(itemFormSource).toContain('@blur="handleCountBlur(row)"');
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).toContain(
      'const countInputTextByRowKey = new Map<string, string>();',
    );
    expect(itemFormSource).toContain(
      'countInputTextByRowKey.set(getItemRowKey(row), value);',
    );
    expect(itemFormSource).not.toContain(
      '(row as EditableWarehouseMoveItem).countText = value',
    );
    expect(itemFormSource).toContain('{ forceNewRowKey: true }');
    expect(itemFormSource).toContain(
      'keys.forEach((key) => countInputTextByRowKey.delete(key));',
    );
    expect(itemFormSource).toContain(
      'item.count = normalizeWarehouseMoveCount(parsed.value)',
    );
    expect(formSource).toMatch(
      /itemFormInstance\?\.validate\(undefined,[\s\S]*?const submitItems = await buildMergedRemoteItemsForSubmit\(\)/,
    );
    expect(itemFormSource).not.toContain('<InputNumber');
  });

  it('renders detail warehouse and handler values as vertically aligned inputs', () => {
    const detailSchema = useFormSchema('detail');
    ['fromWarehouseId', 'toWarehouseId', 'handlerId'].forEach((fieldName) => {
      const field = detailSchema.find((item) => item.fieldName === fieldName);
      expect(field?.component).toBe('Input');
      expect(field?.componentProps).toMatchObject({
        allowClear: false,
        class: 'w-full stock-document-form-readonly-text',
        disabled: true,
      });
    });
    expect(stockDocumentFormLayoutSource).toContain(
      '.stock-document-form-readonly-text.ant-input-affix-wrapper',
    );
    expect(stockDocumentFormLayoutSource).toContain('line-height: 30px');
  });
});
