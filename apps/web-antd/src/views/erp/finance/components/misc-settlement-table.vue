<script setup lang="ts">
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { TablePaginationConfig } from 'ant-design-vue';

import type { MiscSettlement } from '#/api/erp/finance/misc-settlement';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { formatDateTime } from '@vben/utils';

import { Alert, Button, Table } from 'ant-design-vue';

import { getMiscSettlementPage } from '#/api/erp/finance/misc-settlement';

const props = defineProps<{
  direction: 'payable' | 'receivable';
  id: number;
  revision: number;
}>();
const emit = defineEmits<{ open: [id: number]; refresh: [] }>();
const { hasAccessByCodes } = useAccess();
const title = computed(() =>
  props.direction === 'receivable' ? '收款明细' : '付款明细',
);
const canOpen = computed(() =>
  hasAccessByCodes([
    props.direction === 'receivable'
      ? 'erp:finance-receipt:query'
      : 'erp:finance-payment:query',
  ]),
);
const rows = ref<MiscSettlement[]>([]);
const loading = ref(false);
const error = ref(false);
const pageNo = ref(1);
const pageSize = ref(20);
const total = ref(0);
let requestId = 0;
const columns = [
  { title: '单号', dataIndex: 'no', width: 190 },
  { title: '收付款日期', dataIndex: 'bizTime', width: 170 },
  {
    title: '本次结算金额',
    dataIndex: 'amount',
    width: 130,
    align: 'right' as const,
  },
  { title: '账户', dataIndex: 'accountName', width: 140 },
  { title: '部门', dataIndex: 'deptName', width: 130 },
  { title: '经办人', dataIndex: 'handlerName', width: 100 },
  { title: '审批状态', dataIndex: 'status', width: 100 },
  { title: '备注', dataIndex: 'remark', width: 220 },
];
async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = false;
  try {
    const result = await getMiscSettlementPage(props.direction, {
      id: props.id,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    });
    if (current !== requestId) return;
    rows.value = result.list;
    total.value = result.total;
  } catch {
    if (current !== requestId) return;
    rows.value = [];
    total.value = 0;
    error.value = true;
  } finally {
    if (current === requestId) loading.value = false;
  }
}
function changePage(page: TablePaginationConfig) {
  pageNo.value = page.current || 1;
  pageSize.value = page.pageSize || 20;
  void load();
}
watch(
  () => [props.id, props.direction, props.revision],
  () => {
    pageNo.value = 1;
    rows.value = [];
    total.value = 0;
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  ++requestId;
});
</script>

<template>
  <section class="rounded-lg border bg-card p-3">
    <header class="mb-3 flex items-center justify-between">
      <span class="font-semibold">{{ title }}（{{ total }}）</span>
      <Button size="small" :loading="loading" @click="emit('refresh')"
        >刷新</Button
      >
    </header>
    <Alert
      v-if="error"
      class="mb-2"
      type="error"
      message="明细加载失败，请刷新重试"
    />
    <Table
      size="small"
      row-key="documentId"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :scroll="{ x: 'max-content', y: 360 }"
      :pagination="{
        current: pageNo,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: ['20', '50', '100'],
      }"
      :locale="{ emptyText: '暂无已审批的收付款记录' }"
      @change="changePage"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'no'">
          <a
            v-if="canOpen && record.no"
            @click="emit('open', record.documentId)"
            >{{ record.no }}</a
          >
          <span v-else>{{ record.no || '—' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'amount'">
          {{
            record.amount == null
              ? '—'
              : erpPriceInputFormatter(Number(record.amount))
          }}
        </template>
        <template v-else-if="column.dataIndex === 'bizTime'">
          {{ record.bizTime ? formatDateTime(record.bizTime) : '—' }}
        </template>
        <template v-else-if="column.dataIndex === 'status'">{{
          record.status === 20 ? '已审批' : '—'
        }}</template>
        <template v-else>{{ text ?? '—' }}</template>
      </template>
    </Table>
  </section>
</template>
