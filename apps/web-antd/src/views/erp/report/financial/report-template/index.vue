<script setup lang="ts">
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import ReportTemplate from '../../../accounting/report-template/index.vue';
import FinancialStatementReadiness from '../modules/financial-statement-readiness.vue';

defineOptions({ name: 'ErpBusinessReportFinancialReportTemplate' });

const readinessItems = [
  {
    title: '公式版本',
    status: '待确认启用',
    description:
      '报表项目模板只维护项目结构；公式版本确认前，模板不能作为正式资产负债表、利润表或现金流量表取数依据。',
  },
  {
    title: '会计期间',
    status: '待结账流程',
    description:
      '需要会计期间、结账和受控反结账流程确认后，才能按期间锁定输出正式财务报表。',
  },
  {
    title: '凭证取数',
    status: '待接余额',
    description:
      '需要凭证、科目余额、现金流项目和辅助核算结果可追溯后，才能把模板项目转为正式金额。',
  },
];

const notices = [
  {
    title: '财务报表模板用于维护报表项目结构。',
    status: '公式待确认',
    description:
      '本入口复用原报表模板维护页；公式版本、会计期间、凭证取数和现金流项目未完成确认前，模板不能等同于正式财务报表。',
  },
];
</script>

<template>
  <BusinessReportShell title="经营报表 · 财务报表模板" :notices="notices">
    <div class="financial-wrapper-page">
      <FinancialStatementReadiness
        statement-name="财务报表模板"
        warning="当前只展示经营报表入口和模板维护能力；公式版本、会计期间、凭证取数和现金流项目未完成确认前，模板不能等同于正式财务报表。"
        :items="readinessItems"
      />
      <ReportTemplate />
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
