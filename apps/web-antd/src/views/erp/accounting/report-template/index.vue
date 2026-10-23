<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReportItemTemplateApi } from '#/api/erp/finance/accounting/report-template';

import { ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { Alert, message, Tabs } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteReportItemTemplate,
  getReportItemTemplatePage,
} from '#/api/erp/finance/accounting/report-template';
import { $t } from '#/locales';
import { useAccountingShortcut } from '#/views/erp/composables/useAccountingShortcut';

import {
  REPORT_TYPE_OPTIONS,
  SIDE_OPTIONS,
  useGridColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';

/** 当前选中的报表类型 */
const currentReportType = ref<number>(1);
/** 当前选中的区域（仅资产负债表 reportType=1 时显示子 Tab） */
const currentSide = ref<number | undefined>(1);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 创建报表项目 */
function handleCreate() {
  formModalApi
    .setData(null)
    .setProps({
      defaultReportType: currentReportType.value,
      defaultSide:
        currentReportType.value === 1 ? currentSide.value : undefined,
    })
    .open();
}

useAccountingShortcut({
  onCreate: handleCreate,
});

/** 编辑报表项目 */
function handleEdit(row: ErpReportItemTemplateApi.ReportItemTemplate) {
  formModalApi.setData(row).open();
}

/** 删除报表项目 */
async function handleDelete(row: ErpReportItemTemplateApi.ReportItemTemplate) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.itemName]),
    duration: 0,
  });
  try {
    await deleteReportItemTemplate(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.itemName]));
    handleRefresh();
  } finally {
    hideLoading();
  }
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
          return await getReportItemTemplatePage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            reportType: currentReportType.value,
            side: currentReportType.value === 1 ? currentSide.value : undefined,
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
  } as VxeTableGridOptions<ErpReportItemTemplateApi.ReportItemTemplate>,
});

/** Tab 切换 → 刷新列表 */
watch([currentReportType, currentSide], () => {
  handleRefresh();
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <Alert
      class="mb-2"
      type="info"
      show-icon
      message="报表项目模板只维护三大报表结构和取数公式。"
      description="公式版本、会计期间、结账及受控反结账、凭证取数和现金流项目尚未完成正式确认前，资产负债表、利润表、现金流量表不能作为正式财务报表输出；后续需支持科目余额、试算平衡、明细账及逐级下钻。"
    />
    <div class="mb-2 rounded-md bg-white p-4">
      <Tabs v-model:active-key="currentReportType" type="card">
        <Tabs.TabPane
          v-for="opt in REPORT_TYPE_OPTIONS"
          :key="opt.value"
          :tab="opt.label"
        />
      </Tabs>
      <Tabs
        v-if="currentReportType === 1"
        v-model:active-key="currentSide"
        size="small"
      >
        <Tabs.TabPane
          v-for="opt in SIDE_OPTIONS"
          :key="opt.value"
          :tab="opt.label"
        />
      </Tabs>
    </div>

    <Grid table-title="报表项目模板">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['报表项目']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              tooltip: 'Insert 新增',
              title: 'Insert 新增',
              auth: ['erp:balance-sheet:query'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['erp:balance-sheet:query'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:balance-sheet:query'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.itemName]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
