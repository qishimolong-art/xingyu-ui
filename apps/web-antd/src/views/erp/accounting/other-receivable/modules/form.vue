<script lang="ts" setup>
import type { ErpOtherReceivableApi } from '#/api/erp/finance/accounting/other-receivable';

import { computed, nextTick, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { erpPriceInputFormatter } from '@vben/utils';

import { Button, Input, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createOtherReceivable,
  getOtherReceivable,
  updateOtherReceivable,
} from '#/api/erp/finance/accounting/other-receivable';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import {
  formatOptionalNumberInput,
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';

import { useFormItemColumns, useFormSchema } from '../data';

const emit = defineEmits(['success']);

const formData = ref<ErpOtherReceivableApi.OtherReceivable>({ items: [] });
const formType = ref<string>('create');
const tableData = ref<ErpOtherReceivableApi.OtherReceivableItem[]>([]);
const discountAmount = ref<string>('0');
const FIELD_PERMISSION_MODULE = 'erp_accounting_other_receivable';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

let isInternalUpdate = false;

const getTitle = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['其他应收单']);
  if (formType.value === 'edit')
    return $t('ui.actionTitle.edit', ['其他应收单']);
  return '其他应收单详情';
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
    labelWidth: 90,
  },
  wrapperClass: 'grid-cols-2',
  layout: 'vertical',
  schema: useFormSchema('', hiddenFields.value),
  showDefaultActions: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useFormItemColumns('', hiddenFields.value),
    data: tableData.value,
    minHeight: 200,
    autoResize: true,
    border: true,
    rowConfig: { keyField: 'seq', isHover: true },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  },
});

watch(
  () => tableData.value,
  () => {
    if (!isInternalUpdate) return;
    isInternalUpdate = false;
  },
  { deep: true },
);

function initRow(row: ErpOtherReceivableApi.OtherReceivableItem) {
  if (!row.seq) {
    row.seq = Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`);
  }
  if (row.amount == null) row.amount = '0';
}

function emitReload(skipReload = false) {
  if (skipReload) {
    isInternalUpdate = true;
    return;
  }
  void nextTick(() => {
    gridApi.grid.reloadData(tableData.value);
  });
}

function handleFieldChange(_row: ErpOtherReceivableApi.OtherReceivableItem) {
  emitReload(true);
}

function handleAdd() {
  const newRow: ErpOtherReceivableApi.OtherReceivableItem = {
    seq: Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`),
    summary: '',
    amount: 0,
    remark: '',
  };
  tableData.value.push(newRow);
  emitReload(false);
}

function handleDelete(row: ErpOtherReceivableApi.OtherReceivableItem) {
  const index = tableData.value.findIndex((it) => it.seq === row.seq);
  if (index !== -1) tableData.value.splice(index, 1);
  emitReload(false);
}

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

    modalApi.lock();
    try {
      const data =
        (await formApi.getValues()) as ErpOtherReceivableApi.OtherReceivable;
      data.items = tableData.value.map((item) => ({
        id: formType.value === 'create' ? undefined : item.id,
        summary: item.summary,
        amount: toOptionalNumberValue(item.amount) || 0,
        remark: item.remark,
      }));
      data.totalAmount = totalAmount.value;
      data.discountAmount = Number(discountAmount.value) || 0;
      data.actualAmount = actualAmount.value;

      await (formType.value === 'create'
        ? createOtherReceivable(data)
        : updateOtherReceivable(data));
      message.success($t('ui.actionMessage.operationSuccess'));
      emit('success');
      await modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = { items: [] };
      tableData.value = [];
      discountAmount.value = '0';
      return;
    }
    const data = modalApi.getData<{ id?: number; type: string }>();
    formType.value = data.type;
    await loadHiddenFields();
    formApi.setState({
      schema: useFormSchema(formType.value, hiddenFields.value),
    });
    gridApi.setGridOptions({
      columns: useFormItemColumns(formType.value, hiddenFields.value),
    });
    // 等待 schema 反应式渲染完成 + ApiSelect 触发首次 fetchApi
    // 避免 setValues 在 ApiSelect 选项加载前就设值，导致 Select 显示原始 ID 而不是名称
    await nextTick();

    if (!data || !data.id) {
      await formApi.setValues({ bizTime: Date.now() }, false);
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getOtherReceivable(data.id);
      await formApi.setValues(
        {
          ...formData.value,
          totalAmount: formatOptionalNumberInput(formData.value.totalAmount),
          discountAmount: formatOptionalNumberInput(
            formData.value.discountAmount,
          ),
          actualAmount: formatOptionalNumberInput(formData.value.actualAmount),
        },
        false,
      );
      discountAmount.value =
        formatOptionalNumberInput(formData.value.discountAmount) || '0';
      const items = formData.value.items || [];
      items.forEach((item) => initRow(item));
      tableData.value = [...items];
      await nextTick();
      await gridApi.grid.reloadData(tableData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-[800px]"
    :show-confirm-button="!isReadonly"
  >
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
            @click="handleAdd"
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
              @change="handleFieldChange(row)"
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
              @change="handleFieldChange(row)"
            />
            <span v-else>{{
              erpPriceInputFormatter(row.amount) || '0.00'
            }}</span>
          </template>
          <template #remark="{ row }">
            <Input
              v-if="!isReadonly"
              v-model:value="row.remark"
              placeholder="请输入备注"
              :maxlength="200"
              @change="handleFieldChange(row)"
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
                    confirm: handleDelete.bind(null, row),
                  },
                },
              ]"
            />
          </template>
        </Grid>
      </div>

      <!-- 底部汇总 -->
      <div class="rounded border border-border bg-muted p-3">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm">合计金额：</span>
            <span class="font-semibold text-blue-600">
              {{ erpPriceInputFormatter(totalAmount) || '0.00' }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">折让金额：</span>
            <Input
              v-if="!isReadonly"
              v-model:value="discountAmount"
              :style="{ width: '120px' }"
              placeholder="折让"
              :maxlength="20"
              inputMode="decimal"
            />
            <span v-else class="font-semibold">
              {{
                erpPriceInputFormatter(Number(discountAmount) || 0) || '0.00'
              }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">实际金额：</span>
            <span class="font-semibold text-green-600">
              {{ erpPriceInputFormatter(actualAmount) || '0.00' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>
