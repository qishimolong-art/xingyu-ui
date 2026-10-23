<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPreReceiptApi } from '#/api/erp/finance/accounting/pre-receipt';

import { onMounted } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePreReceipt,
  getPreReceiptPage,
  updatePreReceiptStatus,
} from '#/api/erp/finance/accounting/pre-receipt';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { useAccountingShortcut } from '#/views/erp/composables/useAccountingShortcut';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const FIELD_PERMISSION_MODULE = 'erp_accounting_pre_receipt';
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
  formModalApi.setData(null).open();
}

useAccountingShortcut({
  onCreate: handleCreate,
});

function handleEdit(row: ErpPreReceiptApi.PreReceipt) {
  formModalApi.setData({ id: row.id, formType: 'update' }).open();
}

function handleDetail(row: ErpPreReceiptApi.PreReceipt) {
  formModalApi.setData({ id: row.id, formType: 'detail' }).open();
}

async function handleDelete(row: ErpPreReceiptApi.PreReceipt) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.no]),
    duration: 0,
  });
  try {
    await deletePreReceipt(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.no]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleAudit(row: ErpPreReceiptApi.PreReceipt) {
  await updatePreReceiptStatus(row.id as number, 20);
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
          const params: Parameters<typeof getPreReceiptPage>[0] = {
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...formValues,
          };
          if (formValues.bizTime && formValues.bizTime.length === 2) {
            params['bizTime[0]'] = formValues.bizTime[0];
            params['bizTime[1]'] = formValues.bizTime[1];
            delete params.bizTime;
          }
          return await getPreReceiptPage(params);
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
  } as VxeTableGridOptions<ErpPreReceiptApi.PreReceipt>,
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
    <Grid table-title="预收款单列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['预收款单']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              tooltip: 'Insert 新增',
              title: 'Insert 新增',
              auth: ['erp:pre-receipt:create'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #status="{ row }">
        <Tag v-if="row.status === 10" color="default">未审核</Tag>
        <Tag v-else-if="row.status === 20" color="success">已审核</Tag>
        <Tag v-else-if="row.status === 30" color="warning">已反审</Tag>
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
              auth: ['erp:pre-receipt:update'],
              ifShow: () => row.status === 10,
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '审核',
              type: 'link',
              auth: ['erp:pre-receipt:update-status'],
              ifShow: () => row.status === 10,
              popConfirm: {
                title: '确认审核该预收款单？',
                confirm: handleAudit.bind(null, row),
              },
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:pre-receipt:delete'],
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
