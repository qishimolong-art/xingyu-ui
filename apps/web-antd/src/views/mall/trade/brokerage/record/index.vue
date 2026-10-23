<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallBrokerageRecordApi } from '#/api/mall/trade/brokerage/record';

import { DocAlert, Page } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBrokerageRecordPage } from '#/api/mall/trade/brokerage/record';

import { handleMallTradeSearchEnter } from '../../utils/grid-search';
import { useGridColumns, useGridFormSchema } from './data';

import '../../styles/compact-grid.css';

defineOptions({ name: 'TradeBrokerageRecord' });

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
    scrollX: {
      enabled: true,
      gt: 7,
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getBrokerageRecordPage({
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
  } as VxeTableGridOptions<MallBrokerageRecordApi.BrokerageRecord>,
});

function handleSearchEnter(event: KeyboardEvent) {
  handleMallTradeSearchEnter(event, () => gridApi.query());
}
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【交易】分销返佣"
        url="https://doc.iocoder.cn/mall/trade-brokerage/"
      />
    </template>

    <Grid
      class="mall-trade-compact-grid"
      table-title="分销返佣记录"
      @keydown.enter.capture="handleSearchEnter"
    />
  </Page>
</template>
