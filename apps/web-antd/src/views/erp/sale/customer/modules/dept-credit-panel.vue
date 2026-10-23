<script lang="ts" setup>
import type { ErpCustomerApi } from '#/api/erp/sale/customer';
import type { TableColumnsType } from 'ant-design-vue';

import { computed, ref, watch, onBeforeUnmount } from 'vue';

import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  message,
  Spin,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getCustomerDeptCredit,
  updateCustomerDeptCredit,
} from '#/api/erp/sale/customer';

const props = withDefaults(
  defineProps<{
    readonly?: boolean;
    record?: ErpCustomerApi.Customer;
  }>(),
  {
    readonly: false,
  },
);

const emit = defineEmits<{ (e: 'success'): void }>();

interface DeptCreditRow extends Omit<
  ErpCustomerApi.CustomerDeptCreditItem,
  'creditLimit' | 'creditTermDays'
> {
  creditLimit?: number | string;
  creditTermDays?: number | string;
  configured: boolean;
  deptName: string;
}

const { hasAccessByCodes } = useAccess();
const loading = ref(false);
const ready = ref(false);
const loadError = ref('');
let sequence = 0;
onBeforeUnmount(() => {
  sequence += 1;
});
const saving = ref(false);
const keyword = ref('');
const customerName = ref('');
const rows = ref<DeptCreditRow[]>([]);

const recordId = computed(() => props.record?.id);
const canSave = computed(
  () =>
    ready.value &&
    !loading.value &&
    !saving.value &&
    !loadError.value &&
    !props.readonly &&
    Boolean(recordId.value) &&
    hasAccessByCodes(['erp:customer:dept-credit']),
);
const configuredCount = computed(
  () => rows.value.filter((item) => item.configured).length,
);
const filteredRows = computed(() => {
  const input = normalizeText(keyword.value);
  if (!input) {
    return rows.value;
  }
  return rows.value.filter((item) =>
    [item.deptId, item.deptName, item.remark].some((value) =>
      normalizeText(value).includes(input),
    ),
  );
});
const configurableFilteredRows = computed(() => filteredRows.value);
const headerChecked = computed(
  () =>
    configurableFilteredRows.value.length > 0 &&
    configurableFilteredRows.value.every((item) => item.configured),
);
const headerIndeterminate = computed(() => {
  const checkedCount = configurableFilteredRows.value.filter(
    (item) => item.configured,
  ).length;
  return (
    checkedCount > 0 && checkedCount < configurableFilteredRows.value.length
  );
});
const globalCreditText = computed(() => {
  if (!props.record) {
    return '-';
  }
  if (!props.record.creditEnabled) {
    return '全局关闭';
  }
  const parts = ['全局开启'];
  if (hasValue(props.record.creditLimit)) {
    parts.push(`金额 ${props.record.creditLimit}`);
  }
  if (hasValue(props.record.creditTermDays)) {
    parts.push(`期限 ${props.record.creditTermDays} 天`);
  }
  return parts.join(' / ');
});

const columns: TableColumnsType<DeptCreditRow> = [
  { title: '', dataIndex: 'configured', width: 56 },
  { title: '部门', dataIndex: 'deptName', width: 240 },
  { title: '授信', dataIndex: 'creditEnabled', width: 110 },
  { title: '授信金额', dataIndex: 'creditLimit', width: 150 },
  { title: '授信期限', dataIndex: 'creditTermDays', width: 130 },
  { title: '备注', dataIndex: 'remark', width: 220 },
  { title: '状态', dataIndex: 'status', width: 120 },
];

function normalizeText(value?: null | number | string) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

function normalizeOptionalNumber(value: unknown) {
  if (!hasValue(value)) {
    return undefined;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function isConfiguredItem(item: ErpCustomerApi.CustomerDeptCreditItem) {
  return (
    Boolean(item.id) ||
    Boolean(item.creditEnabled) ||
    hasValue(item.creditLimit) ||
    hasValue(item.creditTermDays) ||
    hasValue(item.remark)
  );
}

function buildRows(data: ErpCustomerApi.CustomerDeptCredit) {
  const deptNameMap = data.deptNameMap || {};
  return (data.items || []).map((item) => ({
    ...item,
    deptName:
      item.deptName || deptNameMap[item.deptId] || String(item.deptId || ''),
    configured: isConfiguredItem(item),
    creditLimit:
      item.creditLimit === null || item.creditLimit === undefined
        ? undefined
        : Number(item.creditLimit).toFixed(2),
    creditEnabled: Boolean(item.creditEnabled),
  }));
}

function toggleRow(row: DeptCreditRow, checked: boolean) {
  if (!canSave.value) {
    return;
  }
  row.configured = checked;
}

function toggleTableRow(record: Record<string, any>, checked: boolean) {
  toggleRow(record as DeptCreditRow, checked);
}

function toggleFilteredRows(checked: boolean) {
  if (!canSave.value) {
    return;
  }
  configurableFilteredRows.value.forEach((item) => {
    item.configured = checked;
  });
}

async function loadDeptCredit() {
  const current = ++sequence;
  const id = recordId.value;
  ready.value = false;
  loadError.value = '';
  keyword.value = '';
  if (!recordId.value) {
    customerName.value = '';
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    const data = await getCustomerDeptCredit(recordId.value);
    if (current !== sequence || id !== recordId.value) return;
    ready.value = true;
    customerName.value = data.name || props.record?.name || '';
    rows.value = buildRows(data);
  } catch {
    if (current === sequence)
      loadError.value = '授信配置加载失败，请重试，当前禁止保存';
  } finally {
    if (current === sequence) loading.value = false;
  }
}

function buildPayloadItems() {
  return rows.value
    .filter((item) => item.configured)
    .map((item) => {
      const creditEnabled = Boolean(item.creditEnabled);
      return {
        deptId: item.deptId,
        creditEnabled,
        creditLimit: creditEnabled
          ? normalizeOptionalNumber(item.creditLimit)
          : undefined,
        creditTermDays: creditEnabled
          ? normalizeOptionalNumber(item.creditTermDays)
          : undefined,
        remark: hasValue(item.remark) ? String(item.remark).trim() : undefined,
      };
    });
}

function validatePayloadItems(
  items: Array<{
    deptId?: number;
    creditEnabled?: boolean;
    creditLimit?: unknown;
    creditTermDays?: unknown;
  }>,
) {
  for (const item of items) {
    if (
      (hasValue(item.creditLimit) &&
        !Number.isFinite(Number(item.creditLimit))) ||
      (hasValue(item.creditTermDays) &&
        !Number.isFinite(Number(item.creditTermDays)))
    ) {
      message.warning('授信值必须为合法数字');
      return false;
    }
    if (!item.creditEnabled) {
      continue;
    }
    if (!hasValue(item.creditLimit) && !hasValue(item.creditTermDays)) {
      const row = rows.value.find((rowItem) => rowItem.deptId === item.deptId);
      message.warning(
        `${row?.deptName || item.deptId} 已启用授信，请填写金额或期限`,
      );
      return false;
    }
    if (
      (hasValue(item.creditLimit) && Number(item.creditLimit) < 0) ||
      (hasValue(item.creditTermDays) &&
        (Number(item.creditTermDays) < 0 ||
          !/^\d+$/.test(String(item.creditTermDays))))
    ) {
      const row = rows.value.find((rowItem) => rowItem.deptId === item.deptId);
      message.warning(`${row?.deptName || item.deptId} 的授信值不能小于 0`);
      return false;
    }
  }
  return true;
}

async function handleSave() {
  if (!recordId.value || !canSave.value) return;
  const current = sequence;
  if (!validatePayloadItems(rows.value.filter((row) => row.configured))) return;
  const items = buildPayloadItems();
  if (!validatePayloadItems(items)) {
    return;
  }
  saving.value = true;
  try {
    await updateCustomerDeptCredit({
      id: recordId.value,
      items,
    });
    if (current !== sequence) return;
    message.success('分部门授信已保存');
    saving.value = false;
    await loadDeptCredit();
    emit('success');
  } finally {
    if (current === sequence) saving.value = false;
  }
}

watch(
  recordId,
  () => {
    void loadDeptCredit();
  },
  { immediate: true },
);

defineExpose({ reload: loadDeptCredit, save: handleSave });
</script>

<template>
  <div class="customer-dept-credit-panel mx-2 py-2">
    <Empty v-if="!recordId" description="保存客户档案后可配置分部门授信" />
    <Alert v-if="loadError" :message="loadError" type="error" show-icon />
    <Spin v-else :spinning="loading">
      <div class="space-y-3">
        <div class="customer-dept-credit-summary">
          <div>客户：{{ customerName || props.record?.name || '-' }}</div>
          <div>客户全局授信：{{ globalCreditText }}</div>
          <div>独立配置：{{ configuredCount }} / {{ rows.length }} 个部门</div>
        </div>

        <div class="customer-dept-credit-toolbar">
          <Input
            v-model:value="keyword"
            allow-clear
            class="customer-dept-credit-search"
            placeholder="搜索部门名称 / ID"
          />
          <div class="flex flex-wrap items-center gap-3">
            <span class="customer-dept-credit-hint">
              未勾选的部门跟随客户全局授信
            </span>
            <Button
              v-if="canSave"
              :loading="saving"
              type="primary"
              @click="handleSave"
            >
              保存授信
            </Button>
          </div>
        </div>

        <Table
          class="customer-dept-credit-table"
          :columns="columns"
          :data-source="filteredRows"
          :loading="loading"
          :pagination="false"
          :row-key="(row) => row.deptId"
          :scroll="{ x: 'max-content', y: 420 }"
          bordered
          size="small"
        >
          <template #headerCell="{ column }">
            <template v-if="column.dataIndex === 'configured'">
              <Checkbox
                :checked="headerChecked"
                :disabled="!canSave || configurableFilteredRows.length === 0"
                :indeterminate="headerIndeterminate"
                @change="(event) => toggleFilteredRows(event.target.checked)"
              />
            </template>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'configured'">
              <Checkbox
                :checked="record.configured"
                :disabled="!canSave"
                @change="
                  (event) => toggleTableRow(record, event.target.checked)
                "
              />
            </template>
            <template v-else-if="column.dataIndex === 'deptName'">
              <div class="customer-dept-credit-dept">
                <span>{{ record.deptName || '-' }}</span>
                <span class="customer-dept-credit-dept-id">
                  ID: {{ record.deptId }}
                </span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'creditEnabled'">
              <Switch
                v-model:checked="record.creditEnabled"
                :disabled="!canSave || !record.configured"
                checked-children="启用"
                un-checked-children="关闭"
              />
            </template>
            <template v-else-if="column.dataIndex === 'creditLimit'">
              <Input
                v-model:value="record.creditLimit"
                inputmode="decimal"
                :disabled="
                  !canSave || !record.configured || !record.creditEnabled
                "
                @blur="
                  record.creditLimit = !hasValue(record.creditLimit)
                    ? undefined
                    : Number.isFinite(Number(record.creditLimit))
                      ? Number(record.creditLimit).toFixed(2)
                      : record.creditLimit
                "
                class="w-full"
                placeholder="金额"
              />
            </template>
            <template v-else-if="column.dataIndex === 'creditTermDays'">
              <Input
                v-model:value="record.creditTermDays"
                inputmode="numeric"
                :disabled="
                  !canSave || !record.configured || !record.creditEnabled
                "
                :min="0"
                :precision="0"
                class="w-full"
                placeholder="天数"
              />
            </template>
            <template v-else-if="column.dataIndex === 'remark'">
              <Input
                v-model:value="record.remark"
                :disabled="!canSave || !record.configured"
                allow-clear
                placeholder="备注"
              />
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <Tag v-if="!record.configured">跟随全局</Tag>
              <Tag v-else-if="record.creditEnabled" color="green">独立授信</Tag>
              <Tag v-else color="orange">独立关闭</Tag>
            </template>
          </template>
        </Table>
      </div>
    </Spin>
  </div>
</template>

<style scoped>
.customer-dept-credit-panel {
  font-size: 12px;
}

.customer-dept-credit-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 10px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 20%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.customer-dept-credit-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.customer-dept-credit-search {
  width: min(360px, 100%);
  height: 32px;
  font-size: 12px;
}

.customer-dept-credit-hint,
.customer-dept-credit-dept-id {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.customer-dept-credit-dept {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.customer-dept-credit-table :deep(.ant-table),
.customer-dept-credit-table :deep(.ant-table-cell),
.customer-dept-credit-panel :deep(.ant-empty-description) {
  font-size: 12px;
}

.customer-dept-credit-table :deep(.ant-table-thead > tr > th),
.customer-dept-credit-table :deep(.ant-table-tbody > tr > td) {
  padding-top: 7px;
  padding-bottom: 7px;
}

@media (max-width: 767px) {
  .customer-dept-credit-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
