<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallBrokerageUserApi } from '#/api/mall/trade/brokerage/user';

import { useVbenModal } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBrokerageUserPage } from '#/api/mall/trade/brokerage/user';

import { handleMallTradeSearchEnter } from '../../../utils/grid-search';
import { useUserListColumns, useUserListFormSchema } from '../data';

import '../../../styles/compact-grid.css';

defineOptions({ name: 'BrokerageUserListModal' });

const [Modal, modalApi] = useVbenModal({});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 68 },
    schema: useUserListFormSchema(),
  },
  gridOptions: {
    columns: useUserListColumns(),
    height: '600',
    keepSource: true,
    scrollX: {
      enabled: true,
      gt: 6,
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getBrokerageUserPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            bindUserId: modalApi.getData().id,
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
  } as VxeTableGridOptions<MallBrokerageUserApi.BrokerageUser>,
});

function handleSearchEnter(event: KeyboardEvent) {
  handleMallTradeSearchEnter(event, () => gridApi.query());
}
</script>

<template>
  <Modal title="推广人列表" class="!w-[900px] max-w-[96vw]">
    <Grid
      class="mall-trade-compact-grid"
      @keydown.enter.capture="handleSearchEnter"
    />
  </Modal>
</template>
