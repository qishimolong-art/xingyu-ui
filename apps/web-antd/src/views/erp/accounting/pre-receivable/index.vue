<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPreReceivableApi } from '#/api/erp/finance/accounting/pre-receivable';

import { Page, useVbenModal } from '@vben/common-ui';
import { onMounted } from 'vue';

import { message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePreReceivable,
  getPreReceivablePage,
  updatePreReceivableStatus,
} from '#/api/erp/finance/accounting/pre-receivable';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { useAccountingShortcut } from '#/views/erp/composables/useAccountingShortcut';

import {
  getAuditStatusColor,
  getAuditStatusText,
  getPartyTypeText,
  useGridColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpPreReceivable' });

const FIELD_PERMISSION_MODULE = 'erp_accounting_pre_receivable';
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

function handleEdit(row: ErpPreReceivableApi.PreReceivable) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpPreReceivableApi.PreReceivable) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

async function handleDelete(row: ErpPreReceivableApi.PreReceivable) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.no]),
    duration: 0,
  });
  try {
    await deletePreReceivable(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.no]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleAudit(row: ErpPreReceivableApi.PreReceivable) {
  await updatePreReceivableStatus(row.id as number, 20);
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
          return await getPreReceivablePage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...formValues,
          });
        },
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpPreReceivableApi.PreReceivable>,
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
    <Grid table-title="预收账款单列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['预收账款单']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              tooltip: 'Insert 新增',
              title: 'Insert 新增',
              auth: ['erp:pre-receivable:create'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #partyType="{ row }">
        {{ getPartyTypeText(row.partyType) }}
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
              label:
                row.status === 10 ? $t('common.edit') : $t('common.detail'),
              type: 'link',
              icon: row.status === 10 ? ACTION_ICON.EDIT : ACTION_ICON.VIEW,
              auth: ['erp:pre-receivable:query'],
              onClick:
                row.status === 10
                  ? handleEdit.bind(null, row)
                  : handleDetail.bind(null, row),
            },
            {
              label: '审核',
              type: 'link',
              auth: ['erp:pre-receivable:update-status'],
              ifShow: () => row.status === 10,
              popConfirm: {
                title: `确认审核预收账款单 ${row.no} 吗？`,
                confirm: handleAudit.bind(null, row),
              },
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:pre-receivable:delete'],
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
