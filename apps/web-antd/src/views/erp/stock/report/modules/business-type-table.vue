<script setup lang="ts">
import type { StockReportV2Api } from '#/api/erp/report/stock-v2';

import { businessTypeLabels, displayDecimal } from '../report-v2-ui';
defineProps<{
  financialMasked?: boolean;
  rows?: null | StockReportV2Api.BusinessTypeAmount[];
  settlementMasked?: boolean;
  title: string;
}>();
</script>
<template>
  <section class="mt-2 overflow-x-auto">
    <p class="mb-1 font-medium">{{ title }} · 按业务类型的期间净发生额</p>
    <p v-if="rows === undefined || rows === null" class="text-muted-foreground">
      业务分类明细不可用，请先核对期间覆盖及期初完整性。
    </p>
    <p v-else-if="rows.length === 0" class="text-muted-foreground">
      当前范围没有期间发生额。
    </p>
    <table v-else class="business-type-table">
      <thead>
        <tr>
          <th>业务类型</th>
          <th>净发生数量</th>
          <th>财务成本净发生额</th>
          <th>结算成本净发生额</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.bizType">
          <th>
            {{
              row.bizTypeName ||
              businessTypeLabels[row.bizType] ||
              `业务类型 ${row.bizType}`
            }}
          </th>
          <td>{{ displayDecimal(row.quantity) }}</td>
          <td>{{ displayDecimal(row.financialMovement, financialMasked) }}</td>
          <td>
            {{ displayDecimal(row.settlementMovement, settlementMasked) }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
<style scoped>
.business-type-table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
  font-size: 12px;
}
.business-type-table th,
.business-type-table td {
  padding: 6px 10px;
  border: 1px solid hsl(var(--border));
  text-align: right;
}
.business-type-table th {
  background: hsl(var(--muted));
}
</style>
