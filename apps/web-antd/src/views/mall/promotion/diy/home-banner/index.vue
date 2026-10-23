<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallDiyHomeBannerApi } from '#/api/mall/promotion/diy/home-banner';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDiyHomeBanner,
  getDiyHomeBannerPage,
} from '#/api/mall/promotion/diy/home-banner';
import { $t } from '#/locales';

import { handleMallPromotionSearchEnter } from '../../utils/grid-search';
import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

import '../../styles/compact-grid.css';

defineOptions({ name: 'DiyHomeBanner' });

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

function handleSearchEnter(event: KeyboardEvent) {
  handleMallPromotionSearchEnter(event, () => gridApi.query());
}

/** 创建首页轮播图 */
function handleCreate() {
  formModalApi.setData(null).open();
}

/** 编辑首页轮播图 */
function handleEdit(row: MallDiyHomeBannerApi.HomeBanner) {
  formModalApi.setData(row).open();
}

function getBannerActionName(row: MallDiyHomeBannerApi.HomeBanner) {
  return row.title || `首页轮播图 #${row.id}`;
}

/** 删除首页轮播图 */
async function handleDelete(row: MallDiyHomeBannerApi.HomeBanner) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [getBannerActionName(row)]),
    duration: 0,
  });
  try {
    await deleteDiyHomeBanner(row.id as number);
    message.success(
      $t('ui.actionMessage.deleteSuccess', [getBannerActionName(row)]),
    );
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 0,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getDiyHomeBannerPage({
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
  } as VxeTableGridOptions<MallDiyHomeBannerApi.HomeBanner>,
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【营销】商城装修"
        url="https://doc.iocoder.cn/mall/diy/"
      />
    </template>

    <FormModal @success="handleRefresh" />
    <Grid
      class="mall-promotion-compact-grid"
      table-title="首页轮播图列表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['首页轮播图']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['promotion:diy-home-banner:create'],
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
              auth: ['promotion:diy-home-banner:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['promotion:diy-home-banner:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [
                  getBannerActionName(row),
                ]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
