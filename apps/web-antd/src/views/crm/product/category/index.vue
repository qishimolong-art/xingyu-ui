<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CrmProductCategoryApi } from '#/api/crm/product/category';

import { nextTick, ref } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteProductCategory,
  getProductCategoryList,
} from '#/api/crm/product/category';
import { $t } from '#/locales';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
type ActiveSortState = { field: string; order: 'asc' | 'desc' };
const currentSort = ref<ActiveSortState | null>(null);
const crmProductCategorySortFieldMap: Record<string, string> = {
  name: 'name',
  id: 'id',
  createTime: 'createTime',
};

function getActiveCrmProductCategorySort(sorts?: any | any[], sort?: any) {
  let sortList: any[] = [];
  if (Array.isArray(sorts)) {
    sortList = sorts;
  } else if (sorts) {
    sortList = [sorts];
  }
  if (sort && !sortList.some((item) => item?.order)) {
    sortList = [sort, ...sortList];
  }
  const activeSort = sortList.find((item) => item?.order);
  if (
    activeSort?.field &&
    crmProductCategorySortFieldMap[activeSort.field] &&
    (activeSort.order === 'asc' || activeSort.order === 'desc')
  ) {
    return {
      field: activeSort.field,
      order: activeSort.order,
    } as ActiveSortState;
  }
  return null;
}

function buildCrmProductCategorySortParams(sorts?: any | any[], sort?: any) {
  const activeSort = getActiveCrmProductCategorySort(sorts, sort);
  currentSort.value = activeSort;
  const orderField = activeSort
    ? crmProductCategorySortFieldMap[activeSort.field]
    : undefined;
  const orderDirection = activeSort?.order;

  return orderField && orderDirection
    ? {
        orderField,
        orderDirection,
      }
    : {};
}

async function restoreCrmProductCategorySortState() {
  const activeSort = currentSort.value;
  await nextTick();
  if (activeSort) {
    await gridApi.grid.setSort?.({
      field: activeSort.field,
      order: activeSort.order,
    });
  }
}

function handleSortChange({ sort, sortList, sorts }: any) {
  currentSort.value = getActiveCrmProductCategorySort(sortList || sorts, sort);
}

/** 切换树形展开/收缩状态 */
const isExpanded = ref(false);
function handleExpand() {
  isExpanded.value = !isExpanded.value;
  gridApi.grid.setAllTreeExpand(isExpanded.value);
}

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 创建分类 */
function handleCreate() {
  formModalApi.setData(null).open();
}

/** 添加下级分类 */
function handleAppend(row: CrmProductCategoryApi.ProductCategory) {
  formModalApi.setData({ parentId: row.id }).open();
}

/** 编辑分类 */
function handleEdit(row: CrmProductCategoryApi.ProductCategory) {
  formModalApi.setData(row).open();
}

/** 删除分类 */
async function handleDelete(row: CrmProductCategoryApi.ProductCategory) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteProductCategory(row.id!);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
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
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async ({ sort, sorts }, formValues) => {
          return await getProductCategoryList({
            ...formValues,
            ...buildCrmProductCategorySortParams(sorts, sort),
          });
        },
        querySuccess: () => {
          void restoreCrmProductCategorySortState();
        },
      },
      sort: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
    treeConfig: {
      parentField: 'parentId',
      rowField: 'id',
      transform: true,
      expandAll: true,
      reserve: true,
    },
  } as VxeTableGridOptions<CrmProductCategoryApi.ProductCategory>,
  gridEvents: {
    sortChange: handleSortChange,
  },
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【产品】产品管理、产品分类"
        url="https://doc.iocoder.cn/crm/product/"
      />
    </template>

    <FormModal @success="handleRefresh" />
    <Grid>
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['分类']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['crm:product-category:create'],
              onClick: handleCreate,
            },
            {
              label: isExpanded ? '收缩' : '展开',
              type: 'primary',
              onClick: handleExpand,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '新增下级',
              type: 'link',
              icon: ACTION_ICON.ADD,
              auth: ['crm:product-category:create'],
              onClick: handleAppend.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['crm:product-category:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['crm:product-category:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
:deep(.vxe-cell--sort) {
  pointer-events: none;
}
</style>
