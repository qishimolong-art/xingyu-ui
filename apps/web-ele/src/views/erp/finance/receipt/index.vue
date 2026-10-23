<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';

import { ref } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { ElLoading, ElMessage } from 'element-plus';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteFinanceReceipt,
  exportFinanceReceipt,
  getFinanceReceiptPage,
  updateFinanceReceiptStatus,
} from '#/api/erp/finance/receipt';
import { $t } from '#/locales';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpFinanceReceipt' });

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
}

async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpFinanceReceiptApi.FinanceReceipt[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  const data = await exportFinanceReceipt(
    selectedIds.length > 0
      ? { ids: selectedIds }
      : await gridApi.formApi.getValues(),
  );
  downloadFileFromBlobPart({ fileName: '鏀舵鍗?xls', source: data });
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleEdit(row: ErpFinanceReceiptApi.FinanceReceipt) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

async function handleDelete(ids: number[]) {
  const loadingInstance = ElLoading.service({
    text: $t('ui.actionMessage.deleting'),
  });
  try {
    await deleteFinanceReceipt(ids);
    ElMessage.success($t('ui.actionMessage.deleteSuccess'));
    handleRefresh();
  } finally {
    loadingInstance.close();
  }
}

async function handleUpdateStatus(
  row: ErpFinanceReceiptApi.FinanceReceipt,
  status: number,
) {
  if (status !== 20) return;
  const actionText = status === 20 ? 'approve' : 'reverse approve';
  const loadingInstance = ElLoading.service({
    text: `Confirm ${actionText} this receipt bill?`,
  });
  try {
    await updateFinanceReceiptStatus(row.id!, status);
    ElMessage.success(`${actionText} success`);
    handleRefresh();
  } finally {
    loadingInstance.close();
  }
}

const checkedIds = ref<number[]>([]);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpFinanceReceiptApi.FinanceReceipt[];
}) {
  checkedIds.value = records.map((item) => item.id!);
}

function handleDetail(row: ErpFinanceReceiptApi.FinanceReceipt) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getFinanceReceiptPage({
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
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpFinanceReceiptApi.FinanceReceipt>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="銆愯储鍔°€戦噰璐粯娆俱€侀攢鍞敹娆?"
        url="https://doc.iocoder.cn/sale/finance-payment-receipt/"
      />
    </template>

    <FormModal @success="handleRefresh" />
    <Grid table-title="鏀舵鍗曞垪琛?">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['receipt bill']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:finance-receipt:create'],
              onClick: handleCreate,
            },
            {
              label: $t('ui.actionTitle.export'),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:finance-receipt:export'],
              onClick: handleExport,
            },
            {
              label: '鎵归噺鍒犻櫎',
              type: 'danger',
              disabled: isEmpty(checkedIds),
              icon: ACTION_ICON.DELETE,
              auth: ['erp:finance-receipt:delete'],
              popConfirm: {
                title: `鏄惁鍒犻櫎鎵€閫変腑鏁版嵁锛焋`,
                confirm: handleDelete.bind(null, checkedIds),
              },
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.detail'),
              type: 'primary',
              link: true,
              icon: ACTION_ICON.VIEW,
              auth: ['erp:finance-receipt:query'],
              onClick: handleDetail.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'primary',
              link: true,
              icon: ACTION_ICON.EDIT,
              auth: ['erp:finance-receipt:update'],
              ifShow: () => row.status !== 20,
              onClick: handleEdit.bind(null, row),
            },
            {
              label: 'Approve',
              type: 'primary',
              link: true,
              icon: ACTION_ICON.AUDIT,
              auth: ['erp:finance-receipt:update-status'],
              ifShow: () => row.status === 10,
              popConfirm: {
                title: `Confirm approve ${row.no}?`,
                confirm: handleUpdateStatus.bind(null, row, 20),
              },
            },
            {
              label: $t('common.delete'),
              type: 'danger',
              link: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:finance-receipt:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                confirm: handleDelete.bind(null, [row.id!]),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
