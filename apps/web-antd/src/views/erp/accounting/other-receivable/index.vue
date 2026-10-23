<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpOtherReceivableApi } from '#/api/erp/finance/accounting/other-receivable';

import { Page, useVbenModal } from '@vben/common-ui';
import { onMounted } from 'vue';

import { message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteOtherReceivable,
  getOtherReceivablePage,
  updateOtherReceivableStatus,
} from '#/api/erp/finance/accounting/other-receivable';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { useAccountingShortcut } from '#/views/erp/composables/useAccountingShortcut';

import {
  getAuditStatusColor,
  getAuditStatusText,
  useGridColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';

const FIELD_PERMISSION_MODULE = 'erp_accounting_other_receivable';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

useAccountingShortcut({
  onCreate: handleCreate,
});

function handleEdit(row: ErpOtherReceivableApi.OtherReceivable) {
  formModalApi.setData({ id: row.id, type: 'edit' }).open();
}

function handleDetail(row: ErpOtherReceivableApi.OtherReceivable) {
  formModalApi.setData({ id: row.id, type: 'detail' }).open();
}

async function handleDelete(row: ErpOtherReceivableApi.OtherReceivable) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.no]),
    duration: 0,
  });
  try {
    await deleteOtherReceivable(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.no]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleAudit(row: ErpOtherReceivableApi.OtherReceivable) {
  await updateOtherReceivableStatus(row.id as number, 20);
  message.success('审核成功');
  handleRefresh();
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
          return await getOtherReceivablePage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...formValues,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpOtherReceivableApi.OtherReceivable>,
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
    <Grid table-title="其他应收单列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['其他应收单']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              tooltip: 'Insert 新增',
              title: 'Insert 新增',
              auth: ['erp:other-receivable:create'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #status="{ row }">
        <Tag :color="getAuditStatusColor(row.status)">
          {{ getAuditStatusText(row.status) }}
        </Tag>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '详情',
              type: 'link',
              onClick: handleDetail.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['erp:other-receivable:update'],
              ifShow: () => row.status === 10,
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '审核',
              type: 'link',
              auth: ['erp:other-receivable:update-status'],
              ifShow: () => row.status === 10,
              popConfirm: {
                title: '确认审核该应收单吗？',
                confirm: handleAudit.bind(null, row),
              },
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:other-receivable:delete'],
              ifShow: () => row.status === 10,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
