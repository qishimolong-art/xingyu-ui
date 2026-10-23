import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import {
  getPurchaseInvoiceDeptSimplePage,
  getPurchaseInvoiceSupplierDeptSimplePage,
  getPurchaseInvoiceUserSimplePage,
} from '#/api/erp/purchase/invoice';
import { useFormSchema, useGridColumns, useGridFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const itemSource = readFileSync(
  join(currentDir, 'modules', 'item-form.vue'),
  'utf8',
);
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const sourceSelectSource = readFileSync(
  join(currentDir, 'modules', 'purchase-in-select.vue'),
  'utf8',
);

setActivePinia(createPinia());

describe('purchase invoice page design contract', () => {
  it('preserves the configured list column order without fixed leading columns', () => {
    const columns = useGridColumns() || [];

    expect(columns.map((column) => column.field ?? column.type)).toEqual([
      'checkbox',
      'deleteAction',
      'printAction',
      'no',
      'supplierName',
      'supplierType',
      'invoiceNo',
      'invoiceType',
      'totalAmount',
      'taxAmount',
      'taxExclusiveAmount',
      'status',
      'displayTaxPercent',
      'creatorName',
      'createTime',
      'invoiceDate',
      'auditUserName',
      'auditTime',
      'remark',
      'actions',
    ]);
    expect(columns.slice(0, -1).every((column) => !column.fixed)).toBe(true);
    expect(columns.at(-1)?.fixed).toBe('right');
    expect(columns.at(-1)?.width).toBe(72);
  });

  it('uses an explicit compact popup class for every search selector', () => {
    const selectorFields = useGridFormSchema().filter((field) =>
      [
        'ApiSelect',
        'ApiTreeSelect',
        'ErpLazyPageSelect',
        'Select',
        'SupplierLazySelect',
        'TreeSelect',
      ].includes(String(field.component)),
    );

    expect(selectorFields.length).toBeGreaterThan(0);
    selectorFields.forEach((field) => {
      expect((field.componentProps as any)?.popupClassName).toBe(
        'purchase-invoice-search-select-dropdown erp-candidate-focus-popup',
      );
    });
  });

  it('uses paged lazy selectors for database-backed list filters', () => {
    const schema = useGridFormSchema();

    expect(schema.find((field) => field.fieldName === 'deptId')).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchaseInvoiceDeptSimplePage,
        labelField: 'name',
        pageSize: 10,
        valueField: 'id',
      },
    });
    for (const fieldName of ['creator', 'handlerId']) {
      expect(
        schema.find((field) => field.fieldName === fieldName),
      ).toMatchObject({
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: getPurchaseInvoiceUserSimplePage,
          labelField: 'nickname',
          pageSize: 10,
          valueField: 'id',
        },
      });
    }
  });

  it('uses supplier-scoped departments for the header without changing the list filter', () => {
    const withSupplier = useFormSchema('create', [], 100).find(
      (field) => field.fieldName === 'deptId',
    );
    const withoutSupplier = useFormSchema('create', [], undefined).find(
      (field) => field.fieldName === 'deptId',
    );
    const withSupplierProps = withSupplier?.componentProps as any;
    const withoutSupplierProps = withoutSupplier?.componentProps as any;

    expect(withSupplier).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchaseInvoiceSupplierDeptSimplePage,
        params: { supplierId: 100 },
      },
    });
    expect(withSupplierProps.shouldFetch({ supplierId: 100 })).toBe(true);
    expect(withoutSupplierProps.shouldFetch({ supplierId: undefined })).toBe(
      false,
    );
    expect(
      useGridFormSchema().find((field) => field.fieldName === 'deptId')
        ?.componentProps,
    ).toMatchObject({ api: getPurchaseInvoiceDeptSimplePage });
  });

  it('reloads and validates supplier departments across editable hydration paths', () => {
    expect(formSource).toContain('getPurchaseInvoiceSupplierDeptSimpleList');
    expect(formSource).toContain('async function refreshSupplierDeptOptions(');
    expect(formSource).toContain("clearInvalidDept: data.type !== 'detail'");
    expect(formSource).toContain('clearInvalidDept: true');
    expect(formSource).toContain('当前部门不在该供应商可用部门范围内，已清空');
    expect(formSource).toContain(
      "showPurchaseFormActionError('采购票据', error)",
    );
  });

  it('keeps the list dense, searchable, summarized, and sticky', () => {
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('submitSearchFormOnEnterAndBlur(event');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).not.toContain('footerMethod:');
    expect(indexSource).not.toContain('本页合计');
    expect(indexSource).toContain('<PurchaseListQuerySummary');
    expect(indexSource).toContain('getPurchaseInvoiceSummary');
    expect(indexSource).toContain('class="purchase-invoice-bottom-summary"');
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
  });

  it('loads the ordinary list without full detail items', () => {
    expect(indexSource.match(/includeItems: false/g)).toHaveLength(3);
  });

  it('shows batch delete for mixed selections and skips unavailable rows', () => {
    expect(indexSource).toContain('function isPurchaseInvoiceDeletable(');
    expect(indexSource).toContain('return isEditableStatus(row.status);');
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => isPurchaseInvoiceDeletable(item))',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => !isPurchaseInvoiceDeletable(item))',
    );
    expect(indexSource).toContain(
      '.filter((id): id is number => id !== undefined)',
    );
    expect(indexSource).toContain('const ids = deletableCheckedIds.value;');
    expect(indexSource).toContain(
      "message.warning('当前勾选数据没有可删除项');",
    );
    expect(indexSource).toContain('`已删除 ');
    expect(indexSource).toContain(['$', '{ids.length}'].join(''));
    expect(indexSource).toContain(['$', '{skippedCount}'].join(''));
    expect(indexSource).toContain('ifShow: () => checkedIds.length > 0');
    expect(indexSource).toContain(
      'title: `是否删除所选数据？不可删除数据将自动跳过。`',
    );
    expect(indexSource).toContain('confirm: handleBatchDelete');
    expect(indexSource).toContain(
      'ifShow: () => isPurchaseInvoiceDeletable(row)',
    );
    expect(indexSource).not.toContain('hasApprovedCheckedRows');
    expect(indexSource).not.toContain(
      'checkedIds.length > 0 && !hasApprovedCheckedRows',
    );
    expect(indexSource).not.toContain(
      'disabled: isEmpty(checkedIds) || hasApprovedCheckedRows',
    );
  });

  it('separates product code and name and keeps the source selector compact', () => {
    expect(itemSource).toContain("row.productName || '-'");
    expect(itemSource).not.toContain('row.productCode');
    expect(itemSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemSource).toContain('fit: false');
    expect(itemSource).toContain('fitPurchaseDocumentColumnsToWidth(');
    expect(sourceSelectSource).toContain('purchase-invoice-source-select');
    expect(sourceSelectSource).toContain(
      ":scroll=\"{ x: 'max-content', y: 'calc(70vh - 260px)' }\"",
    );
    expect(sourceSelectSource).toContain('font-size: 11px');
  });

  it('exposes functional refresh, fullscreen, and column settings tools on the item grid', () => {
    expect(itemSource).toContain('custom: true');
    expect(itemSource).toContain('refresh: {');
    expect(itemSource).toContain('queryMethod: () => refreshItemGrid()');
    expect(itemSource).toContain("tools: 'toolbar-tools'");
    expect(itemSource).toContain('zoom: true');
    expect(itemSource).toContain('<template #toolbar-tools>');
    expect(itemSource).toContain('<kbd>W</kbd><b>全部价格</b>');
  });

  it('shows all source types in one paged list with composite selection keys', () => {
    expect(sourceSelectSource).not.toContain('<a-tabs');
    expect(sourceSelectSource).not.toContain('sourceTabs');
    expect(sourceSelectSource).not.toContain('activeSourceType');
    expect(sourceSelectSource).toContain(
      'getPurchaseInvoiceSourceDocumentPage({',
    );
    expect(sourceSelectSource).not.toContain(
      'sourceType: activeSourceType.value',
    );
    expect(sourceSelectSource).toContain(
      ['`$', '{record.sourceType}:$', '{record.id}`'].join(''),
    );
    expect(sourceSelectSource).toContain(
      'Number(record.remainingCount ?? 0) <= 0',
    );
    expect(sourceSelectSource).toContain(
      ":page-size-options=\"['10', '20', '50']\"",
    );
    expect(formSource).toContain('const selectedSourceRefs = ref<');
    expect(formSource).toContain('getPurchaseInvoiceMixedSourceItemPage({');
    expect(formSource).toContain('sourceRefs: [...selectedSourceRefs.value]');
    expect(sourceSelectSource).toContain(
      'formatPurchaseInvoiceSourceBizTime(record.bizTime)',
    );
    expect(formSource).toContain('getSourceItemKey(');
    expect(formSource).toContain(
      'supplierId: Number(formData.value.supplierId)',
    );
    expect(itemSource).toContain('row.sourceType === 30');
  });

  it('requires invoice number on the edit form and sizes item action buttons', () => {
    const invoiceNoField = useFormSchema('create').find(
      (field) => field.fieldName === 'invoiceNo',
    );

    expect(invoiceNoField?.rules).toBe('required');
    expect(itemSource).toContain(
      ':deep(.vxe-body--column .table-actions .ant-btn-link)',
    );
    expect(itemSource).toContain('font-size: 12px');
  });

  it('formats editable invoice quantities without meaningless trailing zeros', () => {
    expect(itemSource).toContain('v-model:value="row.countText"');
    expect(itemSource).toContain('inputmode="decimal"');
    expect(itemSource).toContain('@blur="handleCountBlur(row)"');
    expect(itemSource).toContain(
      "parseDecimalText(row.countText, '本次开票数量'",
    );
    expect(itemSource).toContain('sourceRemainingCount');
    expect(itemSource).toContain("formatPurchaseDecimal(row.count, '-')");
  });

  it('keeps focus in the edited item row unless active sorting requires a refresh', () => {
    const start = itemSource.indexOf(
      'function handleRowChange(row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem)',
    );
    const end = itemSource.indexOf('function handleDelete(', start);
    const handlerSource = itemSource.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(handlerSource).toContain(
      'if (activeItemSort.value) {\n    void nextTick(refreshItemGrid);\n  }',
    );
    expect(handlerSource).not.toContain(
      'refreshItemGrid({ reloadData: false })',
    );
  });

  it('reveals detail and edit content before hydrating the conditional form', () => {
    const loadedIndex = formSource.indexOf('formData.value = loaded;');
    const revealIndex = formSource.indexOf(
      'detailLoading.value = false;',
      loadedIndex,
    );
    const nextTickIndex = formSource.indexOf('await nextTick();', revealIndex);
    const hydrateIndex = formSource.indexOf(
      'buildPurchaseDocumentDetailFormValues(',
      loadedIndex,
    );

    expect(loadedIndex).toBeGreaterThan(-1);
    expect(revealIndex).toBeGreaterThan(loadedIndex);
    expect(nextTickIndex).toBeGreaterThan(revealIndex);
    expect(hydrateIndex).toBeGreaterThan(nextTickIndex);
  });
});
