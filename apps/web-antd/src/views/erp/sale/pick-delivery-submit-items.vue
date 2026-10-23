<script setup lang="ts">
import type { ErpSalePickDeliveryApi } from '#/api/erp/sale/pick-delivery';

import { ref, watch } from 'vue';

import { Alert, Table } from 'ant-design-vue';

import { getSaleSubmitItemPage } from '#/api/erp/sale/pick-delivery';

import { formatPickDeliveryQuantity } from './utils/pick-delivery-quantity';

const props = defineProps<{
  kind: 'delivery' | 'pick';
  parentId: number;
  submit: ErpSalePickDeliveryApi.SubmitResp;
}>();
const rows = ref<ErpSalePickDeliveryApi.SubmitItemResp[]>([]);
const pageNo = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref(false);
let token = 0;
const columns = [
  { title: '配件名称', dataIndex: 'productName', width: 180 },
  { title: '配件编码', dataIndex: 'productCode', width: 140 },
  {
    title: '本次数量',
    dataIndex: 'quantity',
    width: 120,
    customRender: ({ text }: { text: string }) =>
      formatPickDeliveryQuantity(text),
  },
];
async function load(page = 1) {
  if (!props.submit.id || !props.submit.quantityDetails) return;
  const current = ++token;
  loading.value = true;
  error.value = false;
  try {
    const result = await getSaleSubmitItemPage(props.kind, {
      parentId: props.parentId,
      submitId: props.submit.id,
      pageNo: page,
      pageSize: 10,
    });
    if (current !== token) return;
    rows.value = result.list;
    total.value = result.total;
    pageNo.value = page;
  } catch {
    if (current === token) error.value = true;
  } finally {
    if (current === token) loading.value = false;
  }
}
watch(
  () => [props.parentId, props.submit.id],
  () => {
    rows.value = [];
    total.value = 0;
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <Alert
    v-if="!submit.quantityDetails"
    message="历史提交记录未保存逐配件数量明细"
    type="info"
  />
  <div v-else>
    <Alert
      v-if="error"
      message="数量明细加载失败，请重新展开记录重试"
      type="error"
    />
    <Table
      row-key="id"
      size="small"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :scroll="{ x: 440 }"
      :pagination="{
        current: pageNo,
        pageSize: 10,
        total,
        showSizeChanger: false,
        onChange: load,
      }"
    />
  </div>
</template>
