<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpVoucherApi } from '#/api/erp/finance/accounting/voucher';

import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';
import { onMounted } from 'vue';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  auditVoucher,
  deleteVoucher,
  exportVoucher,
  getVoucherPage,
} from '#/api/erp/finance/accounting/voucher';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useAccountingShortcut } from '#/views/erp/composables/useAccountingShortcut';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpVoucher' });

const FIELD_PERMISSION_MODULE = 'erp_accounting_voucher';
const PRINT_TEMPLATE_MODULE = 'accounting_voucher';
const PRINT_MODULE_NAME = '凭证';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
  onOpenChange: handleFormModalOpenChange,
});

const [PrintTemplateDesignModal, printTemplateDesignModalApi] = useVbenModal({
  connectedComponent: PrintTemplateModal,
  destroyOnClose: true,
});

let isFormModalOpen = false;
let ignoreRowClickUntil = 0;

function handleFormModalOpenChange(isOpen: boolean) {
  isFormModalOpen = isOpen;
  if (!isOpen) {
    ignoreRowClickUntil = Date.now() + 300;
  }
}

function handleFormModalClose() {
  isFormModalOpen = false;
  ignoreRowClickUntil = Date.now() + 300;
}

/** 刷新 */
function handleRefresh() {
  gridApi.query();
}

function openVoucherPrintModal(data: {
  businessId?: number | string;
  businessNo?: string;
  moduleKey: string;
  moduleName: string;
  templateId?: number | string;
}) {
  printTemplateDesignModalApi.setData(data).open();
}

const {
  cancelTemplateSelect,
  confirmTemplate,
  openDesigner: handleOpenPrintTemplateDesigner,
  printRow: printVoucherRow,
  selectedTemplateId: selectedPrintTemplateId,
  selectorOpen: printTemplateSelectOpen,
  templateOptions: printTemplateOptions,
} = useErpPrintTemplate<ErpVoucherApi.Voucher & { no?: string }>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openVoucherPrintModal,
});

function handlePrint(row: ErpVoucherApi.Voucher) {
  printVoucherRow({ ...row, no: row.voucherNo });
}

/** 导出 */
async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpVoucherApi.Voucher[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  const data = await exportVoucher(
    selectedIds.length > 0
      ? { ids: selectedIds }
      : await gridApi.formApi.getValues(),
  );
  downloadFileFromBlobPart({ fileName: '凭证列表.xls', source: data });
}

/** 新增 */
function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

useAccountingShortcut({
  onCreate: handleCreate,
});

/** 编辑 */
function handleEdit(row: ErpVoucherApi.Voucher) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

/** 详情 */
function handleDetail(row: ErpVoucherApi.Voucher) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

/** 行点击：默认进入详情；未审核可改用编辑入口 */
function handleRowClick(row: ErpVoucherApi.Voucher) {
  if (row.auditStatus === 10) {
    formModalApi.setData({ type: 'edit', id: row.id }).open();
  } else {
    formModalApi.setData({ type: 'detail', id: row.id }).open();
  }
}

/** 删除 */
async function handleDelete(row: ErpVoucherApi.Voucher) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.voucherNo]),
    duration: 0,
  });
  try {
    await deleteVoucher(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.voucherNo]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

/** 审核 */
async function handleAudit(row: ErpVoucherApi.Voucher) {
  await auditVoucher(row.id as number);
  message.success('审核成功');
  handleRefresh();
}

const rowActionColumnFields = new Set([
  'actions',
  'deleteAction',
  'printAction',
]);

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
          return await getVoucherPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpVoucherApi.Voucher>,
  gridEvents: {
    cellClick: ({
      column,
      row,
    }: {
      column: any;
      row: ErpVoucherApi.Voucher;
    }) => {
      // 操作列点击不触发行点击
      if (
        column?.type === 'checkbox' ||
        (column?.field && rowActionColumnFields.has(column.field))
      ) {
        return;
      }
      if (isFormModalOpen || Date.now() < ignoreRowClickUntil) return;
      handleRowClick(row);
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
    <FormModal @close="handleFormModalClose" @success="handleRefresh" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <Grid table-title="凭证列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['凭证']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              tooltip: 'Insert 新增',
              title: 'Insert 新增',
              auth: ['erp:voucher:create'],
              onClick: handleCreate,
            },
            {
              label: $t('ui.actionTitle.export'),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:voucher:query'],
              onClick: handleExport,
            },
            {
              label: '打印模板',
              type: 'primary',
              icon: ACTION_ICON.EDIT,
              auth: ['erp:voucher:print-template'],
              onClick: handleOpenPrintTemplateDesigner,
            },
          ]"
        />
      </template>
      <template #printAction="{ row }">
        <TableAction
          :actions="[
            {
              label: '打印',
              type: 'link',
              auth: ['erp:voucher:print'],
              onClick: handlePrint.bind(null, row),
            },
          ]"
        />
      </template>
      <template #deleteAction="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              auth: ['erp:voucher:delete'],
              ifShow: () => row.auditStatus === 10,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.voucherNo]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label:
                row.auditStatus === 10
                  ? $t('common.edit')
                  : $t('common.detail'),
              type: 'link',
              icon:
                row.auditStatus === 10 ? ACTION_ICON.EDIT : ACTION_ICON.VIEW,
              auth: ['erp:voucher:query'],
              onClick:
                row.auditStatus === 10
                  ? handleEdit.bind(null, row)
                  : handleDetail.bind(null, row),
            },
            {
              label: '审核',
              type: 'link',
              icon: ACTION_ICON.AUDIT,
              auth: ['erp:voucher:audit'],
              ifShow: () => row.auditStatus === 10,
              popConfirm: {
                title: `确认审核凭证 ${row.voucherNo} 吗？`,
                confirm: handleAudit.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
