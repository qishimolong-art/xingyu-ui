import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  useDetailColumns,
  useDrilldownColumns,
  useGridColumns,
  useGridFormSchema,
} from './data';
import {
  getPayableDetailPaymentState,
  sumPayableAccountAmount,
} from './payable-account-ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const detailSource = readFileSync(
  join(currentDir, 'modules/detail-drawer.vue'),
  'utf8',
);
const accountApiSource = readFileSync(
  join(currentDir, '../../../../../api/erp/finance/payable/account/index.ts'),
  'utf8',
);

describe('payable account page UI contract', () => {
  it('wires source links to existing detail modals without reloading the grid', () => {
    const columns = useDetailColumns() as any[];
    expect(
      columns.find((column) => column.field === 'sourceNo')?.slots,
    ).toEqual({
      default: 'sourceNo',
    });
    expect(detailSource).toContain('@click.stop="handleOpenSourceDetail(row)"');
    expect(detailSource).toContain(
      'getPayableSourceTarget(row, props.readonly, hasAccessByCodes)',
    );
    expect(detailSource).toContain(
      "import('#/views/erp/purchase/order/modules/form.vue')",
    );
    const handler = detailSource
      .split('function handleOpenSourceDetail(')[1]
      ?.split('function getDetailModal')[0];
    expect(handler).toContain(
      "target.type === 'PURCHASE_ORDER' ? purchaseOrderModalApi : paymentModalApi",
    );
    expect(handler).toContain(
      "setData({ type: 'detail', id: target.id }).open()",
    );
    expect(handler).not.toMatch(/loadData|renderDetailList|detailPagination/);
    expect(detailSource).toContain(
      '<PaymentModal @writeoff="handlePaymentDetailWriteOff" />',
    );
  });

  it('keeps leading columns scrollable and fixes only operations', () => {
    const columns = useGridColumns() as any[];

    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(
      columns.find((column) => column.field === 'supplierName')?.slots,
    ).toEqual({ default: 'supplierName' });
    expect(
      columns.find((column) => column.field === 'supplierName')?.align,
    ).toBe('center');
  });

  it('uses compact teleported search options and sortable detail fields', () => {
    useGridFormSchema()
      .filter((schema) =>
        ['ApiSelect', 'SupplierLazySelect'].includes(String(schema.component)),
      )
      .forEach((schema) => {
        expect(schema.componentProps).toMatchObject({
          popupClassName: 'payable-account-search-select-dropdown',
        });
      });

    const detailColumns = useDetailColumns() as any[];
    detailColumns
      .filter((column) => column.field)
      .forEach((column) => expect(column.sortable).toBe(true));
    expect(
      detailColumns.find((column) => column.type === 'seq')?.sortable,
    ).not.toBe(true);
    expect(
      detailColumns.find((column) => column.title === '操作')?.sortable,
    ).not.toBe(true);
    expect(detailColumns.map((column) => column.title || column.type)).toEqual([
      '序号',
      '单据类型',
      '单据日期',
      '单据号',
      '业务员',
      '所属部门',
      '上次余额',
      '应付款',
      '付款金额',
      '余额',
      '核销金额',
      '来源单号',
      '厂家单号',
      '开票情况',
      '备注',
      '凭证号',
      '确认时间',
      '操作',
    ]);
    expect(detailColumns.map((column) => column.title)).not.toContain(
      '预付金额',
    );
    expect(detailColumns.map((column) => column.title)).not.toContain(
      '财务说明',
    );
    expect(detailColumns.map((column) => column.field).filter(Boolean)).toEqual(
      [
        'docType',
        'docDate',
        'docNo',
        'businessUserName',
        'deptName',
        'prevBalance',
        'increaseAmount',
        'paymentDisplayAmount',
        'balance',
        'writeOffAmount',
        'sourceNo',
        'factoryOrderNo',
        'invoiceStatus',
        'remark',
        'voucherNo',
        'confirmTime',
      ],
    );
  });

  it('uses approval date first and document time last in the account detail scene', () => {
    const detailColumns = useDetailColumns([], true) as any[];
    const businessColumns = detailColumns.filter((column) => column.field);
    expect(useGridFormSchema()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldName: 'approveTime',
          label: '审批日期',
        }),
      ]),
    );
    expect(businessColumns[0]).toMatchObject({
      field: 'approveTime',
      title: '审批日期',
    });
    expect(businessColumns.at(-1)).toMatchObject({
      field: 'docDate',
      title: '单据时间',
    });
    expect(businessColumns.map((column) => column.field)).not.toContain(
      'confirmTime',
    );
    expect(indexSource).toContain("dateBasis: 'approveTime'");
    expect(indexSource).toContain('date-basis="approveTime"');
    expect(detailSource).toContain("field: 'approveTime', order: 'asc'");
    expect(detailSource).toContain('if (row.eventKey) return row.eventKey');
  });

  it('keeps page amount calculations numeric', () => {
    const columns = useGridColumns() as any[];

    expect(
      columns.find((column) => column.field === 'otherPayableAmount')?.title,
    ).toBe('应付调账');
    expect(
      columns.find((column) => column.field === 'miscPayableAmount')?.title,
    ).toBe('其他应付款');
    expect(
      columns.find((column) => column.field === 'openingPayableBalance')?.title,
    ).toBe('此前应付');
    expect(columns.some((column) => column.title === '其他应付')).toBe(false);
    expect(
      sumPayableAccountAmount(
        [{ otherPayableAmount: 10 }, { otherPayableAmount: 2.5 }],
        'otherPayableAmount',
      ),
    ).toBe(12.5);
    expect(
      sumPayableAccountAmount(
        [{ miscPayableAmount: -10 }, { miscPayableAmount: -2.5 }],
        'miscPayableAmount',
      ),
    ).toBe(-12.5);
    expect(
      sumPayableAccountAmount(
        [{ openingPayableBalance: 100 }, { openingPayableBalance: -2.5 }],
        'openingPayableBalance',
      ),
    ).toBe(97.5);
  });

  it('distinguishes settled, partial, and unpaid detail rows', () => {
    expect(
      getPayableDetailPaymentState({
        allocatedAmount: 100,
        balance: 100,
        increaseAmount: 100,
      }),
    ).toBe('settled');
    expect(
      getPayableDetailPaymentState({
        allocatedAmount: 40,
        balance: 0,
        increaseAmount: 100,
      }),
    ).toBe('partial');
    expect(
      getPayableDetailPaymentState({
        allocatedAmount: 18,
        balance: -277.09,
        increaseAmount: 20.5,
        writeOffBaseAmount: 18,
      }),
    ).toBe('settled');
    expect(
      getPayableDetailPaymentState({
        allocatedAmount: 100,
        balance: 0,
        paymentAmount: 100,
      }),
    ).toBe('settled');
    expect(
      getPayableDetailPaymentState({
        allocatedAmount: 40,
        balance: -60,
        paymentAmount: 100,
      }),
    ).toBe('partial');
    expect(
      getPayableDetailPaymentState({
        balance: -60,
        paymentAmount: 100,
      }),
    ).toBe('partial');
    expect(
      getPayableDetailPaymentState({
        balance: 120,
        paymentAmount: -20,
      }),
    ).toBe('partial');
    expect(
      getPayableDetailPaymentState({
        allocatedAmount: -20,
        balance: 120,
        paymentAmount: -20,
      }),
    ).toBe('settled');
    expect(
      getPayableDetailPaymentState({
        balance: 60,
        writeOffAmount: 40,
      }),
    ).toBe('partial');
    expect(
      getPayableDetailPaymentState({
        balance: 100,
        increaseAmount: 100,
      }),
    ).toBe('unpaid');
    expect(
      (useDetailColumns() || []).some(
        (column) => column.field === 'allocatedAmount',
      ),
    ).toBe(false);
    expect(
      (useDetailColumns() || []).some(
        (column) => column.field === 'writeOffAmount',
      ),
    ).toBe(true);
  });

  it('keeps compact search, full-query summary, sorting, and query permission wired', () => {
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('class="payable-supplier-name"');
    expect(indexSource).toContain('class="payable-amount-link"');
    expect(indexSource).toContain('PAYABLE_DRILLDOWN_MAP');
    expect(indexSource).toContain("permission: 'erp:payable-misc:query'");
    expect(indexSource).toContain(':detail-type="currentDetailType"');
    expect(indexSource).toContain('text-align: center;');
    expect(indexSource).not.toContain('footerMethod:');
    expect(indexSource).not.toContain('showFooter: true');
    expect(indexSource).toContain('<template #bottom>');
    expect(indexSource).toContain('useFinanceQuerySummary');
    expect(indexSource).toContain('getPayableAccountSummary(params, signal)');
    expect(indexSource).toContain('<FinanceListQuerySummary');
    expect(indexSource).toContain(':error="querySummaryState.error.value"');
    expect(indexSource).toContain('@retry="querySummaryState.retry"');
    expect(indexSource).toContain('querySummaryState.cancelPending()');
    expect(indexSource).toContain('if (pageRows.value.length > 0)');
    expect(indexSource).toContain('refresh: { queryMethod: handleRefresh }');
    expect(indexSource).not.toContain('本页合计');
    expect(indexSource).toContain("label: '其他应付款'");
    expect(indexSource).toContain("label: '此前应付'");
    expect(indexSource).toContain(
      "openingPayableBalance: 'openingPayableBalance'",
    );
    expect(indexSource).toContain("miscPayableAmount: 'miscPayableAmount'");
    expect(indexSource).toContain('destroyOnClose: true');
    expect(indexSource).toContain("auth: ['erp:payable-account:query']");
    expect(indexSource).toContain('@writeoff-success="handleRefresh"');
    expect(detailSource).not.toContain('writeOffPayable');
    expect(detailSource).not.toContain("'erp:payable-account:writeoff'");
    expect(detailSource).toContain('exportPayableDrilldown');
    expect(detailSource).toContain('getPayableDrilldownPage');
    expect(detailSource).toContain("label: '导出'");
    expect(detailSource).toContain('ACTION_ICON.DOWNLOAD');
    expect(detailSource).toContain("auth: ['erp:payable-account:query']");
    expect(detailSource).toContain('disabled: !supplierId');
    expect(detailSource).toContain('loading: exportLoading');
    expect(detailSource).toContain('fileName: `应付-');
    expect(detailSource).toContain('明细.xls`');
    expect(detailSource).toContain("'erp:finance-payment:writeoff'");
    expect(detailSource).toContain('isPaymentDetailRow(row)');
    expect(detailSource).toContain('financeCompare(financeValue(row.paymentAmount || 0), 0) !== 0');
    expect(detailSource).toContain('getFinancePayment(row.bizId)');
    expect(detailSource).toContain('@success="handlePaymentWriteOffSuccess"');
    expect(detailSource).toContain("label: '期初金额'");
    expect(detailSource).toContain("label: '增加合计'");
    expect(detailSource).toContain("label: '减少合计'");
    expect(detailSource).toContain('readonly?: boolean');
    expect(detailSource).toContain('v-if="!readonly"');
    expect(detailSource).not.toContain('按现有应付账户明细展示');
    expect(detailSource).not.toContain('不是商品维度经营分配');
    expect(detailSource).not.toContain('不计算正式付款率');
    expect(detailSource).toContain('v-if="loadError"');
    expect(detailSource).toContain('明细加载失败，请稍后重试');
    expect(detailSource).toContain(
      '#/views/erp/finance/settlement/payment/modules/form.vue',
    );
    expect(detailSource).toContain('@writeoff="handlePaymentDetailWriteOff"');
    expect(detailSource).toContain("emit('writeoffSuccess')");
    expect(detailSource).toContain(
      "const DETAIL_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200']",
    );
    expect(detailSource).toContain(
      'const detailPagination = ref({ pageNo: 1, pageSize: 10 })',
    );
    expect(detailSource).toContain(
      'const currentTotal = computed(() => detailTotal.value)',
    );
    expect(detailSource).toContain('const currentPageNo = computed');
    expect(detailSource).toContain('const currentPageSize = computed');
    expect(detailSource.indexOf('const currentPageNo = computed')).toBeLessThan(
      detailSource.indexOf('const detailColumns = computed'),
    );
    expect(
      detailSource.indexOf('const currentPageSize = computed'),
    ).toBeLessThan(detailSource.indexOf('const detailColumns = computed'));
    expect(detailSource).not.toContain('sortedRows.slice(');
    expect(detailSource).toContain('<Pagination');
    expect(detailSource).toContain(':current="currentPageNo"');
    expect(detailSource).toContain(':page-size="currentPageSize"');
    expect(detailSource).toContain('show-quick-jumper');
    expect(detailSource).toContain('show-size-changer');
    expect(detailSource).toContain('@show-size-change="handlePageChange"');
    expect(detailSource).toContain("keyField: 'rowKey'");
    expect(detailSource).toContain('function buildDetailRowKey');
    expect(detailSource).toContain('withDetailRowKeys(data.list || [])');
    expect(detailSource).toContain('function isAdjustedPurchaseIn');
    expect(detailSource).toContain('row.bizType === ErpBizType.PURCHASE_IN');
    expect(detailSource).toContain('row.priceAdjusted === true');
    expect(detailSource).toContain('（调）');
    expect(detailSource).not.toContain("row.docNo + '（调）'");
    expect(accountApiSource).toContain('exportPayableDetail');
    expect(accountApiSource).toContain('/erp/payable-account/export-detail');
    expect(
      (useDetailColumns() || []).some((column) => column.title === '操作'),
    ).toBe(true);
  });

  it('clears detail loading on failure and ignores stale requests', () => {
    expect(detailSource).toContain('const sequence = ++loadSequence');
    expect(detailSource).toContain('if (sequence !== loadSequence) return');
    expect(detailSource).toContain('loadError.value =');
    expect(detailSource).toContain('明细加载失败，请稍后重试');
    expect(detailSource).toContain('loading.value = false');
    expect(detailSource).not.toContain('sortPayableDetails(');
    expect(detailSource).not.toContain('detailList.value.reduce(');
    expect(
      (useDetailColumns() || []).find((column) => column.field === 'deptName')
        ?.sortable,
    ).toBe(true);
    expect(detailSource).toContain('await renderDetailList()');
    expect(detailSource).toContain('async function renderDetailList()');
    expect(detailSource).toContain('payable-detail-row--');
    expect(detailSource).toContain('getPayableDetailPaymentState(row)');
    expect(detailSource).toContain('hsl(var(--primary) / 18%)');
    expect(detailSource).toContain('hsl(var(--destructive) / 18%)');
    expect(detailSource).toContain('hsl(var(--card))');
    expect(detailSource).toContain('付款核销状态图例');
    expect(detailSource).toContain('已付款但未付完');
    expect(detailSource).toContain('未进行付款');
    expect(detailSource).toContain("row.docType === '应付调账'");
    expect(detailSource).toContain('ErpBizType.PAYABLE_MISC');
    expect(detailSource).toContain('MiscPayableModal');
    expect(detailSource).toContain("'calc(100vh - 330px)'");
    expect(detailSource).toContain("props.displayMode === 'modal' ? 360 : 520");
    expect(detailSource).not.toContain("maxHeight: 'calc(100vh - 220px)'");
    expect(detailSource).not.toContain('class="payable-detail h-full"');
  });

  it('maps only supported amounts to accessible server drilldowns', () => {
    const columns = useGridColumns() as any[];
    const clickableFields = columns
      .filter((column) => column.slots?.default === 'amountDrilldown')
      .map((column) => column.field);
    expect(clickableFields).toEqual([
      'purchaseInAmount',
      'purchaseReturnAmount',
      'priceAdjustAmount',
      'otherPayableAmount',
      'paymentAmount',
      'writeOffAmount',
      'balance',
      'openingPayableBalance',
      'miscPayableAmount',
    ]);
    expect(clickableFields).not.toContain('unclearedPrepayment');
    expect(useDrilldownColumns([], '其他应付款')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'changeAmount', title: '其他应付款' }),
        expect.objectContaining({ field: 'prevBalance', title: '上笔累计' }),
        expect.objectContaining({ field: 'balance', title: '累计金额' }),
      ]),
    );
    expect(detailSource).toContain('detailType: props.detailType');
    expect(detailSource).toContain(
      'paymentDisplayAmount: row.paymentDisplayAmount ?? row.paymentAmount',
    );
    expect(detailSource).toContain('pageNo: detailPagination.value.pageNo');
    expect(detailSource).toContain('orderField: activeDetailSort.value?.field');
    expect(detailSource).toContain(
      "dateBasis === 'approveTime' ? '审批' : '业务'",
    );
  });
});
