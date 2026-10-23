<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallCouponTemplateApi } from '#/api/mall/promotion/coupon/couponTemplate';

import { nextTick, ref } from 'vue';

import { Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getCouponTemplatePage } from '#/api/mall/promotion/coupon/couponTemplate';

import { handleMallPromotionSearchEnter } from '../../utils/grid-search';
import { useGridColumns, useGridFormSchema } from './select-data';

import '../../styles/compact-grid.css';

defineOptions({ name: 'CouponSelect' });

const props = defineProps<{
  takeType?: number; // 领取方式
}>();

const emit = defineEmits<{
  (e: 'change', v: MallCouponTemplateApi.CouponTemplate[]): void;
}>();

const visible = ref(false); // 弹窗显示状态

function handleSearchEnter(event: KeyboardEvent) {
  handleMallPromotionSearchEnter(event, () => gridApi.query());
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
            canTakeTypes: props.takeType ? [props.takeType] : [],
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

/** 打开弹窗 */
async function open() {
  visible.value = true;
  // 等待 Modal 和 Grid 组件挂载完成后再查询
  await nextTick();
  await gridApi.query();
}

/** 确认选择 */
function handleConfirm() {
  const selectedRecords = (gridApi.grid?.getCheckboxRecords() ||
    []) as MallCouponTemplateApi.CouponTemplate[];
  emit('change', selectedRecords);
  closeModal();
}

/** 关闭弹窗 */
function closeModal() {
  visible.value = false;
}

/** 对外暴露的方法 */
defineExpose({
  open,
});
</script>

<template>
  <Modal
    v-model:open="visible"
    title="选择优惠券"
    width="960px"
    :destroy-on-close="true"
    @ok="handleConfirm"
    @cancel="closeModal"
  >
    <Grid
      class="mall-promotion-compact-grid"
      @keydown.enter.capture="handleSearchEnter"
    />
  </Modal>
</template>
