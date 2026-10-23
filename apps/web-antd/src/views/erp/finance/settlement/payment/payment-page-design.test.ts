import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
} from './data';
import { sortFinancePaymentItems } from './item-sort';
import { formatFinancePaymentAmount, getFinancePaymentPageSummary } from './ui';

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
const purchaseSelectSource = readFileSync(
  join(currentDir, 'modules', 'purchase-select.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/finance/payment/index.ts'),
  'utf8',
);

describe('finance payment page design contract', () => {
  it('keeps the requested payment list fields in their exact sequence', () => {
    const columns = (useGridColumns() || []).filter(
      (column) => column.type !== 'checkbox' && column.field,
    );
    expect(columns.map((column) => column.field)).toEqual([
      'deleteAction',
      'printAction',
      'no',
      'supplierName',
      'paymentTime',
      'settleMethod',
      'accountName',
      'totalPrice',
      'paymentPrice',
      'discountPrice',
      'allocatedPrice',
      'unallocatedPrice',
      'writeOffStatus',
      'status',
      'paymentVoucherNo',
      'voucherNo',
      'creatorName',
      'auditorName',
      'auditTime',
      'printCount',
      'financeUserName',
      'printTime',
      'remark',
      'bankName',
      'actions',
    ]);
    expect(columns.map((column) => column.title)).toEqual([
      '删除',
      '打印',
      '单号',
      '供应商',
      '日期',
      '结算方式',
      '结算账户',
      '应付金额',
      '实付金额',
      '折让金额',
      '已核销金额',
      '未核销金额',
      '核销状态',
      '状态',
      '凭证号',
      '会计凭证号',
      '制单人',
      '审核人',
      '审核日期',
      '打印次数',
      '经手人',
      '打印时间',
      '备注',
      '开户行',
      '操作',
    ]);
  });

  it('keeps manual and accounting voucher numbers distinct across form, list and copy', () => {
    const paymentVoucherField = useFormSchema('create').find(
      (field) => field.fieldName === 'paymentVoucherNo',
    );
    expect(paymentVoucherField).toMatchObject({
      label: '凭证号',
      component: 'Input',
    });
    expect(paymentVoucherField?.componentProps).toMatchObject({
      maxlength: 64,
      allowClear: true,
    });
    expect(
      useFormSchema('detail').find(
        (field) => field.fieldName === 'paymentVoucherNo',
      )?.componentProps,
    ).toMatchObject({ disabled: true });
    expect(useGridFormSchema().map((field) => field.fieldName)).toEqual(
      expect.arrayContaining(['paymentVoucherNo', 'voucherNo']),
    );
    expect(
      useGridFormSchema(['paymentVoucherNo'], false).map(
        (field) => field.fieldName,
      ),
    ).not.toEqual(expect.arrayContaining(['paymentVoucherNo', 'voucherNo']));
    expect(formSource).toContain("extraCleanKeys: ['paymentVoucherNo']");
    expect(apiSource).toContain('paymentVoucherNo?: string');
    expect(indexSource).toContain("useFieldPermission('erp_voucher')");
    expect(indexSource).toContain("hasAccessByCodes(['erp:voucher:query'])");
  });

  it('summarizes the current page with stable financial formatting', () => {
    expect(
      getFinancePaymentPageSummary([
        { totalPrice: 1200, discountPrice: 20, paymentPrice: 1180 },
        { totalPrice: 800, discountPrice: 0, paymentPrice: 800 },
      ]),
    ).toEqual({
      documentCount: 2,
      totalPrice: '2000',
      discountPrice: '20',
      paymentPrice: '1980',
    });
    expect(formatFinancePaymentAmount(1_234_567.8)).toBe('1,234,567.80');
  });

  it('keeps automatic write-off hints out of the payment main list and detail', () => {
    const writeOffStatusColumn = useGridColumns()?.find(
      (column) => column.field === 'writeOffStatus',
    );
    expect(writeOffStatusColumn?.slots).toBeUndefined();
    expect(typeof writeOffStatusColumn?.formatter).toBe('function');
    expect(apiSource).not.toContain('hasAutoWriteOff?: boolean');
    expect(apiSource).not.toContain('autoWriteOffCount?: number');
    expect(apiSource).not.toContain('autoWriteOffAmount?: number');
    expect(apiSource).not.toContain('autoWriteOff?: boolean');
    expect(indexSource).not.toContain('finance-payment-auto-writeoff-row');
    expect(indexSource).not.toContain('含系统自动核销明细');
    expect(indexSource).not.toContain('浅橙色行表示含系统自动核销明细');
    expect(indexSource).not.toContain('<template #writeOffStatus="{ row }">');
    expect(indexSource).not.toContain('getAutoWriteOffTitle(row)');
    expect(itemSource).not.toContain('payment-item-form__auto-writeoff-row');
    expect(itemSource).not.toContain('row.autoWriteOff');
    expect(itemSource).not.toContain(
      '该明细由系统在付款单审核通过后自动生成核销',
    );
  });

  it('right-aligns financial values and keeps the actual payment prominent', () => {
    const listAmounts = useGridColumns()?.filter((column) =>
      ['discountPrice', 'paymentPrice', 'totalPrice'].includes(
        String(column.field),
      ),
    );
    expect(listAmounts).toHaveLength(3);
    listAmounts?.forEach((column) => {
      expect(column.align).toBe('right');
      expect(column.headerAlign).toBe('right');
    });
    expect(
      listAmounts?.find((column) => column.field === 'paymentPrice')?.className,
    ).toContain('finance-payment-amount-cell--actual');

    const detailAmounts = useFormItemColumns(false)?.filter((column) =>
      ['paidPrice', 'paymentPrice', 'totalPrice', 'unPaymentPrice'].includes(
        String(column.field),
      ),
    );
    detailAmounts?.forEach((column) => {
      expect(column.align).toBe('right');
    });
  });

  it('requires a payment account in create and edit modes', () => {
    for (const formType of ['create', 'edit']) {
      const accountField = useFormSchema(formType).find(
        (field) => field.fieldName === 'accountId',
      );

      expect(accountField?.rules).toBe('required');
    }
  });

  it('allows signed non-zero payment amounts while keeping discount non-negative', () => {
    const formSchema = useFormSchema('create');
    const supplierField = formSchema.find(
      (field) => field.fieldName === 'supplierId',
    );
    const totalRule = formSchema.find(
      (field) => field.fieldName === 'totalPrice',
    )?.rules as { safeParse: (value: unknown) => { success: boolean } };
    const paymentRule = formSchema.find(
      (field) => field.fieldName === 'paymentPrice',
    )?.rules as { safeParse: (value: unknown) => { success: boolean } };
    const discountRule = formSchema.find(
      (field) => field.fieldName === 'discountPrice',
    )?.rules as { safeParse: (value: unknown) => { success: boolean } };

    expect(supplierField?.component).toBe('SupplierLazySelect');
    expect((supplierField?.componentProps as any)?.api).toBeUndefined();
    expect(totalRule.safeParse(-20).success).toBe(true);
    expect(totalRule.safeParse(0).success).toBe(false);
    expect(paymentRule.safeParse(-20).success).toBe(true);
    expect(paymentRule.safeParse(0).success).toBe(false);
    expect(discountRule.safeParse(0).success).toBe(true);
    expect(discountRule.safeParse(-0.01).success).toBe(false);
  });

  it('sorts payment items stably with numeric values and blanks last', () => {
    const rows = [
      { bizNo: 'B', paymentPrice: 20 },
      { bizNo: '', paymentPrice: 3 },
      { bizNo: 'A', paymentPrice: 3 },
      { bizNo: 'A', paymentPrice: 3, marker: 'stable' },
    ];
    expect(
      sortFinancePaymentItems(rows, 'paymentPrice', 'asc').map(
        (row) => row.bizNo,
      ),
    ).toEqual(['', 'A', 'A', 'B']);
    expect(
      sortFinancePaymentItems(rows, 'bizNo', 'desc').map((row) => row.bizNo),
    ).toEqual(['B', 'A', 'A', '']);
    expect(sortFinancePaymentItems(rows, 'bizNo', 'asc')[1]?.marker).toBe(
      'stable',
    );
  });

  it('matches the sales-cart fullscreen four-column form contract', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'payment-form__basic-grid grid-cols-4'",
    );
    expect(formSource).toContain("layout: 'horizontal'");
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain(
      "'payment-form--editable': formType !== 'detail'",
    );
    expect(formSource).not.toContain('付款单录入流程');
    expect(formSource).toContain('基础信息');
    expect(formSource).toContain('付款明细');
    expect(formSource).toContain('单据合计');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain(
      ':deep(.payment-form__basic-grid > div > label)',
    );
    for (const formType of ['create', 'edit', 'detail']) {
      const formSchema = useFormSchema(formType);
      expect(
        formSchema.find((field) => field.fieldName === 'remark')?.formItemClass,
      ).toBe('payment-form__full-row');
      expect(
        formSchema.find((field) => field.fieldName === 'fileUrl')
          ?.formItemClass,
      ).toBe('payment-form__full-row');
    }
  });

  it('prefills payment create form from payable misc with source fields and no write-off item', () => {
    const sourceDefaultsSource = formSource.slice(
      formSource.indexOf('function buildSourcePayableMiscDefaults'),
      formSource.indexOf('function isLatestOpen'),
    );

    expect(formSource).toContain(
      'sourcePayableMisc?: ErpPayableMiscApi.PayableMisc',
    );
    expect(sourceDefaultsSource).toContain('supplierId: source.supplierId');
    expect(sourceDefaultsSource).toContain('supplierName: source.supplierName');
    expect(sourceDefaultsSource).toContain('accountId: source.accountId');
    expect(sourceDefaultsSource).toContain('accountName: source.accountName');
    expect(sourceDefaultsSource).toContain('deptId: source.deptId');
    expect(sourceDefaultsSource).toContain('financeUserId: source.handlerId');
    expect(sourceDefaultsSource).toContain('sourcePayableMiscId: source.id');
    expect(sourceDefaultsSource).toContain('sourcePayableMiscNo: source.no');
    expect(sourceDefaultsSource).toContain('items: []');
    expect(sourceDefaultsSource).not.toContain('ErpBizType.PAYABLE_MISC');
    expect(sourceDefaultsSource).not.toContain('bizId: source.id!');
    expect(sourceDefaultsSource).toContain('`由其他应付单 ');
    expect(sourceDefaultsSource).toContain('source.no');
    expect(sourceDefaultsSource).toContain(' 转入`');
    expect(sourceDefaultsSource).toContain(
      'const amount = normalizeFinanceAmount(source.transferAvailableAmount)',
    );
    expect(sourceDefaultsSource).toContain('totalPrice: amount as any');
    expect(sourceDefaultsSource).toContain('discountPrice: 0 as any');
    expect(sourceDefaultsSource).toContain('paymentPrice: amount');
    expect(formSource).toContain(
      'sourcePayableMiscId: formData.value.sourcePayableMiscId',
    );
    expect(formSource).toContain(
      'sourcePayableMiscNo: formData.value.sourcePayableMiscNo',
    );
    expect(formSource).toContain('data?.sourcePayableMisc');
    expect(formSource).toContain('syncCurrentSupplierOption(formData.value)');
    expect(formSource).toContain(
      'await itemFormRef.value?.setImportedItems(formData.value.items || [])',
    );
    expect(formSource).toContain(
      'itemPagination.total = formData.value.items?.length || 0',
    );
    expect(formSource).toContain('totalPrice: formData.value.totalPrice');
    expect(formSource).toContain('paymentPrice: formData.value.paymentPrice');
    expect(formSource).toContain('label: supplier.supplierName');
    expect(formSource).toContain('value: supplier.supplierId');
  });

  it('keeps compact list, selection and document totals at their point of use', () => {
    expect(indexSource).toContain('class="finance-payment-summary"');
    expect(indexSource).toContain('<FinanceListQuerySummary');
    expect(indexSource).toContain(':items="querySummaryItems"');
    expect(indexSource).toContain("label: '实付金额'");
    expect(purchaseSelectSource).toContain(
      'class="payment-purchase-select__summary"',
    );
    expect(purchaseSelectSource).toContain('付款后未核销');
    expect(formSource).toContain('class="payment-form__document-summary"');
  });

  it('orders selectable purchase documents by create time and previews automatic write-off', () => {
    expect(formSource).toContain(':document-total-price="formData.totalPrice"');
    expect(apiSource).toContain('/erp/finance-payment/form-candidates');
    expect(apiSource).toContain('/erp/finance-payment/form-candidate-page');
    expect(apiSource).toContain('FinancePaymentFormCandidate');
    expect(purchaseSelectSource).toContain(
      'getFinancePaymentFormCandidatePage({',
    );
    expect(purchaseSelectSource).not.toContain('getPurchaseInPage');
    expect(purchaseSelectSource).not.toContain('getPurchaseReturnPage');
    expect(purchaseSelectSource).not.toContain('getPurchasePriceAdjustPage');
    expect(purchaseSelectSource).not.toContain('paymentEnable');
    expect(purchaseSelectSource).not.toContain('refundEnable');
    expect(purchaseSelectSource).not.toContain('fetchAllPages');
    expect(purchaseSelectSource).toContain('createTime: row.createTime');
    expect(purchaseSelectSource).toContain(
      'selectedItems: getCandidateSelections()',
    );
    expect(purchaseSelectSource).toContain('selectedRowMap');
    expect(purchaseSelectSource).toContain("keyField: 'clientRowKey'");
    expect(purchaseSelectSource).toContain('response.autoWriteOffCount');
    expect(purchaseSelectSource).toContain('autoWriteOffPreviewMap');
    expect(purchaseSelectSource).toContain('autoWriteOffPreviewDisabled');
    expect(purchaseSelectSource).toContain(
      'if (props.autoWriteOffPreviewDisabled) return result',
    );
    expect(purchaseSelectSource).toContain(
      'payment-purchase-select__auto-writeoff-row',
    );
    expect(purchaseSelectSource).toContain('预计自动');
    expect(purchaseSelectSource).toContain('审核通过后预计由系统自动核销');
    expect(purchaseSelectSource).toContain('浅橙色行表示审核后预计自动核销');
    expect(purchaseSelectSource).toContain(
      'v-if="!autoWriteOffPreviewDisabled"',
    );
    expect(formSource).toContain('getAutoWriteOffConfig()');
    expect(formSource).toContain('effectiveAutoWriteOffDisabledDeptIds');
    expect(formSource).toContain('autoWriteOffPreviewDisabled');
    expect(formSource).toContain(
      ':auto-write-off-preview-disabled="autoWriteOffPreviewDisabled"',
    );
    expect(purchaseSelectSource).toContain('createTime: _createTime');
    expect(purchaseSelectSource).toContain('unPaymentPrice: _unPaymentPrice');
    expect(purchaseSelectSource).toContain('Number(row.unallocatedPrice ??');
    expect(purchaseSelectSource).toContain('getOutstandingPrice(row)');
  });

  it('uses the sales-cart compact type scale for payment tables', () => {
    for (const source of [indexSource, itemSource, purchaseSelectSource]) {
      expect(source).toContain('font-size: 12px');
      expect(source).toContain('font-variant-numeric: tabular-nums');
    }
    expect(itemSource).toContain('font-size: 11px');
    expect(purchaseSelectSource).toContain('font-size: 11px');
  });

  it('fixes only operation columns and keeps business columns sortable', () => {
    const listColumns = useGridColumns() || [];
    expect(listColumns[0]?.fixed).toBeUndefined();
    expect(listColumns.find((column) => column.field === 'no')?.fixed).toBe(
      undefined,
    );
    expect(listColumns.at(-1)?.fixed).toBe('right');

    const itemColumns = useFormItemColumns(false) || [];
    expect(itemColumns[0]?.fixed).toBeUndefined();
    expect(
      itemColumns.find((column) => column.field === 'bizNo')?.sortable,
    ).toBe(true);
    expect(itemColumns.at(-1)?.fixed).toBe('right');
    expect(indexSource).toContain("orders: ['asc', 'desc', null]");
  });

  it('has explicit detail loading success/failure exits', () => {
    expect(formSource).toContain('detailLoading.value = true');
    expect(formSource).toContain('getErpDetailLoadError(');
    expect(formSource).toContain('付款单加载失败，请关闭后重试');
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain('if (!isLatestOpen(requestId)) return');
    expect(formSource).toContain('v-if="detailLoading"');
    expect(formSource).toContain('v-else-if="detailLoadError"');
    expect(formSource).toContain('v-show="!detailLoading && !detailLoadError"');
    expect(formSource).not.toContain(
      '<div v-else class="payment-form__content">',
    );
    expect(itemSource).toContain('{ immediate: true, deep: true }');
  });

  it('preserves core payment interactions around the visual changes', () => {
    expect(indexSource).not.toContain('handleCellClick');
    expect(indexSource).not.toContain('cellClick: handleCellClick');
    expect(indexSource).not.toContain('const rowActionColumnFields');
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'finance_payment'",
    );
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain('PrintTemplateSelector');
    expect(indexSource).toContain("auth: ['erp:finance-payment:print']");
    expect(indexSource).toContain(
      "auth: ['erp:finance-payment:print-template']",
    );
    expect(indexSource).toContain('<template #deleteAction="{ row }">');
    expect(indexSource).toContain('<template #printAction="{ row }">');
    expect(indexSource).toContain('handleUpdateStatus');
    expect(indexSource).toContain('handleBatchDelete');
    expect(indexSource).toContain('handleImport');
    expect(indexSource).toContain("auth: ['erp:finance-payment:writeoff']");
    expect(itemSource).toContain(
      "auth: ['erp:finance-payment:writeoff-reverse']",
    );
    expect(formSource).toContain('handleReverseWriteOff');
    expect(indexSource).toContain('handleSearchEnter');
    expect(indexSource).toContain('ifShow: () => checkedRows.length > 0');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain('message.success(`已删除 ');
    expect(indexSource).toContain('条，已跳过 ');
    expect(indexSource).toContain('skippedCount} 条`');
    expect(formSource).toContain('async onConfirm()');
    expect(formSource).toContain('切换供应商后会清空已引入的付款明细');
    expect(formSource).toContain('await modalApi.close()');
    expect(purchaseSelectSource).toContain('handleCheckboxChange');
    expect(purchaseSelectSource).toContain('change:');
  });

  it('filters payable documents by department without rewriting row departments', () => {
    expect(formSource).toContain(':dept-id="formData.deptId"');
    expect(purchaseSelectSource).toContain('const deptId = props.deptId');
    expect(purchaseSelectSource).toContain('supplierId,\n      deptId,');
    expect(purchaseSelectSource).toContain(
      'watch(() => [props.supplierId, props.deptId], reloadData',
    );
    expect(purchaseSelectSource).toContain(
      'deptName: row.deptName || current?.deptName || _contextDeptName',
    );
    expect(purchaseSelectSource).not.toContain('Object.assign(row, context)');
  });
});
