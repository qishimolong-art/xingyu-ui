<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MemberPointRecordApi } from '#/api/member/point/record';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getRecordPage } from '#/api/member/point/record';
import {
  useGridColumns as usePointGridColumns,
  useGridFormSchema as usePointGridFormSchema,
} from '#/views/member/point/record/data';

import { handleMemberSearchEnter } from '../../../utils/grid-search';

import '../../../styles/compact-grid.css';

const props = defineProps<{
  userId: number;
}>();

/** 列表的搜索表单（过滤掉用户相关字段） */
function useGridFormSchema() {
  const excludeFields = new Set(['nickname']);
  return usePointGridFormSchema().filter(
    (item) => !excludeFields.has(item.fieldName),
  );
}

/** 列表的字段（过滤掉用户相关字段） */
function useGridColumns() {
  const excludeFields = new Set(['nickname']);
  return usePointGridColumns()?.filter(
    (item) => item.field && !excludeFields.has(item.field),
  );
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
    keepSource: true,
    scrollX: {
      enabled: true,
      gt: 0,
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    pagerConfig: {
      pageSize: 10,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getRecordPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            userId: props.userId,
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
  } as VxeTableGridOptions<MemberPointRecordApi.Record>,
});

function handleSearchEnter(event: KeyboardEvent) {
  handleMemberSearchEnter(event, () => gridApi.query());
}
</script>

<template>
  <Grid
    class="member-compact-grid"
    @keydown.enter.capture="handleSearchEnter"
  />
</template>
