import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const saleSource = readFileSync(
  join(currentDir, '../../sale/report/index.vue'),
  'utf8',
);
const purchaseSource = readFileSync(
  join(currentDir, '../../purchase/report/index.vue'),
  'utf8',
);
const tradeSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const tradeApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/report/trade-v2/index.ts'),
  'utf8',
);
const receivableAccountApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/finance/receivable/account/index.ts'),
  'utf8',
);
const payableAccountApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/finance/payable/account/index.ts'),
  'utf8',
);
const pickDeliveryReadonlySource = readFileSync(
  join(
    currentDir,
    '../../sale/report/modules/pick-delivery-readonly-table.vue',
  ),
  'utf8',
);
const customerReceivableOverviewSource = readFileSync(
  join(
    currentDir,
    '../../sale/report/modules/customer-receivable-overview-table.vue',
  ),
  'utf8',
);
const receivableAccountDetailDrawerSource = readFileSync(
  join(
    currentDir,
    '../../finance/receivable/account/modules/detail-drawer.vue',
  ),
  'utf8',
);
const payableAccountDetailDrawerSource = readFileSync(
  join(currentDir, '../../finance/payable/account/modules/detail-drawer.vue'),
  'utf8',
);
const saleOrderFulfillmentReadonlySource = readFileSync(
  join(
    currentDir,
    '../../sale/report/modules/sale-order-fulfillment-readonly-table.vue',
  ),
  'utf8',
);
const saleReturnAdjustReadonlySource = readFileSync(
  join(
    currentDir,
    '../../sale/report/modules/sale-return-adjust-readonly-table.vue',
  ),
  'utf8',
);
const saleBusinessReportTableSource = readFileSync(
  join(currentDir, '../../sale/report/modules/sale-business-report-table.vue'),
  'utf8',
);
const purchaseBusinessReportTableSource = readFileSync(
  join(
    currentDir,
    '../../purchase/report/modules/purchase-business-report-table.vue',
  ),
  'utf8',
);
const purchaseFulfillmentReadonlySource = readFileSync(
  join(
    currentDir,
    '../../purchase/report/modules/purchase-fulfillment-readonly-table.vue',
  ),
  'utf8',
);
const supplierPayableOverviewSource = readFileSync(
  join(
    currentDir,
    '../../purchase/report/modules/supplier-payable-overview-table.vue',
  ),
  'utf8',
);
const purchaseReturnAdjustReadonlySource = readFileSync(
  join(
    currentDir,
    '../../purchase/report/modules/purchase-return-adjust-readonly-table.vue',
  ),
  'utf8',
);

describe('经营报表销售采购综合入口契约', () => {
  it('mounts sales customer operation report under the unified business report shell', () => {
    expect(saleSource).toContain('BusinessReportShell');
    expect(saleSource).toContain('经营报表 · 销售及客户经营');
    expect(saleSource).toContain('SaleBusinessReportTable');
    expect(saleSource).toContain('useRoute');
    expect(saleSource).toContain("detail: '销售综合明细'");
    expect(saleSource).toContain("'customer-summary': '客户销售汇总'");
    expect(saleSource).toContain("'product-summary': '商品销售汇总'");
    expect(saleSource).toContain("'staff-summary': '业务员/部门汇总'");
    expect(saleSource).toContain("'gross-warning': '价格毛利异常'");
    expect(saleSource).toContain('normalizePageKey(route?.path)');
    expect(saleSource).toContain('variant="detail"');
    expect(saleSource).toContain('variant="customer"');
    expect(saleSource).toContain('variant="product"');
    expect(saleSource).toContain('variant="dept"');
    expect(saleSource).toContain('variant="gross"');
    expect(saleSource).toContain("hasAccessByCodes(['erp:sale-report:query'])");
    expect(saleSource).toContain('销售出库及退货综合明细');
    expect(saleSource).toContain('客户销售汇总');
    expect(saleSource).toContain('商品销售汇总');
    expect(saleSource).toContain('部门销售汇总');
    expect(saleSource).toContain('销售价格及毛利异常');
    expect(saleBusinessReportTableSource).toContain('getSaleReportDetailPage');
    expect(saleBusinessReportTableSource).toContain('getSaleReportProductPage');
    expect(saleBusinessReportTableSource).toContain('getSaleReportDeptPage');
    expect(saleBusinessReportTableSource).toContain(
      'exportSaleReportDetailPage',
    );
    expect(saleBusinessReportTableSource).toContain('成本快照缺失');
    expect(saleBusinessReportTableSource).toContain('不可计算');
    expect(saleBusinessReportTableSource).toContain('规则未启用');
    expect(saleBusinessReportTableSource).toContain('BusinessReportEmptyState');
    expect(saleSource).not.toContain('第一阶段');
    expect(saleSource).not.toContain('只读复用');
    expect(saleSource).not.toContain('后续配置');
    expect(saleSource).not.toContain('销售价暂按含税金额展示');
    expect(saleSource).toContain('销售订单履约');
    expect(saleSource).toContain('退货原因分析');
    expect(saleSource).toContain('销售调价业务');
    expect(saleSource).toContain('历史口径');
  });

  it('lets the shared trade report render customer-facing preset report tabs', () => {
    expect(tradeSource).toContain('initialGroupBy?: string');
    expect(tradeSource).toContain('initialView?: TradeReportView');
    expect(tradeSource).toContain('reportDescription?: string');
    expect(tradeSource).toContain('reportTitle?: string');
    expect(tradeSource).toContain(
      'const view = ref<TradeReportView>(props.initialView)',
    );
    expect(tradeSource).toContain('const groupBy = ref(props.initialGroupBy)');
    expect(tradeSource).toContain('view.value = props.initialView');
    expect(tradeSource).toContain('groupBy.value = props.initialGroupBy');
    expect(tradeSource).toContain('trade-report__heading');
    expect(tradeSource).toContain('销售商品综合表');
    expect(tradeSource).toContain('采购商品综合表');
  });

  it('adds readonly pick, delivery, and receivable tabs to the sales operation report', () => {
    expect(saleSource).toContain('PickDeliveryReadonlyTable');
    expect(saleSource).toContain('CustomerReceivableOverviewTable');
    expect(saleSource).toContain('SaleOrderFulfillmentReadonlyTable');
    expect(saleSource).toContain('SaleReturnAdjustReadonlyTable');
    expect(saleSource).toContain("hasAccessByCodes(['erp:sale-order:query'])");
    expect(saleSource).toContain("hasAccessByCodes(['erp:sale-pick:query'])");
    expect(saleSource).toContain("hasAccessByCodes(['erp:sale-return:query'])");
    expect(saleSource).toContain(
      "hasAccessByCodes(['erp:sale-price-adjust:query'])",
    );
    expect(saleSource).toContain(
      "hasAccessByCodes(['erp:sale-delivery:query'])",
    );
    expect(saleSource).toContain(
      "hasAccessByCodes(['erp:receivable-account:query'])",
    );
    expect(saleSource).toContain("order: '销售订单履约'");
    expect(saleSource).toContain("pick: '拣货明细查询'");
    expect(saleSource).toContain("delivery: '送货明细查询'");
    expect(saleSource).toContain("receivable: '客户经营分析'");
    expect(saleSource).toContain("return: '退货原因分析'");
    expect(saleSource).toContain("adjust: '销售调价业务'");
    expect(pickDeliveryReadonlySource).toContain(
      'getSalePickDeliveryDetailReportPage',
    );
    expect(pickDeliveryReadonlySource).toContain(
      'getSalePickDeliveryDetailReportSummary',
    );
    expect(pickDeliveryReadonlySource).toContain(
      'exportSalePickDeliveryDetailReport',
    );
    for (const forbidden of [
      'submitSalePick',
      'submitSaleDelivery',
      'uploadSalePickVoucher',
      'uploadSaleDeliveryVoucher',
      'getSalePick(',
      'getSaleDelivery(',
    ]) {
      expect(pickDeliveryReadonlySource).not.toContain(forbidden);
    }
    expect(saleOrderFulfillmentReadonlySource).toContain('getSaleOrderPage');
    expect(saleOrderFulfillmentReadonlySource).toContain('exportSaleOrder');
    expect(saleOrderFulfillmentReadonlySource).toContain('handleExport');
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'deptName'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'inCount'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'totalProductPrice'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'discountPercent'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'discountPrice'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'feeAmount'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'productNames'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'fileUrl'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      '采购入库：{{ formatNumber(pageSummary.inCount) }}',
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      '产品金额：{{ formatMoney(pageSummary.totalProductPrice) }}',
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      '优惠金额：{{ formatMoney(pageSummary.discountPrice) }}',
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      '费用金额：{{ formatMoney(pageSummary.feeAmount) }}',
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'creatorName'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'createTime'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'updaterName'",
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      "dataIndex: 'updateTime'",
    );
    for (const forbidden of [
      'createSaleOrder',
      'updateSaleOrder',
      'updateSaleOrderStatus',
      'deleteSaleOrder',
      'importSaleOrder',
      'getSaleOrder(',
    ]) {
      expect(saleOrderFulfillmentReadonlySource).not.toContain(forbidden);
    }
    expect(saleReturnAdjustReadonlySource).toContain('getSaleReturnPage');
    expect(saleReturnAdjustReadonlySource).toContain('exportSaleReturn');
    expect(saleReturnAdjustReadonlySource).toContain('exportSalePriceAdjust');
    expect(saleReturnAdjustReadonlySource).toContain('getSalePriceAdjustPage');
    expect(saleReturnAdjustReadonlySource).toContain(
      '销售退货原因及退货率分析',
    );
    expect(saleReturnAdjustReadonlySource).toContain(
      "dataIndex: 'invoiceType'",
    );
    expect(saleReturnAdjustReadonlySource).toContain(
      "dataIndex: 'settleMethod'",
    );
    expect(saleReturnAdjustReadonlySource).toContain(
      "dataIndex: 'deliveryMethod'",
    );
    expect(saleReturnAdjustReadonlySource).toContain(
      "dataIndex: 'logisticsCompany'",
    );
    expect(saleReturnAdjustReadonlySource).toContain(
      "dataIndex: 'creatorName'",
    );
    expect(saleReturnAdjustReadonlySource).toContain("dataIndex: 'createTime'");
    expect(saleReturnAdjustReadonlySource).toContain(
      "dataIndex: 'updaterName'",
    );
    expect(saleReturnAdjustReadonlySource).toContain("dataIndex: 'updateTime'");
    for (const forbidden of [
      'createSaleReturn',
      'updateSaleReturnStatus',
      'deleteSaleReturn',
      'createSalePriceAdjust',
      'deleteSalePriceAdjust',
      'getSaleReturn(',
      'getSalePriceAdjust(',
    ]) {
      expect(saleReturnAdjustReadonlySource).not.toContain(forbidden);
    }
    expect(customerReceivableOverviewSource).toContain(
      'getReceivableAccountPage',
    );
    for (const internalCopy of [
      '只读复用',
      '第一阶段',
      '后续接入',
      '后续配置',
      '待客户确认',
      '不提供新增',
      '不提供提交',
    ]) {
      expect(pickDeliveryReadonlySource).not.toContain(internalCopy);
      expect(saleOrderFulfillmentReadonlySource).not.toContain(internalCopy);
      expect(saleReturnAdjustReadonlySource).not.toContain(internalCopy);
      expect(customerReceivableOverviewSource).not.toContain(internalCopy);
    }
    expect(customerReceivableOverviewSource).toContain("dataIndex: 'actions'");
    expect(customerReceivableOverviewSource).toContain('handleOpenDetail');
    expect(customerReceivableOverviewSource).toContain(
      'ReceivableDetailDrawer',
    );
    expect(customerReceivableOverviewSource).toContain(
      'v-model:open="detailOpen"',
    );
    expect(customerReceivableOverviewSource).toContain('readonly');
    expect(customerReceivableOverviewSource).toContain('display-mode="drawer"');
    expect(customerReceivableOverviewSource).toContain(
      'exportReceivableAccount',
    );
    expect(customerReceivableOverviewSource).toContain(
      'downloadFileFromBlobPart',
    );
    for (const forbidden of [
      'writeOffReceivable',
      'exportReceivableDetail',
      'createReceipt',
      'updateReceipt',
    ]) {
      expect(customerReceivableOverviewSource).not.toContain(forbidden);
    }
  });

  it('opens a readonly receivable detail drawer from the customer receivable overview', () => {
    expect(customerReceivableOverviewSource).toContain('<Drawer');
    expect(customerReceivableOverviewSource).toContain('客户应收明细');
    expect(customerReceivableOverviewSource).toContain('明细');
    expect(customerReceivableOverviewSource).toContain(
      ':customer-id="currentCustomerId"',
    );
    expect(customerReceivableOverviewSource).toContain(
      ':dept-id="currentDeptId"',
    );
    expect(receivableAccountDetailDrawerSource).toContain('readonly?: boolean');
    expect(receivableAccountDetailDrawerSource).toContain(
      'getReceivableDetailList',
    );
    expect(receivableAccountApiSource).toContain(
      '/erp/receivable-account/detail',
    );
    expect(receivableAccountDetailDrawerSource).not.toContain(
      '按现有应收账户明细展示',
    );
    expect(receivableAccountDetailDrawerSource).not.toContain(
      '不是商品维度经营分配',
    );
    expect(receivableAccountDetailDrawerSource).not.toContain(
      '不计算正式回款率',
    );
    expect(receivableAccountDetailDrawerSource).not.toContain(
      '经营报表 · 销售及客户经营',
    );
    expect(receivableAccountDetailDrawerSource).toContain('loadError.value');
    expect(receivableAccountDetailDrawerSource).toContain(
      '应收明细加载失败，请稍后重试',
    );
    expect(receivableAccountDetailDrawerSource).toContain('v-if="!readonly"');
    expect(receivableAccountDetailDrawerSource).toContain(
      "slots?.default !== 'actions'",
    );
    expect(receivableAccountDetailDrawerSource).toContain('核销金额');
  });

  it('mounts purchase supplier operation report as independent business report pages', () => {
    expect(purchaseSource).toContain('BusinessReportShell');
    expect(purchaseSource).toContain('经营报表 · 采购及供应商经营');
    expect(purchaseSource).toContain('useRoute');
    expect(purchaseSource).toContain('PurchaseBusinessReportTable');
    expect(purchaseSource).toContain('PurchaseFulfillmentReadonlyTable');
    expect(purchaseSource).toContain('PurchaseReturnAdjustReadonlyTable');
    expect(purchaseSource).toContain('SupplierPayableOverviewTable');
    expect(purchaseSource).toContain('body-scrollable');
    expect(purchaseSource).toContain("pageKey === 'detail'");
    expect(purchaseSource).toContain("pageKey === 'supplier-summary'");
    expect(purchaseSource).toContain("pageKey === 'product-summary'");
    expect(purchaseSource).toContain("pageKey === 'staff-summary'");
    expect(purchaseSource).toContain("pageKey === 'price-trend'");
    expect(purchaseSource).toContain("pageKey === 'order'");
    expect(purchaseSource).toContain("pageKey === 'inbound'");
    expect(purchaseSource).toContain("pageKey === 'return'");
    expect(purchaseSource).toContain("pageKey === 'adjust'");
    expect(purchaseSource).toContain("pageKey === 'payable'");
    expect(purchaseSource).toContain("pageKey === 'supplier-analysis'");
    expect(purchaseSource).toContain("pageKey === 'quality-score'");
    expect(purchaseSource).toContain("pageKey === 'legacy'");
    expect(purchaseSource).not.toContain('erp-business-report-tabs');
    expect(purchaseSource).not.toContain('TradeReport');
    expect(purchaseSource).not.toContain('采购价暂按含税金额展示');
    expect(purchaseSource).not.toContain('只读复用');
  });

  it('adds customer-facing purchase business report table and keeps readonly source pages clean', () => {
    expect(purchaseBusinessReportTableSource).toContain(
      'getPurchaseReportSummary',
    );
    expect(purchaseBusinessReportTableSource).toContain(
      'getPurchaseReportTrend',
    );
    expect(purchaseBusinessReportTableSource).toContain(
      'getPurchaseReportPage',
    );
    expect(purchaseBusinessReportTableSource).toContain(
      'getPurchaseReportProductPage',
    );
    expect(purchaseBusinessReportTableSource).toContain(
      'getPurchaseReportDeptPage',
    );
    expect(purchaseBusinessReportTableSource).toContain(
      'getPurchaseReportDetailPage',
    );
    expect(purchaseBusinessReportTableSource).toContain('exportPurchaseReport');
    expect(purchaseBusinessReportTableSource).toContain(
      'exportPurchaseReportProduct',
    );
    expect(purchaseBusinessReportTableSource).toContain(
      'exportPurchaseReportDept',
    );
    expect(purchaseBusinessReportTableSource).toContain(
      'exportPurchaseReportDetail',
    );
    expect(purchaseBusinessReportTableSource).toContain('供应商质量/履约评分');
    expect(purchaseBusinessReportTableSource).toContain('采购价格波动');
    expect(purchaseBusinessReportTableSource).toContain('待规则确认');
    expect(purchaseBusinessReportTableSource).toContain(
      ':scroll="{ x: \'max-content\' }"',
    );
    expect(purchaseFulfillmentReadonlySource).toContain('getPurchaseOrderPage');
    expect(purchaseFulfillmentReadonlySource).toContain('getPurchaseInPage');
    expect(purchaseFulfillmentReadonlySource).toContain('exportPurchaseOrder');
    expect(purchaseFulfillmentReadonlySource).toContain('exportPurchaseIn');
    expect(purchaseFulfillmentReadonlySource).toContain('handleExport');
    expect(purchaseFulfillmentReadonlySource).not.toContain('只读复用');
    expect(purchaseFulfillmentReadonlySource).not.toContain("y: '100%'");
    expect(purchaseReturnAdjustReadonlySource).toContain(
      'getPurchaseReturnPage',
    );
    expect(purchaseReturnAdjustReadonlySource).toContain(
      'getPurchasePriceAdjustPage',
    );
    expect(purchaseReturnAdjustReadonlySource).toContain(
      'exportPurchaseReturn',
    );
    expect(purchaseReturnAdjustReadonlySource).toContain(
      'exportPurchasePriceAdjust',
    );
    expect(purchaseReturnAdjustReadonlySource).toContain('handleExport');
    expect(purchaseReturnAdjustReadonlySource).not.toContain('只读复用');
    expect(purchaseReturnAdjustReadonlySource).not.toContain("y: '100%'");
    expect(supplierPayableOverviewSource).toContain('getPayableAccountPage');
    expect(supplierPayableOverviewSource).toContain('exportPayableAccount');
    expect(supplierPayableOverviewSource).toContain('handleExport');
    expect(supplierPayableOverviewSource).toContain('handleOpenDetail');
    expect(supplierPayableOverviewSource).not.toContain('只读复用');
    expect(supplierPayableOverviewSource).not.toContain("y: '100%'");
    for (const forbidden of [
      'createPurchaseOrder',
      'updatePurchaseOrder',
      'submitPurchaseOrder',
      'deletePurchaseOrder',
      'getPurchaseOrder(',
      'createPurchaseIn',
      'updatePurchaseIn',
      'submitPurchaseIn',
      'deletePurchaseIn',
      'getPurchaseIn(',
      'createPurchaseReturn',
      'updatePurchaseReturn',
      'submitPurchaseReturn',
      'deletePurchaseReturn',
      'createPurchasePriceAdjust',
      'updatePurchasePriceAdjust',
      'deletePurchasePriceAdjust',
      'getPurchaseReturn(',
      'getPurchasePriceAdjust(',
    ]) {
      expect(
        purchaseFulfillmentReadonlySource + purchaseReturnAdjustReadonlySource,
      ).not.toContain(forbidden);
    }
  });

  it('opens a readonly payable detail drawer from the supplier payable overview', () => {
    expect(supplierPayableOverviewSource).toContain('<Drawer');
    expect(supplierPayableOverviewSource).toContain('供应商应付明细');
    expect(supplierPayableOverviewSource).toContain('明细');
    expect(supplierPayableOverviewSource).toContain(
      ':supplier-id="currentSupplierId"',
    );
    expect(supplierPayableOverviewSource).toContain(
      ':supplier-name="currentSupplierName"',
    );
    expect(payableAccountDetailDrawerSource).toContain('readonly?: boolean');
    expect(payableAccountDetailDrawerSource).toContain('getPayableDetailList');
    expect(payableAccountApiSource).toContain('/erp/payable-account/detail');
    expect(payableAccountDetailDrawerSource).not.toContain(
      '按现有应付账户明细展示',
    );
    expect(payableAccountDetailDrawerSource).not.toContain(
      '不是商品维度经营分配',
    );
    expect(payableAccountDetailDrawerSource).not.toContain('不计算正式付款率');
    expect(payableAccountDetailDrawerSource).not.toContain(
      '经营报表 · 采购及供应商经营',
    );
    expect(payableAccountDetailDrawerSource).toContain('loadError.value');
    expect(payableAccountDetailDrawerSource).toContain(
      '应付明细加载失败，请稍后重试',
    );
    expect(payableAccountDetailDrawerSource).toContain('v-if="!readonly"');
    expect(payableAccountDetailDrawerSource).toContain(
      "slots?.default !== 'actions'",
    );
    expect(payableAccountDetailDrawerSource).toContain('核销金额');
  });

  it('keeps sales and purchase report pages scrollable inside the report shell', () => {
    expect(saleSource).not.toContain(
      'class="erp-business-report-tabs erp-sale-report-tabs"',
    );
    expect(purchaseSource).not.toContain(
      'class="erp-business-report-tabs erp-purchase-report-tabs"',
    );
    expect(purchaseBusinessReportTableSource).toContain(
      ':scroll="{ x: \'max-content\' }"',
    );
    expect(purchaseBusinessReportTableSource).not.toContain("y: '100%'");
    expect(tradeSource).toContain(
      'class="trade-report flex h-full min-h-0 flex-col space-y-2"',
    );
    expect(tradeSource).toContain('class="trade-report__table-area"');
    expect(tradeSource).toContain(
      ":scroll=\"{ x: 'max-content', y: '100%' }\"",
    );
    expect(tradeSource).toMatch(
      /\.trade-report__table-area\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 320px;[\s\S]*?min-height:\s*260px;[\s\S]*?\}/,
    );
    expect(tradeSource).toMatch(
      /\.trade-report__table\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?flex-direction:\s*column;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(tradeSource).toMatch(
      /:deep\(\.ant-table-body\)\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(tradeSource).not.toContain("y: 'calc(100vh - 410px)'");
    expect(tradeSource).not.toContain('calc(100vh - 410px)');
    expect(pickDeliveryReadonlySource).toContain(
      'scrollX: { enabled: true, gt: 8 }',
    );
    expect(pickDeliveryReadonlySource).toContain(
      '.sale-pick-delivery-detail-report',
    );
    expect(pickDeliveryReadonlySource).toContain('height: 100%');
    expect(customerReceivableOverviewSource).toContain(
      '.customer-receivable-overview-table',
    );
    expect(customerReceivableOverviewSource).toContain(
      '.customer-receivable-overview-table__table',
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      '.sale-order-fulfillment-readonly-table',
    );
    expect(saleOrderFulfillmentReadonlySource).toContain(
      '.sale-order-fulfillment-readonly-table__table',
    );
    expect(saleReturnAdjustReadonlySource).toContain(
      '.sale-return-adjust-readonly-table',
    );
    expect(saleReturnAdjustReadonlySource).toContain(
      '.sale-return-adjust-readonly-table__table',
    );
    expect(purchaseFulfillmentReadonlySource).toContain(
      ':scroll="{ x: isOrder ? 3300 : 3600 }"',
    );
    expect(purchaseFulfillmentReadonlySource).not.toContain("y: '100%'");
    expect(purchaseFulfillmentReadonlySource).toContain(
      '.purchase-fulfillment-readonly-table__table',
    );
    expect(supplierPayableOverviewSource).toContain(':scroll="{ x: 1580 }"');
    expect(supplierPayableOverviewSource).not.toContain("y: '100%'");
    expect(supplierPayableOverviewSource).toContain(
      '.supplier-payable-overview-table__table',
    );
    expect(purchaseReturnAdjustReadonlySource).toContain(
      ':scroll="{ x: isReturn ? 2900 : 2220 }"',
    );
    expect(purchaseReturnAdjustReadonlySource).not.toContain("y: '100%'");
    expect(purchaseReturnAdjustReadonlySource).toContain(
      '.purchase-return-adjust-readonly-table__table',
    );
  });

  it('uses the v2 trade API without changing legacy sales or purchase APIs', () => {
    expect(tradeApiSource).toContain(
      'const base = (kind: TradeReportApi.Kind) => `/erp/business-report/',
    );
    expect(tradeApiSource).toContain('-v2`;');
    expect(tradeApiSource).toContain('getTradeStatus');
    expect(tradeApiSource).toContain('getTradePage');
    expect(tradeApiSource).toContain('exportTradeReport');
    expect(saleSource).toContain('LegacyReport');
    expect(purchaseSource).toContain('LegacyReport');
  });
});
