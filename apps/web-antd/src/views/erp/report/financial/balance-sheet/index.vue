<script setup lang="ts">
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import BalanceSheet from '../../../accounting/balance-sheet/index.vue';
import FinancialStatementReadiness from '../modules/financial-statement-readiness.vue';

defineOptions({ name: 'ErpBusinessReportFinancialBalanceSheet' });

const readinessItems = [
  {
    title: '科目余额',
    status: '待接真实余额',
    description:
      '需要科目余额、试算平衡和部门辅助核算先可追溯；未确认前不从模板零金额推导资产、负债或所有者权益。',
  },
  {
    title: '会计期间',
    status: '待结账流程',
    description:
      '需要会计期间、结账和受控反结账流程确认后，才能按期末余额输出正式资产负债表。',
  },
  {
    title: '公式版本',
    status: '待确认启用',
    description:
      '资产、负债、所有者权益公式需保存配置版本并确认启用；公式未确认时禁止作为正式报表输出。',
  },
];

const notices = [
  {
    title: '资产负债表正式金额待规则确认。',
    status: '金额不可用',
    description:
      '本入口复用原资产负债表骨架页；公式、凭证取数、科目余额、会计期间和结账流程未确认前，金额列保持不可用，不能作为正式财务报表。',
  },
];
</script>

<template>
  <BusinessReportShell title="经营报表 · 资产负债表" :notices="notices">
    <div class="financial-wrapper-page">
      <FinancialStatementReadiness
        statement-name="资产负债表"
        warning="当前只展示经营报表入口和前置条件；公式、凭证取数、科目余额、会计期间和结账流程未确认前，金额列保持不可用。"
        :items="readinessItems"
      />
      <BalanceSheet />
    </div>
  </BusinessReportShell>
</template>

<style scoped>
.financial-wrapper-page {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.financial-wrapper-page :deep(.page),
.financial-wrapper-page :deep(.vben-page),
.financial-wrapper-page :deep([class*='page']) {
  min-height: 0;
}
</style>
