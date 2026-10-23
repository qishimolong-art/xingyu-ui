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
import {
  formatFinanceReceiptAmount,
  getFinanceReceiptPageSummary,
  normalizeFinanceReceiptFormDates,
  toFinanceReceiptDisplayDate,
} from './ui';

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
const saleSelectSource = readFileSync(
  join(currentDir, 'modules', 'sale-select.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'finance',
    'receipt',
    'index.ts',
  ),
  'utf8',
);

function getTemplateSlot(source: string, name: string) {
  const marker = `#${name}`;
  const markerIndex = source.indexOf(marker);
  const start = source.lastIndexOf('<template', markerIndex);
  if (start === -1) return '';
  const end = source.indexOf('</template>', start);
  return source.slice(start, end);
}

const centerFooterSource = getTemplateSlot(formSource, 'center-footer');
const prependFooterSource = getTemplateSlot(formSource, 'prepend-footer');

describe('finance receipt page design contract', () => {
  it('normalizes API timestamps before filling date pickers', () => {
    const source = {
      no: 'SKD20260721000001',
      customerId: 1,
      receiptTime: 1_784_601_593_000,
      totalPrice: 1000,
      discountPrice: 0,
      receiptPrice: 1000,
      status: 10,
      remark: '',
      createTime: '2026-07-21T10:40:11',
      updateTime: '1784601611000',
    };

    expect(normalizeFinanceReceiptFormDates(source)).toMatchObject({
      receiptTime: '1784601593000',
      createTime: String(Date.parse('2026-07-21T10:40:11')),
      updateTime: '1784601611000',
    });
    expect(source.receiptTime).toBe(1_784_601_593_000);
    expect(toFinanceReceiptDisplayDate('1784601593000')).toBe(
      1_784_601_593_000,
    );
    expect(toFinanceReceiptDisplayDate('2026-07-21T10:40:11')).toBe(
      '2026-07-21T10:40:11',
    );

    const dateFields = useFormSchema('detail').filter((field) =>
      ['createTime', 'receiptTime', 'updateTime'].includes(field.fieldName),
    );
    expect(dateFields.map((field) => field.fieldName)).toEqual(['receiptTime']);
    for (const field of dateFields) {
      expect(field.componentProps).toMatchObject({ valueFormat: 'x' });
    }
    expect(formSource).toContain('const receiptTime = String(Date.now())');
  });

  it('keeps the requested receipt list fields in their exact sequence', () => {
    const columns = (useGridColumns() || []).filter(
      (column) => column.type !== 'checkbox' && column.field,
    );
    expect(columns.map((column) => column.field)).toEqual([
      'deleteAction',
      'printAction',
      'no',
      'customerName',
      'receiptTime',
      'settleMethod',
      'accountName',
      'totalPrice',
      'discountPrice',
      'receiptPrice',
      'allocatedPrice',
      'unallocatedPrice',
      'writeOffStatus',
      'status',
      'remark',
      'paymentVoucherNo',
      'voucherNo',
      'financeUserName',
      'auditorName',
      'auditTime',
      'bankName',
      'actions',
    ]);
    expect(columns.map((column) => column.title)).toEqual([
      '删除',
      '打印',
      '单号',
      '客户',
      '日期',
      '结算方式',
      '结算账户',
      '总结算金额',
      '折让金额',
      '实收总金额',
      '已核销金额',
      '未核销金额',
      '核销状态',
      '状态',
      '备注',
      '凭证号',
      '会计凭证号',
      '经手人',
      '审核人',
      '审核日期',
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
      getFinanceReceiptPageSummary([
        { totalPrice: 1200, discountPrice: 20, receiptPrice: 1180 },
        { totalPrice: 800, discountPrice: 0, receiptPrice: 800 },
      ]),
    ).toEqual({
      documentCount: 2,
      totalPrice: '2000',
      discountPrice: '20',
      receiptPrice: '1980',
    });
    expect(formatFinanceReceiptAmount(1_234_567.8)).toBe('1,234,567.80');
  });

  it('right-aligns financial values and keeps the actual receipt prominent', () => {
    const listAmounts = useGridColumns()?.filter((column) =>
      ['discountPrice', 'receiptPrice', 'totalPrice'].includes(
        String(column.field),
      ),
    );
    expect(listAmounts).toHaveLength(3);
    listAmounts?.forEach((column) => {
      expect(column.align).toBe('right');
      expect(column.headerAlign).toBe('right');
    });
    expect(
      listAmounts?.find((column) => column.field === 'receiptPrice')?.className,
    ).toContain('finance-receipt-amount-cell--actual');

    const detailAmounts = useFormItemColumns(false)?.filter((column) =>
      [
        'receiptedPrice',
        'receiptPrice',
        'totalPrice',
        'unReceiptedPrice',
      ].includes(String(column.field)),
    );
    detailAmounts?.forEach((column) => {
      expect(column.align).toBe('right');
    });
  });

  it('requires a receipt account in create and edit modes', () => {
    for (const formType of ['create', 'edit']) {
      const accountField = useFormSchema(formType).find(
        (field) => field.fieldName === 'accountId',
      );

      expect(accountField?.rules).toBe('required');
    }
  });

  it('reuses the sales-cart fullscreen four-column form contract', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'receipt-form__basic-grid grid-cols-4'",
    );
    expect(formSource).toContain("layout: 'horizontal'");
    expect(formSource).toContain('class="!w-full"');
    expect(formSource).toContain(
      "'receipt-form__base-form--editable': formType !== 'detail'",
    );
    expect(formSource).not.toContain('receipt-form__workflow');

    const selectFields = useFormSchema('create').filter((field) =>
      ['accountId', 'customerId', 'deptId', 'financeUserId'].includes(
        field.fieldName,
      ),
    );
    expect(selectFields).toHaveLength(4);
    selectFields.forEach((field) => {
      expect(field.componentProps).toMatchObject({
        popupClassName: 'finance-receipt-form-select-dropdown',
      });
    });
    const createSchema = useFormSchema('create');
    expect(
      createSchema.find((field) => field.fieldName === 'customerId')?.component,
    ).toBe('CustomerLazySelect');
    expect(
      createSchema.find((field) => field.fieldName === 'deptId')?.component,
    ).toBe('ApiTreeSelect');
  });

  it('loads receipt form departments from the selected customer only', () => {
    expect(apiSource).toContain(
      '/erp/finance-receipt/customer-dept-simple-list?customerId=',
    );
    expect(formSource).not.toContain('getSimpleDeptList()');
    expect(formSource).toContain('refreshCustomerDeptOptions');
    expect(formSource).toContain('clearInvalidDept: true');
    expect(formSource).toContain('selectedDeptId: values.deptId');
  });

  it('prefills receipt create form from receivable misc with source fields and no write-off item', () => {
    const sourceDefaultsSource = formSource.slice(
      formSource.indexOf('function buildSourceReceivableMiscDefaults'),
      formSource.indexOf('function isLatestOpen'),
    );

    expect(formSource).toContain(
      'sourceReceivableMisc?: ErpReceivableMiscApi.ReceivableMisc',
    );
    expect(sourceDefaultsSource).toContain('customerId: source.customerId');
    expect(sourceDefaultsSource).toContain('customerName: source.customerName');
    expect(sourceDefaultsSource).toContain('accountId: source.accountId');
    expect(sourceDefaultsSource).toContain('accountName: source.accountName');
    expect(sourceDefaultsSource).toContain('deptId: source.deptId');
    expect(sourceDefaultsSource).toContain('financeUserId: source.handlerId');
    expect(sourceDefaultsSource).toContain('sourceReceivableMiscId: source.id');
    expect(sourceDefaultsSource).toContain('sourceReceivableMiscNo: source.no');
    expect(sourceDefaultsSource).toContain('items: []');
    expect(sourceDefaultsSource).not.toContain('ErpBizType.RECEIVABLE_MISC');
    expect(sourceDefaultsSource).not.toContain('bizId: source.id!');
    expect(sourceDefaultsSource).toContain('`由其他应收单 ');
    expect(sourceDefaultsSource).toContain('source.no');
    expect(sourceDefaultsSource).toContain(' 转入`');
    expect(sourceDefaultsSource).toContain(
      'const amount = normalizeFinanceAmount(source.transferAvailableAmount)',
    );
    expect(sourceDefaultsSource).toContain('totalPrice: amount as any');
    expect(sourceDefaultsSource).toContain('discountPrice: 0 as any');
    expect(sourceDefaultsSource).toContain('receiptPrice: amount');
    expect(formSource).toContain(
      'sourceReceivableMiscId: formData.value.sourceReceivableMiscId',
    );
    expect(formSource).toContain(
      'sourceReceivableMiscNo: formData.value.sourceReceivableMiscNo',
    );
    expect(formSource).toContain('data?.sourceReceivableMisc');
    expect(formSource).toContain('syncCurrentCustomerOption(formData.value)');
    expect(formSource).toContain('clearInvalidDept: true');
    expect(formSource).toContain('selectedDeptId: formData.value.deptId');
    expect(formSource).toContain(
      'await itemFormRef.value?.setImportedItems(formData.value.items || [])',
    );
    expect(formSource).toContain(
      'itemPagination.total = formData.value.items?.length || 0',
    );
    expect(formSource).toContain('totalPrice: formData.value.totalPrice');
    expect(formSource).toContain('receiptPrice: formData.value.receiptPrice');
  });

  it('places remark and attachment on separate final rows in every mode', () => {
    for (const formType of ['create', 'detail', 'edit']) {
      const schema = useFormSchema(formType);
      expect(schema.slice(-2).map((field) => field.fieldName)).toEqual([
        'remark',
        'fileUrl',
      ]);
      for (const fieldName of ['fileUrl', 'remark']) {
        expect(
          schema.find((field) => field.fieldName === fieldName)?.formItemClass,
        ).toBe('receipt-form__full-row');
      }
    }
    expect(formSource).toContain(
      '.receipt-form__base-form :deep(.receipt-form__full-row)',
    );
    expect(formSource).toContain('grid-column: 1 / -1');
  });

  it('keeps audit fields out of the base information form', () => {
    const auditFields = [
      'creatorName',
      'createTime',
      'updaterName',
      'updateTime',
    ];

    for (const formType of ['create', 'detail', 'edit']) {
      const schemaFieldNames = useFormSchema(formType).map(
        (field) => field.fieldName,
      );
      for (const fieldName of auditFields) {
        expect(schemaFieldNames).not.toContain(fieldName);
      }
    }

    expect(formSource).toContain('<ErpAuditInfo');
    expect(formSource).toContain("formType === 'detail' && formData?.id");
  });

  it('uses the same clear section order and explicit detail load exits', () => {
    expect(formSource).toContain('基础信息');
    expect(formSource).toContain('收款明细');
    expect(formSource).toContain('单据合计');
    expect(formSource).toContain('审计信息');
    expect(formSource).toContain('<ErpAuditInfo');
    expect(formSource).toContain('detailLoading');
    expect(formSource).toContain('detailLoadError');
    expect(formSource).toContain('收款单详情加载失败');
    expect(formSource).toContain('v-show=');
    expect(formSource).toContain('customerId: undefined as any');
  });

  it('keeps list and detail summaries visible at their point of use', () => {
    expect(indexSource).toContain('class="finance-receipt-summary"');
    expect(indexSource).toContain('<FinanceListQuerySummary');
    expect(indexSource).toContain(':items="querySummaryItems"');
    expect(indexSource).toContain("label: '实收金额'");
    expect(saleSelectSource).toContain('class="receipt-sale-select__summary"');
    expect(saleSelectSource).toContain('本次核销');
    expect(saleSelectSource).toContain("headerAlign: 'right'");
    expect(itemSource).toContain('class="receipt-item-form__summary"');
  });

  it('orders selectable sale documents by create time and previews automatic write-off', () => {
    expect(formSource).toContain(':document-total-price="formData.totalPrice"');
    expect(apiSource).toContain('/erp/finance-receipt/form-candidates');
    expect(apiSource).toContain('/erp/finance-receipt/form-candidate-page');
    expect(apiSource).toContain('FinanceReceiptFormCandidate');
    expect(saleSelectSource).toContain('getFinanceReceiptFormCandidatePage({');
    expect(saleSelectSource).not.toContain('getSaleOutPage');
    expect(saleSelectSource).not.toContain('getSaleReturnPage');
    expect(saleSelectSource).not.toContain('getSalePriceAdjustPage');
    expect(saleSelectSource).not.toContain('receiptEnable');
    expect(saleSelectSource).not.toContain('fetchAllPages');
    expect(saleSelectSource).toContain('createTime: row.createTime');
    expect(saleSelectSource).toContain(
      'selectedItems: getCandidateSelections()',
    );
    expect(saleSelectSource).toContain('selectedRowMap');
    expect(saleSelectSource).toContain("keyField: 'clientRowKey'");
    expect(saleSelectSource).toContain('response.autoWriteOffCount');
    expect(saleSelectSource).toContain('autoWriteOffPreviewMap');
    expect(saleSelectSource).toContain('autoWriteOffPreviewDisabled');
    expect(saleSelectSource).toContain(
      'if (props.autoWriteOffPreviewDisabled) return result',
    );
    expect(saleSelectSource).toContain(
      'receipt-sale-select__auto-writeoff-row',
    );
    expect(saleSelectSource).toContain('预计自动');
    expect(saleSelectSource).toContain('审核通过后预计由系统自动核销');
    expect(saleSelectSource).toContain('浅橙色行表示审核后预计自动核销');
    expect(saleSelectSource).toContain('v-if="!autoWriteOffPreviewDisabled"');
    expect(formSource).toContain('getAutoWriteOffConfig()');
    expect(formSource).toContain('effectiveAutoWriteOffDisabledDeptIds');
    expect(formSource).toContain('autoWriteOffPreviewDisabled');
    expect(formSource).toContain(
      ':auto-write-off-preview-disabled="autoWriteOffPreviewDisabled"',
    );
    expect(saleSelectSource).toContain('createTime: _createTime');
    expect(saleSelectSource).toContain('unReceiptedPrice: _unReceiptedPrice');
    expect(saleSelectSource).toContain('row.unallocatedPrice ??');
    expect(saleSelectSource).toContain('getOutstandingPrice(row)');
  });

  it('uses a readable compact type scale for receipt tables', () => {
    expect(indexSource).not.toContain('font-size: 13px');
    for (const source of [indexSource, itemSource, saleSelectSource]) {
      expect(source).toContain('font-size: 12px');
      expect(source).toContain('font-variant-numeric: tabular-nums');
    }
  });

  it('fixes only the operation column and keeps list functions isolated', () => {
    const columns = useGridColumns() || [];
    expect(columns[0]?.fixed).toBeUndefined();
    expect(columns.find((column) => column.field === 'no')?.fixed).toBe(
      undefined,
    );
    expect(columns.at(-1)?.fixed).toBe('right');
    expect(columns.at(-1)?.width).toBe(180);

    const itemColumns = useFormItemColumns(false) || [];
    expect(itemColumns[0]?.fixed).toBeUndefined();
    expect(
      itemColumns.find((column) => column.field === 'bizNo')?.fixed,
    ).toBeUndefined();
    expect(itemColumns.at(-1)?.fixed).toBe('right');
    expect(itemColumns.at(-1)?.width).toBe(72);
    expect(indexSource).not.toContain('const rowActionColumnFields');
    expect(indexSource).toContain('<template #deleteAction="{ row }">');
    expect(indexSource).toContain('<template #printAction="{ row }">');
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'finance_receipt'",
    );
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain('PrintTemplateSelector');
    expect(indexSource).toContain("auth: ['erp:finance-receipt:print']");
    expect(indexSource).toContain(
      "auth: ['erp:finance-receipt:print-template']",
    );
    expect(indexSource).toContain('handleSearchEnter');
    expect(indexSource).toContain("orders: ['asc', 'desc', null]");
  });

  it('preserves core receipt interactions around the visual changes', () => {
    expect(indexSource).not.toContain('handleCellClick');
    expect(indexSource).not.toContain('cellClick: handleCellClick');
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
    expect(indexSource).toContain('handleUpdateStatus');
    expect(indexSource).toContain('handleBatchDelete');
    expect(indexSource).toContain('handleImport');
    expect(indexSource).toContain("auth: ['erp:finance-receipt:writeoff']");
    expect(itemSource).toContain(
      "auth: ['erp:finance-receipt:writeoff-reverse']",
    );
    expect(formSource).toContain('handleReverseWriteOff');
    expect(indexSource).toContain('ifShow: () => checkedRows.length > 0');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain('message.success(`已删除 ');
    expect(indexSource).toContain('条，已跳过 ');
    expect(indexSource).toContain('skippedCount} 条`');
    expect(formSource).toContain('async onConfirm()');
    expect(formSource).toContain('切换客户后会清空已引入的收款明细');
    expect(formSource).toContain('await modalApi.close()');
    expect(saleSelectSource).toContain('handleCheckboxChange');
    expect(saleSelectSource).toContain('let loadRequestId = 0');
    expect(saleSelectSource).toContain('requestId !== loadRequestId');
    expect(saleSelectSource).toContain("'change',");
  });

  it('opens selected customer receivable detail in the receipt form modal', () => {
    expect(formSource).toContain('CustomerReceivableDetail');
    expect(formSource).toContain(
      '#/views/erp/finance/receivable/account/modules/detail-drawer.vue',
    );
    expect(formSource).toContain('canShowCustomerReceivableAction');
    expect(formSource).toContain('canOpenCustomerReceivableDetail');
    expect(formSource).toContain('customerReceivableDetailOpen');
    expect(formSource).toContain('customerReceivableDetailTitle');
    expect(formSource).toContain("formType.value !== 'detail'");
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:receivable-account:query'])",
    );
    expect(formSource).toContain(
      'Boolean(canShowCustomerReceivableAction.value && formData.value?.customerId)',
    );
    expect(formSource).toContain(
      'class="receipt-form__section receipt-form__action-section"',
    );
    expect(formSource).toContain('功能操作');
    expect(formSource).toContain(
      ':disabled="!canOpenCustomerReceivableDetail"',
    );
    expect(formSource).toContain('handleOpenCustomerReceivableDetail');
    expect(formSource).toContain('customerReceivableDetailOpen.value = true');
    expect(formSource).toContain('v-model:open="customerReceivableDetailOpen"');
    expect(formSource).toContain(':title="customerReceivableDetailTitle"');
    expect(formSource).toContain('display-mode="modal"');
    expect(formSource).toContain(':customer-id="Number(formData.customerId)"');
    expect(formSource).toContain(
      ':customer-name="formData.customerName || \'\'"',
    );
    expect(formSource).toContain('查看应收明细');
    expect(formSource).toContain('v-if="canShowCustomerReceivableAction"');
    expect(formSource).not.toContain('const router = useRouter()');
    expect(formSource).not.toContain("path: '/erp/finance/receivable/account'");
    expect(formSource).not.toContain('customerReceivableDetailLink');
    expect(formSource).not.toContain('withCustomerReceivableDetailLink');
  });

  it('loads receivable candidates from finance form API and defaults their remaining amount', () => {
    expect(saleSelectSource).toContain(
      'current?.receiptPrice ?? outstandingPrice',
    );
    expect(saleSelectSource).toContain(
      'row.unallocatedPrice ?? normalizedTotalPrice - normalizedReceiptedPrice',
    );
    expect(saleSelectSource).not.toContain(
      'Number(row.totalAdjustPrice || 0),\n    0,',
    );
  });

  it('filters receivable documents by department without rewriting row departments', () => {
    expect(formSource).toContain(':dept-id="formData.deptId"');
    expect(saleSelectSource).toContain('const deptId = props.deptId');
    expect(saleSelectSource).toContain('customerId,\n    deptId,');
    expect(saleSelectSource).toContain(
      'watch(() => [props.customerId, props.deptId], reloadData',
    );
    expect(saleSelectSource).toContain(
      'deptName: row.deptName || current?.deptName || _contextDeptName',
    );
    expect(saleSelectSource).not.toContain('Object.assign(row, context)');
  });

  it('implements the receipt draft action matrix and permissions', () => {
    const detailGuardIndex = formSource.indexOf(
      'hasValidFinanceReceiptDraftItems(payload.items ?? [])',
    );
    const createDraftIndex = formSource.indexOf(
      'createFinanceReceiptDraft(payload)',
    );
    expect(detailGuardIndex).toBeGreaterThan(-1);
    expect(createDraftIndex).toBeGreaterThan(detailGuardIndex);
    expect(formSource).toContain("message.warning('未选择明细，不生成草稿')");
    for (const path of [
      '/erp/finance-receipt/create-draft',
      '/erp/finance-receipt/create-and-submit',
      '/erp/finance-receipt/update-draft',
      '/erp/finance-receipt/update-and-submit',
      '/erp/finance-receipt/submit',
    ]) {
      expect(apiSource).toContain(path);
    }
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return saveCurrentDraft();');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('async function handleEscapeClose()');
    expect(formSource).toContain(
      '@keydown.esc.stop.prevent="handleEscapeClose"',
    );
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('draftSaved');
    expect(formSource).toContain('draftSaving');
    expect(formSource).toContain('createFinanceReceiptDraft(payload)');
    expect(formSource).toContain('updateFinanceReceiptDraft(payload)');
    expect(formSource).toContain('createAndSubmitFinanceReceipt(payload)');
    expect(formSource).toContain('updateAndSubmitFinanceReceipt(payload)');
    expect(formSource).toContain('submitFinanceReceipt(id)');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:finance-receipt:update-status'])",
    );
    expect(formSource).toContain('canSubmitDraftFromDetail');
    expect(formSource).toContain('canGenerateDraft');
    expect(formSource).toContain(
      "(formType.value === 'create' || isEditingDraft.value)",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain('handleGenerateDraft');
    expect(formSource).toContain('草稿生成成功');
    expect(formSource).toContain('草稿保存成功');
    expect(centerFooterSource).toContain('v-if="canGenerateDraft"');
    expect(centerFooterSource).toContain('handleGenerateDraft');
    expect(centerFooterSource).toContain('generateDraftButtonText');
    expect(prependFooterSource).not.toContain('handleGenerateDraft');
    expect(prependFooterSource).not.toContain('canGenerateDraft');
    expect(formSource).toContain('canEditFromDetail');
    expect(formSource).toContain('handleEditFromDetail');
    expect(formSource).toContain(
      'formData.value.status !== FINANCE_RECEIPT_STATUS.APPROVE',
    );
    expect(formSource).toContain(
      'const detail = await getFinanceReceipt(id, { includeItems: false })',
    );
    expect(formSource).toContain('await fetchAllFinanceReceiptItems(id)');
    expect(formSource).toContain("await applyFormMode('edit')");
    expect(formSource).toContain('确认提交');
    expect(apiSource).toContain('/erp/finance-receipt/item-page');
  });

  it('does not clear hydrated draft items while refreshing receipt context', () => {
    const contextWatchStart = saleSelectSource.indexOf(
      '() => props.receiptContext',
    );
    const contextWatchEnd = saleSelectSource.indexOf(
      '{ deep: true },',
      contextWatchStart,
    );
    const contextWatch = saleSelectSource.slice(
      contextWatchStart,
      contextWatchEnd,
    );

    expect(contextWatch).toContain(
      'Object.assign(row, receiptDocumentContext)',
    );
    expect(contextWatch).not.toContain('emitSelectedItems()');
    expect(saleSelectSource).toContain('selected: !!current');
  });

  it('shows draft state accessibly and keeps approval on process rows only', () => {
    const statusColumn = useGridColumns()?.find(
      (column) => column.field === 'status',
    );
    expect(statusColumn?.slots).toEqual({ default: 'status' });
    expect(indexSource).toContain('<template #status="{ row }">');
    expect(indexSource).toContain('草稿：关闭新增或草稿编辑页面时自动保存');
    expect(indexSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(indexSource).toContain('finance-receipt-draft-row');
    expect(indexSource).toContain(
      'row.status === FINANCE_RECEIPT_STATUS.PROCESS',
    );
    expect(indexSource).toContain("'编辑草稿'");
  });

  it('keeps automatic write-off hints out of the receipt main list and detail', () => {
    const writeOffStatusColumn = useGridColumns()?.find(
      (column) => column.field === 'writeOffStatus',
    );
    expect(writeOffStatusColumn?.slots).toBeUndefined();
    expect(typeof writeOffStatusColumn?.formatter).toBe('function');
    expect(apiSource).not.toContain('hasAutoWriteOff?: boolean');
    expect(apiSource).not.toContain('autoWriteOffCount?: number');
    expect(apiSource).not.toContain('autoWriteOffAmount?: number');
    expect(apiSource).not.toContain('autoWriteOff?: boolean');
    expect(indexSource).not.toContain('finance-receipt-auto-writeoff-row');
    expect(indexSource).not.toContain('含系统自动核销明细');
    expect(indexSource).not.toContain('浅橙色行表示含系统自动核销明细');
    expect(indexSource).not.toContain('<template #writeOffStatus="{ row }">');
    expect(indexSource).not.toContain('getAutoWriteOffTitle(row)');
    expect(itemSource).not.toContain('receipt-item-form__auto-writeoff-row');
    expect(itemSource).not.toContain('row.autoWriteOff');
    expect(itemSource).not.toContain(
      '该明细由系统在收款单审核通过后自动生成核销',
    );
  });
});
