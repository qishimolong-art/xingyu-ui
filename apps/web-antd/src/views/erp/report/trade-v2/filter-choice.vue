<script setup lang="ts">
import type { TradeReportApi } from '#/api/erp/report/trade-v2';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Button, Checkbox, Input, Popover, Select } from 'ant-design-vue';
import { getTradeOptions } from '#/api/erp/report/trade-v2';

const props = defineProps<{
  kind: TradeReportApi.Kind;
  query: TradeReportApi.Query;
  dimension: string;
  label: string;
  value?: string | number | number[];
  multiple?: boolean;
}>();
const emit = defineEmits<{
  change: [value: string | number | number[] | undefined];
}>();
const options = ref<TradeReportApi.Option[]>([]);
const page = ref(0);
const total = ref(0);
const keyword = ref('');
const loading = ref(false);
const error = ref('');
let version = 0;
const selected = computed(() =>
  Array.isArray(props.value) ? props.value : [],
);
const available = computed(() =>
  options.value.filter(
    (item): item is TradeReportApi.Option & { value: number } =>
      typeof item.value === 'number',
  ),
);
const selectedAll = computed(
  () =>
    available.value.length > 0 &&
    available.value.every((item) => selected.value.includes(item.value)),
);
async function load(reset = false) {
  const request = ++version;
  const next = reset ? 1 : page.value + 1;
  loading.value = true;
  error.value = '';
  try {
    const query = { ...props.query, pageNo: next, pageSize: 50 };
    // 当前维度选项只受其他维度约束，避免已选值把候选列表缩成自身。
    if (props.dimension === 'PRODUCT') delete query.productId;
    if (props.dimension === 'CUSTOMER') delete query.customerId;
    if (props.dimension === 'SUPPLIER') delete query.supplierId;
    if (props.dimension === 'BRAND') delete query.brand;
    if (props.dimension === 'OE') delete query.oeNumber;
    if (props.dimension === 'CATEGORY') delete query.categoryId;
    if (props.dimension === 'SALE_USER') delete query.saleUserId;
    if (props.dimension === 'PURCHASER') delete query.purchaser;
    if (props.dimension === 'ACCOUNTING_DEPT') delete query.accountingDeptIds;
    if (props.dimension === 'STOCK_DEPT') delete query.stockDeptIds;
    if (props.dimension === 'WAREHOUSE') delete query.warehouseIds;
    const result = await getTradeOptions(
      props.kind,
      query,
      props.dimension,
      keyword.value || undefined,
    );
    if (request !== version) return;
    options.value = reset ? result.list : [...options.value, ...result.list];
    page.value = next;
    total.value = result.total;
  } catch (e) {
    if (request === version)
      error.value = e instanceof Error ? e.message : '选项加载失败';
  } finally {
    if (request === version) loading.value = false;
  }
}
function toggle(id: number, checked: boolean) {
  emit(
    'change',
    checked
      ? [...new Set([...selected.value, id])]
      : selected.value.filter((value) => value !== id),
  );
}
function all(checked: boolean) {
  emit(
    'change',
    checked
      ? [
          ...new Set([
            ...selected.value,
            ...available.value.map((item) => item.value),
          ]),
        ]
      : selected.value.filter(
          (id) => !available.value.some((item) => item.value === id),
        ),
  );
}
function select(value: unknown) {
  emit(
    'change',
    typeof value === 'number' || typeof value === 'string' ? value : undefined,
  );
}
watch(
  () => [props.query.postedFrom, props.query.postedTo],
  () => {
    version++;
    options.value = [];
    page.value = 0;
    total.value = 0;
  },
);
onBeforeUnmount(() => version++);
</script>
<template>
  <div class="inline-flex items-center gap-1">
    <Popover
      v-if="multiple"
      trigger="click"
      placement="bottomLeft"
      @open-change="(open) => open && load(true)"
    >
      <Button size="small">{{ label }}（{{ selected.length }}）</Button>
      <template #content>
        <div class="w-72 space-y-2">
          <Input
            v-model:value="keyword"
            placeholder="搜索已过账范围内选项"
            size="small"
            @press-enter="load(true)"
          />
          <Button size="small" :loading="loading" @click="load(true)"
            >搜索</Button
          >
          <Checkbox :checked="selectedAll" @change="all($event.target.checked)"
            >全选已加载可查询{{ label }}</Checkbox
          >
          <div class="max-h-60 overflow-auto">
            <div v-for="item in available" :key="item.value">
              <Checkbox
                :checked="selected.includes(item.value)"
                @change="toggle(item.value, $event.target.checked)"
                >{{ item.label }}</Checkbox
              >
            </div>
          </div>
          <Button
            v-if="options.length < total"
            size="small"
            :loading="loading"
            @click="load()"
            >加载更多</Button
          >
          <div v-if="error" class="text-red-600">{{ error }}</div>
        </div>
      </template>
    </Popover>
    <template v-else>
      <Select
        :value="value"
        :placeholder="label"
        :options="options.filter((item) => item.value !== null)"
        :loading="loading"
        allow-clear
        show-search
        :filter-option="false"
        size="small"
        class="w-40"
        @focus="load(true)"
        @search="
          (text) => {
            keyword = text;
            load(true);
          }
        "
        @change="select"
      />
      <Button
        v-if="options.length < total"
        size="small"
        :loading="loading"
        @click="load()"
        >更多</Button
      >
    </template>
  </div>
</template>
