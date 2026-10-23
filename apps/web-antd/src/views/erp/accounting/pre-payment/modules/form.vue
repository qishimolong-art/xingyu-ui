<script lang="ts" setup>
import type { ErpPrePaymentApi } from '#/api/erp/finance/accounting/pre-payment';

import { computed, nextTick, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Input, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  createPrePayment,
  getPrePayment,
  updatePrePayment,
} from '#/api/erp/finance/accounting/pre-payment';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import {
  formatOptionalNumberInput,
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';

import { useFormSchema, useItemColumns } from '../data';

const emit = defineEmits(['success']);

const formData = ref<ErpPrePaymentApi.PrePayment>({ items: [] } as any);
const formType = ref<string>('');
const tableData = ref<ErpPrePaymentApi.PrePaymentItem[]>([]);
const discountAmount = ref<string>('0');
const FIELD_PERMISSION_MODULE = 'erp_accounting_pre_payment';
const { hiddenFields, loadHiddenFields, isHidden } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
let isInternalUpdate = false;

const getTitle = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['预付款单']);
  if (formType.value === 'edit') return $t('ui.actionTitle.edit', ['预付款单']);
  return '预付款单详情';
});

const isReadonly = computed(() => formType.value === 'detail');

const totalAmount = computed(() => {
  return tableData.value.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
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
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useItemColumns(false, hiddenFields.value),
    data: tableData.value,
    minHeight: 200,
    autoResize: true,
    border: true,
    rowConfig: { keyField: 'seq', isHover: true },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  },
});

/** 加载结算账户下拉 */
async function loadAccountOptions() {
  if (isHidden('accountId')) {
    return;
  }
  const list = await getAccountSimpleList();
  formApi.updateSchema([
    {
      fieldName: 'accountId',
      componentProps: {
        options: (list || []).map((item: any) => ({
          label: item.name,
          value: item.id,
        })),
        placeholder: '请选择结算账户',
      },
    },
  ]);
}

watch(
  () => tableData.value,
  () => {
    // no-op: totalAmount is computed
  },
  { deep: true },
);

/** 监听外部 items */
watch(
  () => formData.value.items,
  async (items) => {
    if (!items) return;
    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }
    items.forEach((item, idx) => {
      if (!item.seq) {
        item.seq = Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`);
      }
      item.lineNo = idx + 1;
    });
    tableData.value = [...items];
    await nextTick();
    await gridApi.grid.reloadData(tableData.value);
  },
  { immediate: true },
);

function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  formData.value.items = [...tableData.value];
  if (!skipReload) {
    nextTick(() => gridApi.grid.reloadData(tableData.value));
  }
}

function handleFieldChange(_row: ErpPrePaymentApi.PrePaymentItem) {
  emitItemsUpdate(true);
}

function handleAdd() {
  const newRow: ErpPrePaymentApi.PrePaymentItem = {
    seq: Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`),
    lineNo: tableData.value.length + 1,
    summary: '',
    amount: 0,
    remark: '',
  };
  tableData.value.push(newRow);
  emitItemsUpdate(false);
}

function handleDelete(row: ErpPrePaymentApi.PrePaymentItem) {
  const index = tableData.value.findIndex((it) => it.seq === row.seq);
  if (index !== -1) tableData.value.splice(index, 1);
  tableData.value.forEach((it, idx) => {
    it.lineNo = idx + 1;
  });
  emitItemsUpdate(false);
}

async function submit() {
  const { valid } = await formApi.validate();
  if (!valid) return false;

  if (tableData.value.length === 0) {
    message.error('请至少添加一条明细');
    return false;
  }

  modalApi.lock();
  try {
    const data = (await formApi.getValues()) as ErpPrePaymentApi.PrePayment;
    data.items = tableData.value.map((item) => ({
      ...item,
      id: formType.value === 'create' ? undefined : item.id,
      amount: toOptionalNumberValue(item.amount) || 0,
    }));
    data.totalAmount = totalAmount.value;
    data.discountAmount = Number(discountAmount.value) || 0;
    data.actualAmount = actualAmount.value;
    await (formType.value === 'create'
      ? createPrePayment(data)
      : updatePrePayment(data));
    message.success($t('ui.actionMessage.operationSuccess'));
    emit('success');
    return true;
  } finally {
    modalApi.unlock();
  }
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const ok = await submit();
    if (ok) await modalApi.close();
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = { items: [] } as any;
      tableData.value = [];
      discountAmount.value = '0';
      return;
    }
    await loadHiddenFields();
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    gridApi.setGridOptions({
      columns: useItemColumns(formType.value === 'detail', hiddenFields.value),
    });
    await loadAccountOptions();
    const data = modalApi.getData<{ id?: number; type: string }>();
    formType.value = data.type;
    formApi.setDisabled(formType.value === 'detail');
    gridApi.setGridOptions({
      columns: useItemColumns(formType.value === 'detail', hiddenFields.value),
    });

    if (!data || !data.id) {
      formData.value = { items: [] } as any;
      tableData.value = [];
      discountAmount.value = '0';
      await formApi.setValues({ bizTime: Date.now(), partyType: 2 }, false);
      return;
    }
    modalApi.lock();
    try {
      const detail = await getPrePayment(data.id);
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
          <span class="text-sm font-medium">付款明细</span>
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
              row.amount != null ? Number(row.amount).toFixed(2) : '-'
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

      <!-- 底部合计 -->
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
