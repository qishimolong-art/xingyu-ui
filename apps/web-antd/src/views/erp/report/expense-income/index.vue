<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';

import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import DepartmentExpenseReadiness from './modules/department-expense-readiness.vue';
import ExpenseAllocationReadiness from './modules/expense-allocation-readiness.vue';
import ExpenseIncomeTable from './modules/expense-income-table.vue';

defineOptions({ name: 'ErpReportExpenseIncome' });

type PageKey =
  | 'budget-variance'
  | 'department-expense'
  | 'expense-allocation'
  | 'expense-detail'
  | 'history'
  | 'operating-income';

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const pageTitles: Record<PageKey, string> = {
  'budget-variance': '费用预算及差异分析',
  'department-expense': '部门费用汇总',
  'expense-allocation': '公共费用分摊明细',
  'expense-detail': '费用支付明细',
  history: '历史费用收支口径',
  'operating-income': '其他经营收支明细',
};

const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/expense-income' ||
      currentPath.value.startsWith('/erp/business-report/expense-income/'))
  );
});
const canQueryExpense = computed(() =>
  hasAccessByCodes(['erp:payable-expense:query']),
);
const canQueryIncome = computed(() =>
  hasAccessByCodes(['erp:receivable-other-income:query']),
);

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'expense-detail';
  const parts = value.split('/').filter(Boolean);
  const key = parts[parts.length - 1] as PageKey | undefined;
  return key && key in pageTitles ? key : 'expense-detail';
}

const pageKey = computed(() => normalizePageKey(currentPath.value));
const pageTitle = computed(() => pageTitles[pageKey.value]);
const canCurrentPage = computed(() => {
  if (canCurrentMenu.value) return true;
  if (
    pageKey.value === 'expense-detail' ||
    pageKey.value === 'department-expense' ||
    pageKey.value === 'expense-allocation' ||
    pageKey.value === 'budget-variance'
  ) {
    return canQueryExpense.value;
  }
  if (pageKey.value === 'operating-income') return canQueryIncome.value;
  return canQueryExpense.value || canQueryIncome.value;
});

const shellScrollable = computed(() =>
  [
    'budget-variance',
    'department-expense',
    'expense-allocation',
    'history',
  ].includes(pageKey.value),
);
</script>

<template>
  <BusinessReportShell
    :title="`经营报表 · 费用分摊及经营收支 · ${pageTitle}`"
    :denied="!canCurrentPage"
    :body-scrollable="shellScrollable"
  >
    <section
      class="expense-income-report-page"
      :class="`expense-income-report-page--${pageKey}`"
    >
      <ExpenseIncomeTable
        v-if="pageKey === 'expense-detail'"
        key="expense-detail"
        report-type="expense"
        :title="pageTitle"
      />

      <ExpenseIncomeTable
        v-else-if="pageKey === 'operating-income'"
        key="operating-income"
        report-type="income"
        :title="pageTitle"
      />

      <DepartmentExpenseReadiness
        v-else-if="pageKey === 'department-expense'"
        key="department-expense"
        title="部门费用汇总"
        mode="department"
      />

      <ExpenseAllocationReadiness
        v-else-if="pageKey === 'expense-allocation'"
        key="expense-allocation"
        title="公共费用分摊明细"
        mode="allocation"
      />

      <ExpenseAllocationReadiness
        v-else-if="pageKey === 'budget-variance'"
        key="budget-variance"
        title="费用预算及差异分析"
        mode="budget"
      />

      <div v-else class="expense-income-report-page__stack">
        <ExpenseIncomeTable
          compact
          report-type="expense"
          title="历史费用支付明细"
        />
        <ExpenseIncomeTable
          compact
          report-type="income"
          title="历史其他经营收支明细"
        />
      </div>
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.expense-income-report-page {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.expense-income-report-page__stack {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.expense-income-report-page__stack :deep(.expense-income-report-table),
.expense-income-report-page__stack :deep(.expense-income-readiness-report) {
  min-height: 420px;
}
</style>
