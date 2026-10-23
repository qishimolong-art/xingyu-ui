<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';

import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import AccountFundLedgerTable from './modules/account-fund-ledger-table.vue';
import AccountFundTable from './modules/account-fund-table.vue';
import BankTransferReadonlyTable from './modules/bank-transfer-readonly-table.vue';
import FinanceReceiptPaymentReadonlyTable from './modules/finance-receipt-payment-readonly-table.vue';

defineOptions({ name: 'ErpReportAccountFund' });

type PageKey =
  | 'account-balance'
  | 'account-ledger'
  | 'bank-transfer'
  | 'history'
  | 'hq-collection-payment'
  | 'payment-record'
  | 'receipt-record'
  | 'transfer-in-transit';

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const pageTitles: Record<PageKey, string> = {
  'account-balance': '账户余额及对账表',
  'account-ledger': '账户资金流水表',
  'bank-transfer': '银行转账记录',
  history: '历史资金口径',
  'hq-collection-payment': '总部代收代付及部门资金占用表',
  'payment-record': '付款记录',
  'receipt-record': '收款记录',
  'transfer-in-transit': '部门转总部资金归集及在途表',
};

const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/account-fund' ||
      currentPath.value.startsWith('/erp/business-report/account-fund/'))
  );
});
const canQueryAccount = computed(() => hasAccessByCodes(['erp:account:query']));
const canQueryTransfer = computed(() =>
  hasAccessByCodes(['erp:finance-transfer:query']),
);
const canQueryReceipt = computed(() =>
  hasAccessByCodes(['erp:finance-receipt:query']),
);
const canQueryPayment = computed(() =>
  hasAccessByCodes(['erp:finance-payment:query']),
);

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'account-ledger';
  const parts = value.split('/').filter(Boolean);
  const key = parts[parts.length - 1] as PageKey | undefined;
  return key && key in pageTitles ? key : 'account-ledger';
}

const pageKey = computed(() => normalizePageKey(currentPath.value));
const pageTitle = computed(() => pageTitles[pageKey.value]);

const canQueryAnyFundSource = computed(
  () =>
    canQueryAccount.value ||
    canQueryTransfer.value ||
    canQueryReceipt.value ||
    canQueryPayment.value,
);

const canCurrentPage = computed(() => {
  if (canCurrentMenu.value) return true;
  if (
    pageKey.value === 'account-balance' ||
    pageKey.value === 'account-ledger'
  ) {
    return canQueryAccount.value;
  }
  if (
    pageKey.value === 'bank-transfer' ||
    pageKey.value === 'transfer-in-transit'
  ) {
    return canQueryTransfer.value;
  }
  if (pageKey.value === 'receipt-record') return canQueryReceipt.value;
  if (pageKey.value === 'payment-record') return canQueryPayment.value;
  return canQueryAnyFundSource.value;
});

const shellScrollable = computed(() => pageKey.value === 'history');
</script>

<template>
  <BusinessReportShell
    :title="`经营报表 · 账户资金及总部归集 · ${pageTitle}`"
    :denied="!canCurrentPage"
    :body-scrollable="shellScrollable"
  >
    <section
      class="account-fund-report-page"
      :class="`account-fund-report-page--${pageKey}`"
    >
      <AccountFundLedgerTable
        v-if="pageKey === 'account-ledger'"
        key="account-ledger"
        :title="pageTitle"
      />

      <AccountFundTable
        v-else-if="pageKey === 'account-balance'"
        key="account-balance"
        :title="pageTitle"
      />

      <BankTransferReadonlyTable
        v-else-if="
          pageKey === 'transfer-in-transit' || pageKey === 'bank-transfer'
        "
        :key="pageKey"
        :title="pageTitle"
      />

      <FinanceReceiptPaymentReadonlyTable
        v-else-if="pageKey === 'receipt-record'"
        key="receipt-record"
        mode="receipt"
        title="收款记录"
      />

      <FinanceReceiptPaymentReadonlyTable
        v-else-if="pageKey === 'payment-record'"
        key="payment-record"
        mode="payment"
        title="付款记录"
      />

      <AccountFundLedgerTable
        v-else-if="pageKey === 'hq-collection-payment'"
        key="hq-collection-payment"
        title="总部代收代付及部门资金占用表"
      />

      <div v-else class="account-fund-report-page__stack">
        <AccountFundLedgerTable compact title="历史收付款流水" />
        <BankTransferReadonlyTable title="历史银行转账记录" />
      </div>
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.account-fund-report-page {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.account-fund-report-page__stack {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.account-fund-report-page__stack :deep(.ant-card) {
  flex: 0 0 auto;
}

.account-fund-report-page__stack :deep(.ant-card-body) {
  min-height: 420px;
}

.account-fund-report-page__stack :deep(.account-fund-report-table),
.account-fund-report-page__stack :deep(.account-fund-ledger-table),
.account-fund-report-page__stack :deep(.bank-transfer-readonly-table),
.account-fund-report-page__stack
  :deep(.finance-receipt-payment-readonly-table) {
  min-height: 420px;
}
</style>
