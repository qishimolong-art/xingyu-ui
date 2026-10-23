<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpRecycleBinApi } from '#/api/erp/base/recycle-bin';

import { onActivated, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { isEmpty } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  clearRecycleBin,
  getRecycleBinPage,
  restoreRecycleBin,
} from '#/api/erp/base/recycle-bin';
import { queueFocusArchiveSearchInput } from '#/views/erp/base/utils/archive-search-focus';

import { useGridColumns, useGridFormSchema } from './data';

defineOptions({ name: 'ErpRecycleBin' });

const checkedRows = ref<ErpRecycleBinApi.RecycleBinItem[]>([]);
const currentPageRows = ref<ErpRecycleBinApi.RecycleBinItem[]>([]);
const recycleBinGridShellRef = ref<HTMLElement>();

function buildBatchReq(): ErpRecycleBinApi.BatchReq {
  return {
    items: checkedRows.value.map((item) => ({
      sourceId: item.sourceId,
      sourceType: item.sourceType,
    })),
  };
}

function handleRefresh() {
  checkedRows.value = [];
  gridApi.query();
}

async function handleRestore() {
  if (checkedRows.value.length === 0) {
    message.warning('请先勾选至少一条数据');
    return;
  }
  await restoreRecycleBin(buildBatchReq());
  message.success('还原成功');
  handleRefresh();
}

async function handleClear() {
  if (checkedRows.value.length === 0) {
    message.warning('请先勾选至少一条数据');
    return;
  }
  await clearRecycleBin(buildBatchReq());
  message.success('清除成功');
  handleRefresh();
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpRecycleBinApi.RecycleBinItem[];
}) {
  checkedRows.value = records;
}

async function reloadRecycleBinColumns(
  rows: ErpRecycleBinApi.RecycleBinItem[] = currentPageRows.value,
) {
  await gridApi.grid?.reloadColumn?.(useGridColumns(rows) as any[]);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(currentPageRows.value),
    fit: false,
    height: 'auto',
    id: 'erp-base-recycle-bin-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 6,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getRecycleBinPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
          result.list = result.list.map((item) => ({
            ...item,
            rowKey: `${item.sourceType}:${item.sourceId}`,
          }));
          currentPageRows.value = result.list ?? [];
          await reloadRecycleBinColumns(currentPageRows.value);
          return result;
        },
        querySuccess: () => {
          checkedRows.value = [];
        },
      },
    },
    rowConfig: {
      keyField: 'rowKey',
      isHover: true,
      isCurrent: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpRecycleBinApi.RecycleBinItem>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

onMounted(() => {
  queueFocusArchiveSearchInput(recycleBinGridShellRef);
});

onActivated(() => {
  queueFocusArchiveSearchInput(recycleBinGridShellRef);
});
</script>

<template>
  <Page auto-content-height>
    <div ref="recycleBinGridShellRef" class="recycle-bin-grid-shell">
      <Grid table-title="回收站列表">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '还原',
                type: 'primary',
                icon: ACTION_ICON.REFRESH,
                disabled: isEmpty(checkedRows),
                auth: ['erp:recycle-bin:restore'],
                popConfirm: {
                  title: `是否还原选中的 ${checkedRows.length} 条数据？还原后数据将重新启用。`,
                  confirm: handleRestore,
                },
              },
              {
                label: '清除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                disabled: isEmpty(checkedRows),
                auth: ['erp:recycle-bin:clear'],
                popConfirm: {
                  title: `是否彻底清除选中的 ${checkedRows.length} 条数据？清除后无法在系统中还原。`,
                  confirm: handleClear,
                },
              },
            ]"
          />
        </template>
      </Grid>
    </div>
  </Page>
</template>

<style scoped>
.recycle-bin-grid-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>
