<script setup lang="ts">
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import IncomeStatement from '../../../accounting/income-statement/index.vue';
import FinancialStatementReadiness from '../modules/financial-statement-readiness.vue';

defineOptions({ name: 'ErpBusinessReportFinancialIncomeStatement' });

const readinessItems = [
  {
    title: '收入成本',
    status: '待凭证核对',
    description:
      '收入、成本和退货红冲需与凭证、销售采购核算和双成本口径核对一致，不能直接使用页面示例金额。',
  },
  {
    title: '费用抵销',
    status: '待配置版本',
    description:
      '直接费用、分摊费用、内部收入成本抵销、未实现利润抵销和已实现利润调整需按确认公式版本执行。',
  },
  {
    title: '期间损益',
    status: '待结账流程',
    description:
      '会计期间、结账和反结账规则确认后，才能锁定本期利润并支持逐级下钻。',
  },
];

const notices = [
  {
    title: '利润表正式金额待规则确认。',
    status: '公式待确认',
    description:
      '本入口复用原利润表骨架页；收入、成本、费用、内部抵销和凭证取数公式未确认前，金额列保持不可用，不能作为正式经营利润或财务报表。',
  },
];
</script>

<template>
  <BusinessReportShell title="经营报表 · 利润表" :notices="notices">
    <div class="financial-wrapper-page">
      <FinancialStatementReadiness
        statement-name="利润表"
        warning="当前只展示经营报表入口和前置条件；收入、成本、费用、内部抵销和凭证取数公式未确认前，金额列保持不可用。"
        :items="readinessItems"
      />
      <IncomeStatement />
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
