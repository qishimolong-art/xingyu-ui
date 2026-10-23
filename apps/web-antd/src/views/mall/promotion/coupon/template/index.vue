<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallCouponTemplateApi } from '#/api/mall/promotion/coupon/couponTemplate';

import { confirm, DocAlert, Page, useVbenModal } from '@vben/common-ui';
import {
  CommonStatusEnum,
  CouponTemplateTakeTypeEnum,
  CouponTemplateValidityTypeEnum,
} from '@vben/constants';
import { $t } from '@vben/locales';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteCouponTemplate,
  getCouponTemplatePage,
  updateCouponTemplateStatus,
} from '#/api/mall/promotion/coupon/couponTemplate';

import { handleMallPromotionSearchEnter } from '../../utils/grid-search';
import { useGridColumns, useGridFormSchema } from './data';
import AddressSendModal from './modules/address-send-modal.vue';
import Form from './modules/form.vue';

import '../../styles/compact-grid.css';

defineOptions({ name: 'PromotionCouponTemplate' });

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [AddressSend, addressSendApi] = useVbenModal({
  connectedComponent: AddressSendModal,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

function handleSearchEnter(event: KeyboardEvent) {
  handleMallPromotionSearchEnter(event, () => gridApi.query());
}

/** 编辑优惠券模板 */
function handleEdit(row: MallCouponTemplateApi.CouponTemplate) {
  formModalApi.setData(row).open();
}

/** 创建优惠券模板 */
function handleCreate() {
  formModalApi.setData(null).open();
}

function handleAddressSend(row: MallCouponTemplateApi.CouponTemplate) {
  addressSendApi.setData(row).open();
}

function isAddressSendDisabled(row: MallCouponTemplateApi.CouponTemplate) {
  if (row.status !== CommonStatusEnum.ENABLE) return true;
  return (
    row.validityType === CouponTemplateValidityTypeEnum.DATE.type &&
    new Date(row.validEndTime).getTime() < Date.now()
  );
}

/** 删除优惠券模板 */
async function handleDelete(row: MallCouponTemplateApi.CouponTemplate) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteCouponTemplate(row.id!);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

/** 优惠券模板状态修改 */
async function handleStatusChange(
  newStatus: number,
  row: MallCouponTemplateApi.CouponTemplate,
): Promise<boolean | undefined> {
  return new Promise((resolve, reject) => {
    confirm({
      content: `你要将${row.name}的状态切换为【${newStatus === CommonStatusEnum.ENABLE ? '启用' : '停用'}】吗？`,
    })
      .then(async () => {
        // 更新优惠券模板状态
        await updateCouponTemplateStatus(row.id!, newStatus);
        // 提示并返回成功
        message.success($t('ui.actionMessage.operationSuccess'));
        resolve(true);
      })
      .catch(() => {
        reject(new Error('取消操作'));
      });
  });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(handleStatusChange),
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
          return await getCouponTemplatePage({
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
  } as VxeTableGridOptions<MallCouponTemplateApi.CouponTemplate>,
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【营销】优惠劵"
        url="https://doc.iocoder.cn/mall/promotion-coupon/"
      />
    </template>

    <FormModal @success="handleRefresh" />
    <AddressSend @success="handleRefresh" />
    <Grid
      class="mall-promotion-compact-grid"
      table-title="优惠券列表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['优惠券模板']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['promotion:coupon-template:create'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '按地区发放',
              type: 'link',
              auth: ['promotion:coupon:send'],
              ifShow: row.takeType === CouponTemplateTakeTypeEnum.ADMIN.type,
              disabled: isAddressSendDisabled(row),
              onClick: handleAddressSend.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['promotion:coupon-template:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['promotion:coupon-template:delete'],
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
