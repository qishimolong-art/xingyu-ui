<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';
import type { MallCouponTemplateApi } from '#/api/mall/promotion/coupon/couponTemplate';

import { useVbenModal } from '@vben/common-ui';
import { CouponTemplateTakeTypeEnum } from '@vben/constants';

import { message } from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { sendCoupon } from '#/api/mall/promotion/coupon/coupon';
import { getCouponTemplatePage } from '#/api/mall/promotion/coupon/couponTemplate';

import { handleMallPromotionSearchEnter } from '../../utils/grid-search';
import { useFormSchema, useGridColumns } from './send-form-data';

import '../../styles/compact-grid.css';

/** 发送优惠券 */
async function handleSendCoupon(row: MallCouponTemplateApi.CouponTemplate) {
  modalApi.lock();
  try {
    await sendCoupon({
      templateId: row.id,
      userIds: modalApi.getData().userIds,
    });
    message.success('发送成功');
    await modalApi.close();
  } finally {
    modalApi.unlock();
  }
}

function handleSearchEnter(event: KeyboardEvent) {
  handleMallPromotionSearchEnter(event, () => gridApi.query());
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 68 },
    schema: useFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 500,
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
            canTakeTypes: [CouponTemplateTakeTypeEnum.ADMIN.type],
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
  } as VxeGridProps<MallCouponTemplateApi.CouponTemplate>,
});

const [Modal, modalApi] = useVbenModal({
  showCancelButton: false,
  showConfirmButton: false,
});
</script>

<template>
  <Modal title="发送优惠劵" class="!w-[900px] max-w-[96vw]">
    <Grid
      class="mall-promotion-compact-grid"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '发送',
              type: 'link',
              auth: ['promotion:coupon:send'],
              onClick: () => handleSendCoupon(row),
            },
          ]"
        />
      </template>
    </Grid>
  </Modal>
</template>
