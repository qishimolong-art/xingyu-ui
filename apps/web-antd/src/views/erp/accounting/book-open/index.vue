<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpBookOpenApi } from '#/api/erp/finance/accounting/book-open';

import { onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { Card, Checkbox, CheckboxGroup, message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getBookOpenPage,
  getVoucherConfigList,
  updateVoucherConfigs,
} from '#/api/erp/finance/accounting/book-open';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { useAccountingShortcut } from '#/views/erp/composables/useAccountingShortcut';

import {
  useGridColumns,
  useGridFormSchema,
  VOUCHER_TYPE_OPTIONS,
} from './data';
import Form from './modules/form.vue';

const FIELD_PERMISSION_MODULE = 'erp_accounting_book_open';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/** 当前选中的开账记录 + 凭证类型勾选状态 */
const currentBookOpen = ref<ErpBookOpenApi.BookOpen | null>(null);
const voucherConfigs = ref<ErpBookOpenApi.VoucherConfig[]>([]);
/** 已勾选的 voucherType 列表，便于绑定 a-checkbox-group */
const checkedVoucherTypes = ref<number[]>([]);
/** 是否有改动（决定保存按钮是否可点） */
const dirty = ref(false);
const configLoading = ref(false);
const configSaving = ref(false);

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 创建开账 */
function handleCreate() {
  formModalApi.setData(null).open();
}

useAccountingShortcut({
  onCreate: handleCreate,
});

/** 加载某条开账的凭证类型勾选 */
async function loadVoucherConfigs(row: ErpBookOpenApi.BookOpen) {
  if (!row.id) return;
  currentBookOpen.value = row;
  configLoading.value = true;
  dirty.value = false;
  try {
    const list = await getVoucherConfigList(row.id);
    voucherConfigs.value = list || [];
    checkedVoucherTypes.value = (list || [])
      .filter((item) => item.enabled)
      .map((item) => item.voucherType);
  } finally {
    configLoading.value = false;
  }
}

/** 勾选变化 */
function handleCheckedChange(values: Array<boolean | number | string>) {
  checkedVoucherTypes.value = values.map((value) => Number(value));
  dirty.value = true;
}

/** 保存凭证类型勾选 */
async function handleSaveConfigs() {
  if (!currentBookOpen.value?.id) return;
  configSaving.value = true;
  try {
    const items = VOUCHER_TYPE_OPTIONS.map((opt, idx) => {
      const matched = voucherConfigs.value.find(
        (c) => c.voucherType === opt.value,
      );
      return {
        voucherType: opt.value,
        enabled: checkedVoucherTypes.value.includes(opt.value),
        sort: matched?.sort ?? idx + 1,
      };
    });
    await updateVoucherConfigs({
      bookOpenId: currentBookOpen.value.id,
      items,
    });
    message.success($t('ui.actionMessage.operationSuccess'));
    dirty.value = false;
    await loadVoucherConfigs(currentBookOpen.value);
  } finally {
    configSaving.value = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(hiddenFields.value),
  },
  gridOptions: {
    columns: useGridColumns(hiddenFields.value),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getBookOpenPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
      isCurrent: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpBookOpenApi.BookOpen>,
  gridEvents: {
    cellClick: ({
      row,
      column,
    }: {
      column: any;
      row: ErpBookOpenApi.BookOpen;
    }) => {
      // 操作列不触发加载
      if (column?.field === undefined || column?.type === 'checkbox') {
        return;
      }
      loadVoucherConfigs(row);
    },
  },
});

onMounted(async () => {
  await loadHiddenFields();
  gridApi.formApi?.setState?.({
    schema: useGridFormSchema(hiddenFields.value),
  });
  gridApi.setGridOptions({
    columns: useGridColumns(hiddenFields.value),
  });
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <Grid table-title="系统开账列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['开账']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              tooltip: 'Insert 新增',
              title: 'Insert 新增',
              auth: ['erp:book-open:create'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #opened="{ row }">
        <Tag v-if="row.opened" color="success">已开账</Tag>
        <Tag v-else color="default">未开账</Tag>
      </template>
    </Grid>

    <Card class="mt-4" :loading="configLoading">
      <template #title>
        <span>自动生成凭证配置</span>
        <span v-if="currentBookOpen" class="ml-2 text-sm text-gray-500">
          ({{ currentBookOpen.no }} - {{ currentBookOpen.fiscalYear }} 年)
        </span>
      </template>
      <template #extra>
        <a-button
          v-if="currentBookOpen"
          type="primary"
          :disabled="!dirty"
          :loading="configSaving"
          @click="handleSaveConfigs"
        >
          保存配置
        </a-button>
      </template>
      <div v-if="!currentBookOpen" class="text-gray-400 py-6 text-center">
        请在上方表格点击一条开账记录以查看其凭证类型配置
      </div>
      <div v-else>
        <CheckboxGroup
          :value="checkedVoucherTypes"
          @change="handleCheckedChange"
        >
          <div class="grid grid-cols-2 gap-y-3 md:grid-cols-4">
            <Checkbox
              v-for="opt in VOUCHER_TYPE_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </Checkbox>
          </div>
        </CheckboxGroup>
      </div>
    </Card>
  </Page>
</template>
