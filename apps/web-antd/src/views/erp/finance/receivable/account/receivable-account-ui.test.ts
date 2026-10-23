import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  RECEIVABLE_ACCOUNT_SORT_FIELD_MAP,
  useDetailColumns,
  useDrilldownColumns,
  useGridColumns,
  useGridFormSchema,
} from './data';
import {
  getReceivableDetailPaymentState,
  getReceivableStatusMeta,
  sumReceivableAccountAmount,
} from './receivable-account-ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const detailSource = readFileSync(
  join(currentDir, 'modules/detail-drawer.vue'),
  'utf8',
);

describe('receivable account page UI contract', () => {
  it('distinguishes unknown invoice and restricted amounts from actual zero', () => {
    const columns = useDetailColumns([]) as any[];
    for (const field of [
      'billAmount',
      'receivedAmount',
      'receivedWriteOffAmount',
    ]) {
      const formatter = columns.find(
        (column) => column.field === field,
      ).formatter;
      expect(formatter({ cellValue: null })).toBe('-');
      expect(formatter({ cellValue: 0 })).toBe('0.00');
    }
    expect(
      columns
        .find((column) => column.field === 'invoiceStatus')
        .formatter({ cellValue: null }),
    ).toBe('-');
    expect(
      columns.find((column) => column.field === 'approveTime').formatter,
    ).toBe('formatDateTime');
  });

  it('displays seconds with enough column width for a full document timestamp', () => {
    const columns = useDetailColumns([
      { docDate: '2026-09-24 14:25:36' },
    ]) as any[];
    const dateColumn = columns.find((column) => column.field === 'docDate');
    expect(dateColumn.formatter).toBe('formatDateTime');
    expect(dateColumn.width).toBeGreaterThanOrEqual(180);
  });

  it('keeps the requested business fields in their exact sequence', () => {
    const columns = useGridColumns() as any[];

    expect(
      columns
        .filter((column) => column.field && column.field !== 'actions')
        .map((column) => [column.field, column.title]),
    ).toEqual([
      ['mobile', '客户电话号码'],
      ['customerName', '客户名称'],
      ['deptName', '单据所属部门'],
      ['receivableBalance', '余额'],
      ['openingReceivableBalance', '此前应收'],
      ['miscReceivableAmount', '其他应收款'],
      ['preAdvanceAmount', '未核销预收金额'],
      ['receiptAmount', '明细收款'],
      ['baseAmount', '铺底金额'],
      ['creditLimit', '信用额度'],
      ['creditBalance', '信用余额'],
      ['creditTermDays', '信用期限'],
      ['customerTypeName', '客户类型'],
      ['saleUserName', '业务员'],
      ['areaName', '区域'],
      ['saleOutAmount', '销售增加'],
      ['saleReturnAmount', '退货增加'],
      ['routeName', '线路名称'],
    ]);
  });

  it('keeps leading columns scrollable and fixes only operations', () => {
    const columns = useGridColumns() as any[];

    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(
      columns.find((column) => column.field === 'customerName')?.slots,
    ).toEqual({ default: 'customerName' });
    expect(
      columns.find((column) => column.field === 'customerName')?.align,
    ).toBe('center');
  });

  it('uses compact teleported search options and sortable detail fields', () => {
    useGridFormSchema()
      .filter(
        (schema) =>
          schema.component === 'ApiSelect' ||
          schema.component === 'CustomerLazySelect',
      )
      .forEach((schema) => {
        expect(schema.componentProps).toMatchObject({
          popupClassName: 'receivable-account-search-select-dropdown',
        });
      });

    const detailColumns = useDetailColumns() as any[];
    detailColumns
      .filter((column) => column.field && column.field !== 'actions')
      .forEach((column) => expect(column.sortable).toBe(true));
    expect(
      detailColumns.find((column) => column.type === 'seq')?.sortable,
    ).not.toBe(true);
    expect(
      detailColumns
        .filter((column) => column.field && column.field !== 'actions')
        .map((column) => [column.field, column.title]),
    ).toEqual([
      ['docType', '单据类型'],
      ['docDate', '日期'],
      ['docNo', '单号'],
      ['prevBalance', '上笔余额'],
      ['increaseAmount', '增加应收'],
      ['receiptDisplayAmount', '收款金额'],
      ['balance', '余额'],
      ['auditorName', '审核人'],
      ['deliveryMethod', '送货方式'],
      ['approveTime', '审核日期'],
      ['settleMethod', '结算方式'],
      ['invoiceStatus', '开票情况'],
      ['billAmount', '票据金额'],
      ['billNo', '票据号'],
      ['remark', '备注'],
      ['voucherNo', '凭证号'],
      ['customerName', '客户名称'],
      ['internalNote', '说明'],
      ['receivedWriteOffAmount', '已核销金额'],
      ['receivedAmount', '已收款金额'],
      ['deptName', '所属部门'],
      ['otherReceivableAmount', '应收调账'],
      ['writeOffAmount', '核销金额'],
    ]);
    expect(
      detailColumns.find((column) => column.title === '操作')?.sortable,
    ).not.toBe(true);
  });

  it('uses approval date first and document time last in the account detail scene', () => {
    const detailColumns = useDetailColumns([], true) as any[];
    const businessColumns = detailColumns.filter(
      (column) => column.field && column.field !== 'actions',
    );
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
    expect(indexSource).toContain("dateBasis: 'approveTime'");
    expect(indexSource).toContain('date-basis="approveTime"');
    expect(detailSource).toContain("field: 'approveTime', order: 'asc'");
    expect(detailSource).toContain('if (row.eventKey) return row.eventKey');
  });

  it('makes every main-list business column remotely sortable', () => {
    const columns = useGridColumns() as any[];
    const businessColumns = columns.filter(
      (column) => column.field && column.field !== 'actions',
    );

    businessColumns.forEach((column) => {
      expect(column.sortable, column.field).toBe(true);
      expect(RECEIVABLE_ACCOUNT_SORT_FIELD_MAP).toHaveProperty(column.field);
    });
    expect(Object.keys(RECEIVABLE_ACCOUNT_SORT_FIELD_MAP)).toHaveLength(
      businessColumns.length,
    );
    expect(
      columns.find((column) => column.title === '操作')?.sortable,
    ).not.toBe(true);
    expect(columns.find((column) => column.title === '操作')).toMatchObject({
      field: 'actions',
      fixed: 'right',
    });
  });

  it('keeps status and page amount calculations consistent', () => {
    expect(
      getReceivableStatusMeta({ receivedAmount: 0, unreceivedAmount: 100 }),
    ).toEqual({ color: 'red', label: '未收款' });
    expect(
      getReceivableStatusMeta({ receivedAmount: 40, unreceivedAmount: 60 }),
    ).toEqual({ color: 'orange', label: '部分收款' });
    expect(
      getReceivableStatusMeta({ receivedAmount: 100, unreceivedAmount: 0 }),
    ).toEqual({ color: 'green', label: '已收款' });
    expect(
      sumReceivableAccountAmount(
        [{ receivableAmount: 10 }, { receivableAmount: 2.5 }],
        'receivableAmount',
      ),
    ).toBe(12.5);
    expect(
      sumReceivableAccountAmount(
        [{ miscReceivableAmount: -10 }, { miscReceivableAmount: -2.5 }],
        'miscReceivableAmount',
      ),
    ).toBe(-12.5);
    expect(
      sumReceivableAccountAmount(
        [{ openingReceivableBalance: 100 }, { openingReceivableBalance: -2.5 }],
        'openingReceivableBalance',
      ),
    ).toBe(97.5);
  });

  it('distinguishes settled, partial, and unpaid detail rows', () => {
    expect(
      getReceivableDetailPaymentState({
        allocatedAmount: 100,
        balance: 100,
        increaseAmount: 100,
      }),
    ).toBe('settled');
    expect(
      getReceivableDetailPaymentState({
        allocatedAmount: 40,
        balance: 0,
        increaseAmount: 100,
      }),
    ).toBe('partial');
    expect(
      getReceivableDetailPaymentState({
        allocatedAmount: 18,
        balance: -277.09,
        increaseAmount: 20.5,
        writeOffBaseAmount: 18,
      }),
    ).toBe('settled');
    expect(
      getReceivableDetailPaymentState({
        balance: 0,
        receiptAmount: 100,
      }),
    ).toBe('partial');
    expect(
      getReceivableDetailPaymentState({
        allocatedAmount: 40,
        balance: -20,
        receiptAmount: 100,
      }),
    ).toBe('partial');
    expect(
      getReceivableDetailPaymentState({
        allocatedAmount: 100,
        balance: -20,
        receiptAmount: 100,
      }),
    ).toBe('settled');
    expect(
      getReceivableDetailPaymentState({
        balance: 45_522,
        receiptAmount: -44_802,
      }),
    ).toBe('partial');
    expect(
      getReceivableDetailPaymentState({
        allocatedAmount: -44_802,
        balance: 45_522,
        receiptAmount: -44_802,
      }),
    ).toBe('settled');
    expect(
      getReceivableDetailPaymentState({
        balance: 60,
        writeOffAmount: 40,
      }),
    ).toBe('partial');
    expect(
      getReceivableDetailPaymentState({
        balance: 100,
        increaseAmount: 100,
      }),
    ).toBe('unpaid');
    expect(
      (useDetailColumns() || []).some(
        (column) => column.field === 'allocatedAmount',
      ),
    ).toBe(false);
  });

  it('keeps compact search, full-query summary, sorting, and query permission wired', () => {
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('class="receivable-customer-name"');
    expect(indexSource).toContain('class="receivable-amount-link"');
    expect(indexSource).toContain('RECEIVABLE_DRILLDOWN_MAP');
    expect(indexSource).toContain("permission: 'erp:receivable-misc:query'");
    expect(indexSource).toContain(':detail-type="currentDetailType"');
    expect(indexSource).toContain('text-align: center;');
    expect(indexSource).not.toContain('footerMethod:');
    expect(indexSource).not.toContain('showFooter: true');
    expect(indexSource).toContain("keyField: 'accountKey'");
    expect(indexSource).toContain('useFinanceQuerySummary');
    expect(indexSource).toContain(
      'getReceivableAccountSummary(params, signal)',
    );
    expect(indexSource).toContain('<FinanceListQuerySummary');
    expect(indexSource).toContain(':error="querySummaryState.error.value"');
    expect(indexSource).toContain('@retry="querySummaryState.retry"');
    expect(indexSource).toContain('querySummaryState.cancelPending()');
    expect(indexSource).toContain('if (pageRows.value.length > 0)');
    expect(indexSource).toContain('refresh: { queryMethod: handleRefresh }');
    expect(indexSource).not.toContain('本页合计');
    expect(indexSource).toContain("label: '组合数'");
    expect(indexSource).toContain("label: '此前应收'");
    expect(indexSource).toContain("label: '其他应收款'");
    expect(indexSource).toContain("'openingReceivableBalance'");
    expect(indexSource).toContain("'miscReceivableAmount'");
    expect(indexSource).toContain(':dept-id="currentDeptId"');
    expect(indexSource).toContain(':dept-unassigned="currentDeptUnassigned"');
    expect(indexSource).toContain("titleParts.join(' / ')");
    expect(indexSource).toContain('<template #bottom>');
    expect(indexSource).toContain("getBaseDataSimpleList('sales_area')");
    expect(indexSource).toContain("getBaseDataSimpleList('customer_type')");
    expect(indexSource).toContain("getBaseDataSimpleList('route')");
    expect(indexSource).toContain('destroyOnClose: true');
    expect(indexSource).toContain("auth: ['erp:receivable-account:query']");
    expect(indexSource).toContain('@writeoff-success="handleRefresh"');
    expect(detailSource).not.toContain('writeOffReceivable');
    expect(detailSource).not.toContain("'erp:receivable-account:writeoff'");
    expect(detailSource).toContain("'erp:finance-receipt:writeoff'");
    expect(detailSource).toContain("keyField: 'rowKey'");
    expect(detailSource).toContain(
      'deptId: props.deptUnassigned ? undefined : props.deptId',
    );
    expect(detailSource).toContain(
      'deptUnassigned: props.deptUnassigned || undefined',
    );
    expect(detailSource).toContain('currentScopeText');
    expect(detailSource).toContain('props.deptId,');
    expect(detailSource).toContain('props.deptUnassigned,');
    expect(detailSource).toContain('withDetailRowKeys(data.list || [])');
    expect(detailSource).toContain('getReceivableDrilldownPage');
    expect(detailSource).toContain('exportReceivableDrilldown');
    expect(detailSource).toContain(
      "getReceivableAccountExportFields('drilldown',",
    );
    expect(detailSource).toContain('detailType: props.detailType');
    expect(detailSource).toContain('dateBasis: props.dateBasis');
    expect(detailSource).toContain("fields: fields.join(',')");
    expect(detailSource).toContain('getSaleOutDocNoMarkers(row)');
    expect(detailSource).toContain('row.bizType !== ErpBizType.SALE_OUT');
    expect(detailSource).toContain("markers.push('整退')");
    expect(detailSource).toContain("markers.push('部分退')");
    expect(detailSource).toContain("markers.push('调')");
    expect(detailSource).toContain('row.priceAdjusted === true');
    expect(detailSource).toContain('{{ row.docNo }}');
    expect(detailSource).not.toContain('row.docNo =');
    expect(detailSource).not.toContain("row.docNo + '（");
    expect(detailSource).toContain('import { Alert, message, Pagination }');
    expect(detailSource).not.toContain('按现有应收账户明细展示');
    expect(detailSource).not.toContain('不是商品维度经营分配');
    expect(detailSource).not.toContain('不计算正式回款率');
    expect(detailSource).toContain('v-if="loadError"');
    expect(detailSource).toContain('明细加载失败，请稍后重试');
    expect(detailSource).toContain('DETAIL_PAGE_SIZE_OPTIONS');
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
    expect(detailSource).toContain('@change="handlePageChange"');
    expect(detailSource).toContain("displayMode?: 'drawer' | 'modal'");
    expect(detailSource).toContain("displayMode: 'drawer'");
    expect(detailSource).toContain('detailGridHeight');
    expect(detailSource).toContain(
      "props.displayMode === 'modal' ? '50vh' : 'calc(100vh - 330px)'",
    );
    expect(detailSource).toContain('detailGridMinHeight');
    expect(detailSource).toContain("props.displayMode === 'modal' ? 360 : 520");
    expect(detailSource).toContain('height: detailGridHeight.value');
    expect(detailSource).toContain('minHeight: detailGridMinHeight.value');
    expect(detailSource).toMatch(/receivable-detail--\$\{displayMode\}/);
    expect(detailSource).toContain("'全部部门'");
    expect(detailSource).toContain('getFinanceReceipt(row.bizId)');
    expect(detailSource).toContain('financeCompare(financeValue(row.receiptAmount || 0), 0) !== 0');
    expect(detailSource).toContain(
      '#/views/erp/finance/settlement/receipt/modules/form.vue',
    );
    expect(detailSource).toContain('@writeoff="handleReceiptDetailWriteOff"');
    expect(detailSource).toContain('<ReceiptWriteOffModal');
    expect(detailSource).toContain('@success="handleReceiptWriteOffSuccess"');
    expect(detailSource).not.toContain('title="应收核销"');
    expect(detailSource).toContain("emit('writeoffSuccess')");
    expect(detailSource).toContain("auth: ['erp:receivable-account:query']");
    expect(
      (useDetailColumns() || []).some((column) => column.title === '操作'),
    ).toBe(true);
  });

  it('can initialize from a receipt customer receivable detail link', () => {
    expect(indexSource).toContain("import { useRoute } from 'vue-router'");
    expect(indexSource).toContain('const route = useRoute()');
    expect(indexSource).toContain('parseQueryNumber(route.query.customerId)');
    expect(indexSource).toContain('parseQueryString(route.query.customerName)');
    expect(indexSource).toContain("route.query.openDetail === '1'");
    expect(indexSource).toContain('function buildGridSearchSchema()');
    expect(indexSource).toContain('defaultValue: customerId');
    expect(indexSource).toContain(
      'schema: candidateSchema(buildGridSearchSchema())',
    );
    expect(indexSource).toContain('applyRouteCustomerFilter');
    expect(indexSource).toContain('formApi.setValues({ customerId }, false)');
    expect(indexSource).toContain('formApi.submitForm()');
    expect(indexSource).toContain('openRouteCustomerReceivableDetail');
    expect(indexSource).toContain('currentDeptId.value = undefined');
    expect(indexSource).toContain('currentDeptUnassigned.value = false');
    expect(indexSource).toContain('currentApproveTime.value = []');
    expect(indexSource).toContain('drawerApi');
    expect(indexSource).toContain('route.query.customerId');
    expect(indexSource).toContain('route.query.openDetail');
  });

  it('clears detail loading on failure and ignores stale requests', () => {
    expect(detailSource).toContain('const sequence = ++loadSequence');
    expect(detailSource).toContain('if (sequence !== loadSequence) return');
    expect(detailSource).toContain('loadError.value =');
    expect(detailSource).toContain('明细加载失败，请稍后重试');
    expect(detailSource).toContain('loading.value = false');
    expect(detailSource).not.toContain('sortReceivableDetails(');
    expect(
      (useDetailColumns() || []).find((column) => column.field === 'deptName')
        ?.sortable,
    ).toBe(true);
    expect(detailSource).toContain('await renderDetailList()');
    expect(detailSource).toContain('receivable-detail-row--');
    expect(detailSource).toContain('getReceivableDetailPaymentState(row)');
    expect(detailSource).toContain('hsl(var(--primary) / 18%)');
    expect(detailSource).toContain('hsl(var(--destructive) / 18%)');
    expect(detailSource).toContain('hsl(var(--card))');
    expect(detailSource).toContain('收款核销状态图例');
    expect(detailSource).toContain('已收款但未收完');
    expect(detailSource).toContain('未进行收款');
    expect(detailSource).toContain("label: '增加合计'");
    expect(detailSource).toContain("label: '减少合计'");
    expect(detailSource).toContain("row.docType === '应收调账'");
    expect(detailSource).toContain('ErpBizType.RECEIVABLE_MISC');
    expect(detailSource).toContain('MiscReceivableModal');
    expect(detailSource).not.toContain('miscReceivableAmount');
    expect(detailSource).not.toContain("maxHeight: 'calc(100vh - 220px)'");
    expect(detailSource).not.toContain('class="receivable-detail h-full"');
  });

  it('maps only supported amounts to accessible server drilldowns', () => {
    const columns = useGridColumns() as any[];
    const clickableFields = columns
      .filter((column) => column.slots?.default === 'amountDrilldown')
      .map((column) => column.field);
    expect(clickableFields).toEqual([
      'receivableBalance',
      'openingReceivableBalance',
      'miscReceivableAmount',
      'receiptAmount',
      'saleOutAmount',
      'saleReturnAmount',
    ]);
    expect(clickableFields).not.toContain('preAdvanceAmount');
    expect(clickableFields).not.toContain('baseAmount');
    expect(useDrilldownColumns([], '其他应收款')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'changeAmount', title: '其他应收款' }),
        expect.objectContaining({ field: 'prevBalance', title: '上笔累计' }),
        expect.objectContaining({ field: 'balance', title: '累计金额' }),
      ]),
    );
    expect(detailSource).toContain('detailType: props.detailType');
    expect(detailSource).toContain('pageNo: detailPagination.value.pageNo');
    expect(detailSource).toContain('orderField: activeDetailSort.value?.field');
    expect(detailSource).toContain(
      'receiptDisplayAmount: row.receiptDisplayAmount ?? row.receiptAmount',
    );
    expect(detailSource).toContain(
      "dateBasis === 'approveTime' ? '审批' : '业务'",
    );
  });
});
