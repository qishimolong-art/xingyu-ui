<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';

import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import LegacyReport from './legacy.vue';
import CustomerReceivableOverviewTable from './modules/customer-receivable-overview-table.vue';
import PickDeliveryReadonlyTable from './modules/pick-delivery-readonly-table.vue';
import SaleBusinessReportTable from './modules/sale-business-report-table.vue';
import SaleOutDetailReportTable from './modules/sale-out-detail-report-table.vue';
import SaleOrderFulfillmentReadonlyTable from './modules/sale-order-fulfillment-readonly-table.vue';
import SaleQuoteDetailReportTable from './modules/sale-quote-detail-report-table.vue';
import SaleReturnAdjustReadonlyTable from './modules/sale-return-adjust-readonly-table.vue';

defineOptions({ name: 'ErpSaleReport' });

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const canOld = computed(() => hasAccessByCodes(['erp:sale-report:query']));
const canReport = computed(() => canOld.value);
const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/sale' ||
      currentPath.value.startsWith('/erp/business-report/sale/'))
  );
});
const canOrder = computed(() => hasAccessByCodes(['erp:sale-order:query']));
const canQuote = computed(() => hasAccessByCodes(['erp:sale-quote:query']));
const canQuoteDetailReport = computed(
  () =>
    hasAccessByCodes(['erp:sale-quote-detail-report:query']) && canQuote.value,
);
const canPick = computed(() => hasAccessByCodes(['erp:sale-pick:query']));
const canDelivery = computed(() =>
  hasAccessByCodes(['erp:sale-delivery:query']),
);
const canPickDetailReport = computed(
  () =>
    hasAccessByCodes(['erp:sale-pick-detail-report:query']) && canPick.value,
);
const canDeliveryDetailReport = computed(
  () =>
    hasAccessByCodes(['erp:sale-delivery-detail-report:query']) &&
    canDelivery.value,
);
const canReceivable = computed(() =>
  hasAccessByCodes(['erp:receivable-account:query']),
);
const canReturn = computed(() => hasAccessByCodes(['erp:sale-return:query']));
const canAdjust = computed(() =>
  hasAccessByCodes(['erp:sale-price-adjust:query']),
);
const canOut = computed(() => hasAccessByCodes(['erp:sale-out:query']));
const canOutDetailReport = computed(
  () =>
    hasAccessByCodes(['erp:sale-out-detail-report:query']) &&
    canOut.value &&
    canReturn.value &&
    canAdjust.value,
);

type PageKey =
  | 'adjust'
  | 'customer-summary'
  | 'delivery'
  | 'detail'
  | 'gross-warning'
  | 'legacy'
  | 'order'
  | 'out-detail'
  | 'pick'
  | 'product-summary'
  | 'receivable'
  | 'quote-detail'
  | 'return'
  | 'staff-summary';

const pagePermissions: Record<PageKey, () => boolean> = {
  adjust: () => canAdjust.value,
  'customer-summary': () => canReport.value,
  delivery: () => canDeliveryDetailReport.value,
  detail: () => canReport.value,
  'gross-warning': () => canReport.value,
  legacy: () => canOld.value,
  order: () => canOrder.value,
  'out-detail': () => canOutDetailReport.value,
  pick: () => canPickDetailReport.value,
  'product-summary': () => canReport.value,
  receivable: () => canReceivable.value,
  'quote-detail': () => canQuoteDetailReport.value,
  return: () => canReturn.value,
  'staff-summary': () => canReport.value,
};

const pageTitles: Record<PageKey, string> = {
  adjust: '销售调价业务',
  'customer-summary': '客户销售汇总',
  delivery: '送货明细查询',
  detail: '销售综合明细',
  'gross-warning': '价格毛利异常',
  legacy: '历史口径',
  order: '销售订单履约',
  'out-detail': '配件出库明细查询报表',
  pick: '拣货明细查询',
  'product-summary': '商品销售汇总',
  receivable: '客户经营分析',
  'quote-detail': '配件报价订单明细表',
  return: '退货原因分析',
  'staff-summary': '业务员/部门汇总',
};

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'detail';
  const key = value.split('/').findLast(Boolean) as PageKey | undefined;
  return key && key in pageTitles ? key : 'detail';
}

const pageKey = computed(() => normalizePageKey(route?.path));
const pageTitle = computed(() => pageTitles[pageKey.value]);
const isDetailReport = computed(
  () =>
    pageKey.value === 'quote-detail' ||
    pageKey.value === 'out-detail' ||
    pageKey.value === 'pick' ||
    pageKey.value === 'delivery',
);
const shellTitle = computed(() =>
  isDetailReport.value ? '' : `经营报表 · 销售及客户经营 · ${pageTitle.value}`,
);
const canCurrentPage = computed(() => {
  if (pageKey.value === 'quote-detail') return canQuoteDetailReport.value;
  if (pageKey.value === 'out-detail') return canOutDetailReport.value;
  if (pageKey.value === 'pick') return canPickDetailReport.value;
  if (pageKey.value === 'delivery') return canDeliveryDetailReport.value;
  return canCurrentMenu.value || (pagePermissions[pageKey.value]?.() ?? false);
});
</script>

<template>
  <BusinessReportShell
    :title="shellTitle"
    :denied="!canCurrentPage"
    :body-scrollable="!isDetailReport"
  >
    <SaleBusinessReportTable
      v-if="pageKey === 'detail'"
      title="销售出库及退货综合明细"
      variant="detail"
    />
    <SaleBusinessReportTable
      v-else-if="pageKey === 'customer-summary'"
      title="客户销售汇总"
      variant="customer"
    />
    <SaleBusinessReportTable
      v-else-if="pageKey === 'product-summary'"
      title="商品销售汇总"
      variant="product"
    />
    <SaleBusinessReportTable
      v-else-if="pageKey === 'staff-summary'"
      title="业务员/部门销售汇总"
      variant="dept"
    />
    <SaleBusinessReportTable
      v-else-if="pageKey === 'gross-warning'"
      title="销售价格及毛利异常"
      variant="gross"
    />
    <SaleOrderFulfillmentReadonlyTable v-else-if="pageKey === 'order'" />
    <SaleQuoteDetailReportTable v-else-if="pageKey === 'quote-detail'" />
    <SaleOutDetailReportTable v-else-if="pageKey === 'out-detail'" />
    <PickDeliveryReadonlyTable v-else-if="pageKey === 'pick'" mode="pick" />
    <PickDeliveryReadonlyTable
      v-else-if="pageKey === 'delivery'"
      mode="delivery"
    />
    <SaleReturnAdjustReadonlyTable
      v-else-if="pageKey === 'return'"
      mode="return"
    />
    <SaleReturnAdjustReadonlyTable
      v-else-if="pageKey === 'adjust'"
      mode="adjust"
    />
    <CustomerReceivableOverviewTable v-else-if="pageKey === 'receivable'" />
    <LegacyReport v-else-if="pageKey === 'legacy'" />
  </BusinessReportShell>
</template>
