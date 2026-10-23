<script lang="ts" setup>
import type { ErpPreReceivableApi } from '#/api/erp/finance/accounting/pre-receivable';

import { computed, nextTick, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Input, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createPreReceivable,
  getPreReceivable,
  updatePreReceivable,
} from '#/api/erp/finance/accounting/pre-receivable';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import {
  formatOptionalNumberInput,
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';

import { useFormItemColumns, useFormSchema } from '../data';

const emit = defineEmits(['success']);

const formData = ref<ErpPreReceivableApi.PreReceivable>({
  items: [],
} as ErpPreReceivableApi.PreReceivable);
const formType = ref<string>('');
const tableData = ref<ErpPreReceivableApi.PreReceivableItem[]>([]);
const discountAmount = ref<string>('0');
const FIELD_PERMISSION_MODULE = 'erp_accounting_pre_receivable';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

let isInternalUpdate = false;

const getTitle = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['预收账款单']);
  if (formType.value === 'edit')
    return $t('ui.actionTitle.edit', ['预收账款单']);
  return '预收账款单详情';
});

const isReadonly = computed(() => formType.value === 'detail');

const totalAmount = computed(() => {
  let sum = 0;
  tableData.value.forEach((item) => {
    sum += Number(item.amount) || 0;
  });
  return Number(sum.toFixed(2));
});

const actualAmount = computed(() => {
  return Number(
    (totalAmount.value - (Number(discountAmount.value) || 0)).toFixed(2),
  );
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-1',
    labelWidth: 90,
  },
  wrapperClass: 'grid-cols-2',
  layout: 'horizontal',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useFormItemColumns(formType.value, hiddenFields.value),
    data: tableData.value,
    minHeight: 200,
    autoResize: true,
    border: true,
    rowConfig: { keyField: '_seq', isHover: true },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  },
});

function initRow(
  row: ErpPreReceivableApi.PreReceivableItem & { _seq?: number },
) {
  if (!row._seq) {
    row._seq =
      (row.id as number) ||
      Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`);
  }
  if (row.amount == null) row.amount = 0;
}

function handleAddItem() {
  const newRow: ErpPreReceivableApi.PreReceivableItem & { _seq: number } = {
    _seq: Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`),
    summary: '',
    amount: 0,
    remark: '',
  };
  tableData.value.push(newRow);
  emitReload();
}

function handleDeleteItem(row: any) {
  const index = tableData.value.findIndex((it: any) => it._seq === row._seq);
  if (index !== -1) tableData.value.splice(index, 1);
  emitReload();
}

function handleFieldChange() {
  isInternalUpdate = true;
}

async function emitReload() {
  await nextTick();
  await gridApi.grid.reloadData(tableData.value);
}

watch(
  () => formData.value.items,
  async (items) => {
    if (!items) return;
    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }
    items.forEach((item) => initRow(item as any));
    tableData.value = [...items] as any[];
    await nextTick();
    await gridApi.grid.reloadData(tableData.value);
  },
  { immediate: true },
);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (isReadonly.value) {
      await modalApi.close();
      return;
    }
    const { valid } = await formApi.validate();
    if (!valid) return;

    if (tableData.value.length === 0) {
      message.error('请至少添加一条明细');
      return;
    }
    for (let i = 0; i < tableData.value.length; i++) {
      const item = tableData.value[i]!;
      if (!Number(item.amount) || Number(item.amount) <= 0) {
        message.error(`第 ${i + 1} 行：金额必须大于 0`);
        return;
      }
    }

    modalApi.lock();
    try {
      const data =
        (await formApi.getValues()) as ErpPreReceivableApi.PreReceivable;
      data.items = tableData.value.map((item: any) => ({
        id: formType.value === 'create' ? undefined : item.id,
        summary: item.summary,
        amount: toOptionalNumberValue(item.amount) || 0,
        remark: item.remark,
      }));
      data.totalAmount = totalAmount.value;
      data.discountAmount = Number(discountAmount.value) || 0;
      data.actualAmount = actualAmount.value;

      await (formType.value === 'create'
        ? createPreReceivable(data)
        : updatePreReceivable(data));
      message.success($t('ui.actionMessage.operationSuccess'));
      emit('success');
      await modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = { items: [] } as ErpPreReceivableApi.PreReceivable;
      tableData.value = [];
      discountAmount.value = '0';
      return;
    }
    const data = modalApi.getData<{ id?: number; type: string }>();
    formType.value = data.type;
    await loadHiddenFields();
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    formApi.setDisabled(formType.value === 'detail');

    // 更新子表列（detail 模式无操作列）
    gridApi.setGridOptions({
      columns: useFormItemColumns(formType.value, hiddenFields.value),
    });

    if (!data || !data.id) {
      await formApi.setValues({ bizTime: Date.now(), partyType: 1 }, false);
      return;
    }
    modalApi.lock();
    try {
      const detail = await getPreReceivable(data.id);
      formData.value = detail;
      discountAmount.value =
        formatOptionalNumberInput(detail.discountAmount) || '0';
      await formApi.setValues(
        {
          ...detail,
          totalAmount: formatOptionalNumberInput(detail.totalAmount),
          discountAmount: formatOptionalNumberInput(detail.discountAmount),
          actualAmount: formatOptionalNumberInput(detail.actualAmount),
        },
        false,
      );
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal class="!w-[800px]" :title="getTitle">
    <div class="space-y-4 px-2">
      <Form />

      <!-- 子表明细 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">收款明细</span>
          <Button
            v-if="!isReadonly"
            type="primary"
            size="small"
            @click="handleAddItem"
          >
            添加明细
          </Button>
        </div>
        <Grid class="w-full">
          <template #summary="{ row }">
            <Input
              v-if="!isReadonly"
              v-model:value="row.summary"
              placeholder="请输入摘要"
              :maxlength="200"
              @change="handleFieldChange()"
            />
            <span v-else>{{ row.summary || '-' }}</span>
          </template>
          <template #amount="{ row }">
            <Input
              v-if="!isReadonly"
              v-model:value="row.amount"
              class="w-full"
              placeholder="请输入金额"
              :maxlength="20"
              inputMode="decimal"
              @change="handleFieldChange()"
            />
            <span v-else>
              {{ row.amount != null ? Number(row.amount).toFixed(2) : '-' }}
            </span>
          </template>
          <template #remark="{ row }">
            <Input
              v-if="!isReadonly"
              v-model:value="row.remark"
              placeholder="请输入备注"
              :maxlength="200"
              @change="handleFieldChange()"
            />
            <span v-else>{{ row.remark || '-' }}</span>
          </template>
          <template #actions="{ row }">
            <TableAction
              :actions="[
                {
                  label: '删除',
                  type: 'link',
                  danger: true,
                  popConfirm: {
                    title: '确认删除该明细吗？',
                    confirm: handleDeleteItem.bind(null, row),
                  },
                },
              ]"
            />
          </template>
        </Grid>
      </div>

      <!-- 底部金额汇总 -->
      <div class="rounded border border-border bg-muted p-3">
        <div class="flex items-center justify-between gap-6 text-sm">
          <span>
            合计金额：
            <span class="font-semibold text-blue-600">
              {{ totalAmount.toFixed(2) }}
            </span>
          </span>
          <span class="flex items-center gap-2">
            折让金额：
            <Input
              v-if="!isReadonly"
              v-model:value="discountAmount"
              :style="{ width: '120px' }"
              :maxlength="20"
              inputMode="decimal"
              placeholder="折让金额"
            />
            <span v-else class="font-semibold">
              {{ (Number(discountAmount) || 0).toFixed(2) }}
            </span>
          </span>
          <span>
            实际金额：
            <span class="font-semibold text-green-600">
              {{ actualAmount.toFixed(2) }}
            </span>
          </span>
        </div>
      </div>
    </div>
  </Modal>
</template>
