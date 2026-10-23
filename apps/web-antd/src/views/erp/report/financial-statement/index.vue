<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';

import { Card, Tag } from 'ant-design-vue';

import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';
import SaleReturnAdjustReadonlyTable from '#/views/erp/sale/report/modules/sale-return-adjust-readonly-table.vue';

import PurchaseInInvoiceStatusReadonlyTable from './modules/purchase-in-invoice-status-readonly-table.vue';
import PurchaseInvoiceReadonlyTable from './modules/purchase-invoice-readonly-table.vue';
import SubjectReadonlyTable from './modules/subject-readonly-table.vue';
import VoucherAttributionReadonlyTable from './modules/voucher-attribution-readonly-table.vue';
import VoucherReadonlyTable from './modules/voucher-readonly-table.vue';
import VoucherWordReadonlyTable from './modules/voucher-word-readonly-table.vue';

defineOptions({ name: 'ErpReportFinancialStatement' });

type PageKey =
  | 'accounting-subject'
  | 'history'
  | 'overview'
  | 'purchase-in-invoice-status'
  | 'purchase-invoice'
  | 'sale-return-red-offset'
  | 'voucher'
  | 'voucher-attribution'
  | 'voucher-word';

type ReadinessItem = {
  description: string;
  status: string;
  title: string;
};

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const pageTitles: Record<PageKey, string> = {
  'accounting-subject': '会计科目及辅助核算',
  history: '历史财务口径',
  overview: '发票凭证及财务报表总览',
  'purchase-in-invoice-status': '采购入库开票状态',
  'purchase-invoice': '采购发票明细',
  'sale-return-red-offset': '销售退货红冲来源',
  voucher: '凭证明细',
  'voucher-attribution': '凭证归集来源',
  'voucher-word': '凭证字基础资料',
};

const pageDescriptions: Record<PageKey, string> = {
  'accounting-subject':
    '展示会计科目、科目类别、余额方向、辅助核算和启用状态，后续用于科目余额与明细账取数。',
  history:
    '保留当前可核对的发票、凭证、科目和财务报表来源入口，便于后续新旧口径切换比对。',
  overview:
    '按发票、凭证、科目和三大财务报表整理客户可见入口，正式金额以确认后的公式、凭证、科目余额、现金流项目和会计期间为准。',
  'purchase-in-invoice-status':
    '展示采购入库单的开票状态、供应商、部门、经办人、单据金额和结算状态。',
  'purchase-invoice':
    '展示采购发票、发票号、开票日期、税额、价税合计、附件状态和审核信息。',
  'sale-return-red-offset':
    '展示销售退货作为红冲来源的客户、退货金额、关联单据和审核状态。',
  voucher: '展示凭证日期、会计期间、摘要、借贷合计、来源业务和辅助核算信息。',
  'voucher-attribution': '展示业务单据来源、凭证生成检查、归属状态和原始金额。',
  'voucher-word': '展示凭证字代码、名称、启用状态、排序和备注。',
};

const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const pageKey = computed<PageKey>(() => normalizePageKey(currentPath.value));
const pageTitle = computed(() => pageTitles[pageKey.value]);
const pageDescription = computed(() => pageDescriptions[pageKey.value]);

const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/financial' ||
      currentPath.value.startsWith('/erp/business-report/financial/') ||
      currentPath.value === '/erp/business-report/financial-report' ||
      currentPath.value.startsWith('/erp/business-report/financial-report/'))
  );
});

const canQueryPurchaseInvoice = computed(() =>
  hasAccessByCodes(['erp:purchase-invoice:query']),
);
const canQueryPurchaseIn = computed(() =>
  hasAccessByCodes(['erp:purchase-in:query']),
);
const canQuerySaleReturn = computed(() =>
  hasAccessByCodes(['erp:sale-return:query']),
);
const canQueryVoucher = computed(() => hasAccessByCodes(['erp:voucher:query']));
const canQueryVoucherAttribution = computed(() =>
  hasAccessByCodes(['erp:voucher-attribution:query']),
);
const canQueryVoucherWord = computed(() =>
  hasAccessByCodes(['erp:voucher-word:query']),
);
const canQuerySubject = computed(() =>
  hasAccessByCodes(['erp:accounting-subject:query']),
);
const canQueryAnySource = computed(
  () =>
    canQueryPurchaseInvoice.value ||
    canQueryPurchaseIn.value ||
    canQuerySaleReturn.value ||
    canQueryVoucher.value ||
    canQueryVoucherAttribution.value ||
    canQueryVoucherWord.value ||
    canQuerySubject.value,
);

const canCurrentPage = computed(() => {
  if (canCurrentMenu.value) return true;
  if (pageKey.value === 'purchase-invoice')
    return canQueryPurchaseInvoice.value;
  if (pageKey.value === 'purchase-in-invoice-status')
    return canQueryPurchaseIn.value;
  if (pageKey.value === 'sale-return-red-offset')
    return canQuerySaleReturn.value;
  if (pageKey.value === 'voucher') return canQueryVoucher.value;
  if (pageKey.value === 'voucher-attribution')
    return canQueryVoucherAttribution.value;
  if (pageKey.value === 'voucher-word') return canQueryVoucherWord.value;
  if (pageKey.value === 'accounting-subject') return canQuerySubject.value;
  return canQueryAnySource.value;
});

const overviewItems: ReadinessItem[] = [
  {
    title: '采购发票与开票状态',
    status: '可查看',
    description:
      '展示采购发票和采购入库开票状态；部分开票、未开票余额和原票关联需在发票口径确认后输出。',
  },
  {
    title: '销售退货红冲来源',
    status: '可查看',
    description:
      '展示销售退货来源、客户、金额和审核状态；红字发票和红冲凭证在正式票据流程确认后生成。',
  },
  {
    title: '凭证与凭证归集',
    status: '可查看',
    description:
      '展示凭证、凭证来源检查和归属状态；自动凭证分录和辅助核算按确认后的规则执行。',
  },
  {
    title: '科目余额与三大报表',
    status: '待规则确认',
    description:
      '科目余额、试算平衡、现金流项目和报表公式确认后，资产负债表、利润表和现金流量表才能输出正式金额。',
  },
];

const historyItems: ReadinessItem[] = [
  {
    title: '历史发票来源',
    status: '可核对',
    description:
      '以现有采购发票、采购入库开票状态和销售退货记录作为历史来源核对依据。',
  },
  {
    title: '历史凭证来源',
    status: '可核对',
    description:
      '以现有凭证、凭证字、会计科目和凭证归集来源作为历史凭证核对依据。',
  },
  {
    title: '历史报表模板',
    status: '待规则确认',
    description:
      '模板项目可作为报表结构参考，正式历史金额仍需凭证、科目余额和期间规则共同确认。',
  },
];

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'overview';
  const parts = value.split('/').filter(Boolean);
  const key = parts[parts.length - 1] as PageKey | undefined;
  return key && key in pageTitles ? key : 'overview';
}
</script>

<template>
  <BusinessReportShell
    :title="`经营报表 · 发票凭证及财务报表 · ${pageTitle}`"
    :denied="!canCurrentPage"
    :body-scrollable="pageKey === 'overview' || pageKey === 'history'"
  >
    <section
      class="erp-financial-statement-report"
      :class="`erp-financial-statement-report--${pageKey}`"
    >
      <div
        v-if="pageKey === 'overview'"
        class="erp-financial-statement-report__overview"
      >
        <Card class="erp-financial-statement-report__hero" size="small">
          <strong>{{ pageTitle }}</strong>
          <p>{{ pageDescription }}</p>
        </Card>
        <div class="erp-financial-statement-report__grid">
          <Card v-for="item in overviewItems" :key="item.title" size="small">
            <template #title>{{ item.title }}</template>
            <template #extra
              ><Tag color="blue">{{ item.status }}</Tag></template
            >
            <p>{{ item.description }}</p>
          </Card>
        </div>
      </div>

      <PurchaseInvoiceReadonlyTable
        v-else-if="pageKey === 'purchase-invoice'"
        key="purchase-invoice"
      />
      <PurchaseInInvoiceStatusReadonlyTable
        v-else-if="pageKey === 'purchase-in-invoice-status'"
        key="purchase-in-invoice-status"
      />
      <SaleReturnAdjustReadonlyTable
        v-else-if="pageKey === 'sale-return-red-offset'"
        key="sale-return-red-offset"
        mode="return"
      />
      <VoucherReadonlyTable v-else-if="pageKey === 'voucher'" key="voucher" />
      <VoucherAttributionReadonlyTable
        v-else-if="pageKey === 'voucher-attribution'"
        key="voucher-attribution"
      />
      <VoucherWordReadonlyTable
        v-else-if="pageKey === 'voucher-word'"
        key="voucher-word"
      />
      <SubjectReadonlyTable
        v-else-if="pageKey === 'accounting-subject'"
        key="accounting-subject"
      />

      <div v-else class="erp-financial-statement-report__overview">
        <Card class="erp-financial-statement-report__hero" size="small">
          <strong>{{ pageTitle }}</strong>
          <p>{{ pageDescription }}</p>
        </Card>
        <div class="erp-financial-statement-report__grid">
          <Card v-for="item in historyItems" :key="item.title" size="small">
            <template #title>{{ item.title }}</template>
            <template #extra
              ><Tag color="gold">{{ item.status }}</Tag></template
            >
            <p>{{ item.description }}</p>
          </Card>
        </div>
      </div>
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.erp-financial-statement-report {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.erp-financial-statement-report__overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.erp-financial-statement-report__hero strong {
  display: block;
  margin-bottom: 8px;
  color: #173461;
  font-size: 20px;
}

.erp-financial-statement-report__hero p,
.erp-financial-statement-report__grid p {
  margin: 0;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.7;
}

.erp-financial-statement-report__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1280px) {
  .erp-financial-statement-report__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .erp-financial-statement-report__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
