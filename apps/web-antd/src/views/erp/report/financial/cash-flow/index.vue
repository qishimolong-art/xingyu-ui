<script setup lang="ts">
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import CashFlow from '../../../accounting/cash-flow/index.vue';
import FinancialStatementReadiness from '../modules/financial-statement-readiness.vue';

defineOptions({ name: 'ErpBusinessReportFinancialCashFlow' });

const readinessItems = [
  {
    title: '现金流项目',
    status: '待归集',
    description:
      '收款、付款、转账、手续费和总部代收代付需要先归集现金流项目；转账本金不能计入经营收支。',
  },
  {
    title: '凭证取数',
    status: '待核对',
    description:
      '现金类科目、实际账户科目和自动凭证来源需核对一致后，才能从凭证生成现金流量表。',
  },
  {
    title: '公式版本',
    status: '待确认启用',
    description:
      '经营、投资、筹资现金流公式需保存配置版本并确认启用；未确认时禁止作为正式报表输出。',
  },
];

const notices = [
  {
    title: '现金流量表正式金额待规则确认。',
    status: '现金流项目待归集',
    description:
      '本入口复用原现金流量表骨架页；现金流项目、凭证取数、会计期间和公式未确认前，金额列保持不可用，不能作为正式现金流量表。',
  },
];
</script>

<template>
  <BusinessReportShell title="经营报表 · 现金流量表" :notices="notices">
    <div class="financial-wrapper-page">
      <FinancialStatementReadiness
        statement-name="现金流量表"
        warning="当前只展示经营报表入口和前置条件；现金流项目、凭证取数、会计期间和公式未确认前，金额列保持不可用。"
        :items="readinessItems"
      />
      <CashFlow />
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
