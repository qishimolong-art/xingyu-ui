<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';

import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import LegacyReport from './legacy.vue';
import PurchaseBusinessReportTable from './modules/purchase-business-report-table.vue';
import PurchaseFulfillmentReadonlyTable from './modules/purchase-fulfillment-readonly-table.vue';
import PurchaseInDetailReportTable from './modules/purchase-in-detail-report-table.vue';
import PurchaseInvoiceDetailReportTable from './modules/purchase-invoice-detail-report-table.vue';
import PurchaseOrderDetailReportTable from './modules/purchase-order-detail-report-table.vue';
import PurchaseReturnAdjustReadonlyTable from './modules/purchase-return-adjust-readonly-table.vue';
import SupplierPayableOverviewTable from './modules/supplier-payable-overview-table.vue';

defineOptions({ name: 'ErpPurchaseReport' });

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const canOld = computed(() => hasAccessByCodes(['erp:purchase-report:query']));
const canReport = computed(() => canOld.value);
const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/purchase' ||
      currentPath.value.startsWith('/erp/business-report/purchase/'))
  );
});
const canOrder = computed(() => hasAccessByCodes(['erp:purchase-order:query']));
const canOrderDetailReport = computed(() =>
  hasAccessByCodes(['erp:purchase-order-detail-report:query']),
);
const canInbound = computed(() => hasAccessByCodes(['erp:purchase-in:query']));
const canInDetailReport = computed(
  () =>
    hasAccessByCodes(['erp:purchase-in-detail-report:query']) &&
    hasAccessByCodes(['erp:purchase-in:query']) &&
    hasAccessByCodes(['erp:purchase-return:query']) &&
    hasAccessByCodes(['erp:purchase-price-adjust:query']),
);
const canInvoiceDetailReport = computed(
  () =>
    hasAccessByCodes(['erp:purchase-invoice-detail-report:query']) &&
    hasAccessByCodes(['erp:purchase-invoice:query']),
);
const canPayable = computed(() =>
  hasAccessByCodes(['erp:payable-account:query']),
);
const canReturn = computed(() =>
  hasAccessByCodes(['erp:purchase-return:query']),
);
const canAdjust = computed(() =>
  hasAccessByCodes(['erp:purchase-price-adjust:query']),
);

type PageKey =
  | 'adjust'
  | 'detail'
  | 'in-detail'
  | 'invoice-detail'
  | 'inbound'
  | 'legacy'
  | 'order'
  | 'order-detail'
  | 'payable'
  | 'price-trend'
  | 'product-summary'
  | 'quality-score'
  | 'return'
  | 'staff-summary'
  | 'supplier-analysis'
  | 'supplier-summary';

const pagePermissions: Record<PageKey, () => boolean> = {
  adjust: () => canAdjust.value,
  detail: () => canReport.value,
  inbound: () => canInbound.value,
  'in-detail': () => canInDetailReport.value,
  'invoice-detail': () => canInvoiceDetailReport.value,
  legacy: () => canOld.value,
  order: () => canOrder.value,
  'order-detail': () => canOrderDetailReport.value,
  payable: () => canPayable.value,
  'price-trend': () => canReport.value,
  'product-summary': () => canReport.value,
  'quality-score': () => canReport.value,
  return: () => canReturn.value,
  'staff-summary': () => canReport.value,
  'supplier-analysis': () => canReport.value,
  'supplier-summary': () => canReport.value,
};

const pageTitles: Record<PageKey, string> = {
  adjust: '采购调价业务',
  detail: '采购综合明细',
  inbound: '到货/入库分析',
  'in-detail': '配件入库明细查询报表',
  'invoice-detail': '采购票据明细查询',
  legacy: '历史口径',
  order: '采购订单履约',
  'order-detail': '配件订货明细表',
  payable: '供应商付款/应付概览',
  'price-trend': '采购价格波动',
  'product-summary': '商品采购汇总',
  'quality-score': '供应商质量/履约评分',
  return: '采购退货分析',
  'staff-summary': '采购员/部门汇总',
  'supplier-analysis': '供应商经营分析',
  'supplier-summary': '供应商采购汇总',
};

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'detail';
  const key = value.split('/').findLast(Boolean) as PageKey | undefined;
  return key && key in pageTitles ? key : 'detail';
}

const pageKey = computed(() => normalizePageKey(route?.path));
const pageTitle = computed(() => pageTitles[pageKey.value]);
const shellTitle = computed(() =>
  pageKey.value === 'order-detail' ||
  pageKey.value === 'in-detail' ||
  pageKey.value === 'invoice-detail'
    ? ''
    : `经营报表 · 采购管理 · ${pageTitle.value}`,
);
const canCurrentPage = computed(() => {
  if (pageKey.value === 'order-detail') return canOrderDetailReport.value;
  if (pageKey.value === 'in-detail') return canInDetailReport.value;
  if (pageKey.value === 'invoice-detail') return canInvoiceDetailReport.value;
  return canCurrentMenu.value || (pagePermissions[pageKey.value]?.() ?? false);
});
</script>

<template>
  <BusinessReportShell
    :title="shellTitle"
    :denied="!canCurrentPage"
    :body-scrollable="
      pageKey !== 'order-detail' &&
      pageKey !== 'in-detail' &&
      pageKey !== 'invoice-detail'
    "
  >
    <PurchaseBusinessReportTable
      v-if="pageKey === 'detail'"
      title="采购入库及退货综合明细"
      variant="detail"
    />
    <PurchaseBusinessReportTable
      v-else-if="pageKey === 'supplier-summary'"
      title="供应商采购汇总"
      variant="supplier"
    />
    <PurchaseBusinessReportTable
      v-else-if="pageKey === 'product-summary'"
      title="商品采购汇总"
      variant="product"
    />
    <PurchaseBusinessReportTable
      v-else-if="pageKey === 'staff-summary'"
      title="采购员/部门采购汇总"
      variant="dept"
    />
    <PurchaseBusinessReportTable
      v-else-if="pageKey === 'price-trend'"
      title="采购价格波动"
      variant="price"
    />
    <PurchaseFulfillmentReadonlyTable
      v-else-if="pageKey === 'order'"
      mode="order"
    />
    <PurchaseOrderDetailReportTable v-else-if="pageKey === 'order-detail'" />
    <PurchaseInDetailReportTable v-else-if="pageKey === 'in-detail'" />
    <PurchaseInvoiceDetailReportTable
      v-else-if="pageKey === 'invoice-detail'"
    />
    <PurchaseFulfillmentReadonlyTable
      v-else-if="pageKey === 'inbound'"
      mode="inbound"
    />
    <PurchaseReturnAdjustReadonlyTable
      v-else-if="pageKey === 'return'"
      mode="return"
    />
    <PurchaseReturnAdjustReadonlyTable
      v-else-if="pageKey === 'adjust'"
      mode="adjust"
    />
    <SupplierPayableOverviewTable v-else-if="pageKey === 'payable'" />
    <PurchaseBusinessReportTable
      v-else-if="pageKey === 'supplier-analysis'"
      title="供应商经营分析"
      variant="supplier-analysis"
    />
    <PurchaseBusinessReportTable
      v-else-if="pageKey === 'quality-score'"
      title="供应商质量及履约评分"
      variant="quality"
    />
    <LegacyReport v-else-if="pageKey === 'legacy'" />
  </BusinessReportShell>
</template>
