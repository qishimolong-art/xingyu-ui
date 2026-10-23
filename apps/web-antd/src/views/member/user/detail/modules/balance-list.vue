<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { WalletTransactionApi } from '#/api/pay/wallet/transaction';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getTransactionPage } from '#/api/pay/wallet/transaction';
import { useTransactionGridColumns } from '#/views/pay/wallet/balance/data';

import '../../../styles/compact-grid.css';

const props = defineProps<{
  walletId: number | undefined;
}>();

const [Grid] = useVbenVxeGrid({
  gridOptions: {
    columns: useTransactionGridColumns(),
    keepSource: true,
    scrollX: {
      enabled: true,
      gt: 0,
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getTransactionPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            walletId: props.walletId,
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
  } as VxeTableGridOptions<WalletTransactionApi.Transaction>,
});
</script>

<template>
  <Grid class="member-compact-grid" />
</template>
