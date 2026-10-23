<script lang="ts" setup>
import type { ErpVoucherApi } from '#/api/erp/finance/accounting/voucher';

import { computed, nextTick, ref, watch } from 'vue';

import { erpPriceInputFormatter } from '@vben/utils';

import { Input, InputNumber, Select, SelectOption } from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAccountingSubjectSimpleList } from '#/api/erp/finance/accounting/subject';

import AuxiliaryEditor from '../../voucher-rule/auxiliary-editor.vue';
import { useFormItemColumns } from '../data';

interface Props {
  items?: ErpVoucherApi.VoucherItem[];
  disabled?: boolean;
  formType: string;
  hiddenFields?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  disabled: false,
  hiddenFields: () => [],
});

const emit = defineEmits([
  'update:items',
  'update:total-debit',
  'update:total-credit',
]);

const tableData = ref<ErpVoucherApi.VoucherItem[]>([]);
/** 末级科目列表（缓存） */
const subjectOptions = ref<
  Array<{ id: number; subjectCode: string; subjectName: string }>
>([]);

/** 标记本次 props.items 变更是否由内部字段编辑触发 */
let isInternalUpdate = false;

/** 借贷合计 */
const summaries = computed(() => {
  let totalDebit = 0;
  let totalCredit = 0;
  tableData.value.forEach((item) => {
    totalDebit += Number(item.debitAmount) || 0;
    totalCredit += Number(item.creditAmount) || 0;
  });
  return {
    totalDebit: Number(totalDebit.toFixed(2)),
    totalCredit: Number(totalCredit.toFixed(2)),
    isBalanced:
      Number(totalDebit.toFixed(2)) === Number(totalCredit.toFixed(2)),
  };
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useFormItemColumns(props.formType, props.hiddenFields),
    data: tableData.value,
    minHeight: 280,
    autoResize: true,
    border: true,
    rowConfig: { keyField: 'seq', isHover: true },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  },
});

/** 拉取末级科目下拉 */
async function loadSubjectOptions() {
  if (subjectOptions.value.length > 0) return;
  const list = await getAccountingSubjectSimpleList(true);
  subjectOptions.value = (list || []).map((item: any) => ({
    id: item.id,
    subjectCode: item.subjectCode,
    subjectName: item.subjectName,
  }));
}
void loadSubjectOptions();

/** 同步合计到父组件 */
watch(
  () => summaries.value.totalDebit,
  (val) => emit('update:total-debit', val),
  { immediate: true },
);
watch(
  () => summaries.value.totalCredit,
  (val) => emit('update:total-credit', val),
  { immediate: true },
);

/** 监听外部传入的 items */
watch(
  () => [props.formType, props.hiddenFields],
  () => {
    gridApi.setGridOptions({
      columns: useFormItemColumns(props.formType, props.hiddenFields),
    });
  },
  { deep: true },
);

watch(
  () => props.items,
  async (items) => {
    if (!items) return;
    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }
    items.forEach((item) => initRow(item));
    tableData.value = [...items];
    await nextTick();
    if (gridApi.grid) {
      await gridApi.grid.reloadData(tableData.value);
    }
  },
  { immediate: true },
);

/** 初始化行 */
function initRow(row: ErpVoucherApi.VoucherItem) {
  if (!row.seq) {
    row.seq =
      (row.id as number) ||
      Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`);
  }
  if (row.debitAmount == null) row.debitAmount = 0;
  if (row.creditAmount == null) row.creditAmount = 0;
}

/** 发出 items 更新；skipReload=true 字段编辑、false 增删行 */
function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit('update:items', [...tableData.value]);
}

/** 字段变更（摘要、金额等） */
function handleFieldChange(row: ErpVoucherApi.VoucherItem) {
  const index = tableData.value.findIndex((it) => it.seq === row.seq);
  if (index === -1) return;
  tableData.value[index] = row;
  emitItemsUpdate(true);
}

/** 借方金额变更：填借方则贷方清空（互斥） */
function handleDebitChange(row: ErpVoucherApi.VoucherItem) {
  const debit = Number(row.debitAmount) || 0;
  if (debit > 0) {
    row.creditAmount = 0;
  }
  handleFieldChange(row);
}

/** 贷方金额变更：填贷方则借方清空（互斥） */
function handleCreditChange(row: ErpVoucherApi.VoucherItem) {
  const credit = Number(row.creditAmount) || 0;
  if (credit > 0) {
    row.debitAmount = 0;
  }
  handleFieldChange(row);
}

/** 选择会计科目（核算项已与科目解耦，独立输入） */
function handleSubjectChange(
  row: ErpVoucherApi.VoucherItem,
  subjectId: number,
) {
  const subject = subjectOptions.value.find((it) => it.id === subjectId);
  if (subject) {
    row.subjectId = subject.id;
    row.subjectCode = subject.subjectCode;
    row.subjectName = subject.subjectName;
  } else {
    row.subjectId = subjectId;
    row.subjectCode = undefined;
    row.subjectName = undefined;
  }
  handleFieldChange(row);
}

/** 添加分录行 */
function handleAdd() {
  const newRow: ErpVoucherApi.VoucherItem = {
    seq: Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`),
    lineNo: tableData.value.length + 1,
    summary: '',
    debitAmount: 0,
    creditAmount: 0,
  };
  tableData.value.push(newRow);
  emitItemsUpdate(false);
}

/** 删除分录行 */
function handleDelete(row: ErpVoucherApi.VoucherItem) {
  const index = tableData.value.findIndex((it) => it.seq === row.seq);
  if (index !== -1) tableData.value.splice(index, 1);
  // 删除后重排 lineNo
  tableData.value.forEach((it, idx) => {
    it.lineNo = idx + 1;
  });
  emitItemsUpdate(false);
}

/** 校验：必有分录、必平衡、每行必填科目 + 借贷其一 */
function validate() {
  if (tableData.value.length === 0) {
    throw new Error('请至少添加一条分录明细');
  }
  tableData.value.forEach((item, index) => {
    if (!item.subjectId) {
      throw new Error(`第 ${index + 1} 行：请选择会计科目`);
    }
    const debit = Number(item.debitAmount) || 0;
    const credit = Number(item.creditAmount) || 0;
    if (debit === 0 && credit === 0) {
      throw new Error(`第 ${index + 1} 行：借方或贷方至少填一个`);
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`第 ${index + 1} 行：借方与贷方不能同时填写`);
    }
  });
  // 借贷平衡校验：核心校验
  if (!summaries.value.isBalanced) {
    throw new Error(
      `借贷不平衡：借方 ${summaries.value.totalDebit} ≠ 贷方 ${summaries.value.totalCredit}`,
    );
  }
}

defineExpose({ validate, handleAdd, summaries });
</script>

<template>
  <Grid class="w-full">
    <template #summary="{ row }">
      <Input
        v-if="!disabled"
        v-model:value="row.summary"
        placeholder="请输入摘要"
        :maxlength="200"
        @change="handleFieldChange(row)"
      />
      <span v-else>{{ row.summary || '-' }}</span>
    </template>

    <template #subject="{ row }">
      <Select
        v-if="!disabled"
        :value="row.subjectId"
        placeholder="请选择会计科目"
        show-search
        :filter-option="
          (input: string, option: any) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
        "
        class="w-full"
        @change="(val) => handleSubjectChange(row, Number(val))"
      >
        <SelectOption
          v-for="sub in subjectOptions"
          :key="sub.id"
          :value="sub.id"
          :label="`${sub.subjectCode} ${sub.subjectName}`"
        >
          {{ sub.subjectCode }} {{ sub.subjectName }}
        </SelectOption>
      </Select>
      <span v-else>
        {{
          row.subjectCode || row.subjectName
            ? `${row.subjectCode || ''} ${row.subjectName || ''}`
            : '-'
        }}
      </span>
    </template>

    <template #auxiliary="{ row }">
      <AuxiliaryEditor
        :model-value="
          row.auxiliaries ||
          (row.auxiliaryId && row.auxiliaryType
            ? [
                {
                  type: row.auxiliaryType,
                  id: row.auxiliaryId,
                  name: row.auxiliaryName,
                },
              ]
            : [])
        "
        :disabled="disabled"
        :legacy-name="row.auxiliaryName"
        @update:model-value="
          (value) => {
            row.auxiliaries = value;
            row.auxiliaryType = undefined;
            row.auxiliaryId = undefined;
            row.auxiliaryName = undefined;
            emitItemsUpdate(true);
          }
        "
      />
    </template>

    <template #debitAmount="{ row }">
      <InputNumber
        v-if="!disabled"
        v-model:value="row.debitAmount"
        :min="0"
        :precision="2"
        class="w-full"
        :disabled="Number(row.creditAmount) > 0"
        @change="handleDebitChange(row)"
      />
      <span v-else>{{ erpPriceInputFormatter(row.debitAmount) || '-' }}</span>
    </template>

    <template #creditAmount="{ row }">
      <InputNumber
        v-if="!disabled"
        v-model:value="row.creditAmount"
        :min="0"
        :precision="2"
        class="w-full"
        :disabled="Number(row.debitAmount) > 0"
        @change="handleCreditChange(row)"
      />
      <span v-else>{{ erpPriceInputFormatter(row.creditAmount) || '-' }}</span>
    </template>

    <template #actions="{ row }">
      <TableAction
        :actions="[
          {
            label: '删除',
            type: 'link',
            danger: true,
            popConfirm: {
              title: '确认删除该分录吗？',
              confirm: handleDelete.bind(null, row),
            },
          },
        ]"
      />
    </template>

    <template #bottom>
      <div class="mt-2 rounded border border-border bg-muted p-2">
        <div class="flex justify-between text-sm">
          <span class="font-medium">合计：</span>
          <div class="flex gap-6">
            <span>
              借方合计：
              <span class="font-semibold text-blue-600">
                {{ erpPriceInputFormatter(summaries.totalDebit) || '0.00' }}
              </span>
            </span>
            <span>
              贷方合计：
              <span class="font-semibold text-green-600">
                {{ erpPriceInputFormatter(summaries.totalCredit) || '0.00' }}
              </span>
            </span>
            <span
              :class="
                summaries.isBalanced
                  ? 'text-green-600 font-semibold'
                  : 'text-red-600 font-semibold'
              "
            >
              {{ summaries.isBalanced ? '✓ 借贷平衡' : '✗ 借贷不平衡' }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </Grid>
</template>
