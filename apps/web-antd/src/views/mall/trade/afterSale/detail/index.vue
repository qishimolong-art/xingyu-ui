<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallAfterSaleApi } from '#/api/mall/trade/afterSale';
import type { MallOrderApi } from '#/api/mall/trade/order';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { DICT_TYPE } from '@vben/constants';
import { useTabs } from '@vben/hooks';
import { $t } from '@vben/locales';

import { message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  agreeAfterSale,
  getAfterSale,
  receiveAfterSale,
  refundAfterSale,
  refuseAfterSale,
} from '#/api/mall/trade/afterSale';
import { useDescription } from '#/components/description';
import { DictTag } from '#/components/dict-tag';
import { TableAction } from '#/components/table-action';

import DisagreeForm from '../modules/disagree-form.vue';
import {
  useAfterSaleInfoSchema,
  useOperateLogSchema,
  useOrderInfoSchema,
  useProductColumns,
  useRefundStatusSchema,
} from './data';

import '../../styles/compact-grid.css';

defineOptions({ name: 'TradeAfterSaleDetail' });

const emit = defineEmits(['success']);

const route = useRoute();
const router = useRouter();
const tabs = useTabs();

const loading = ref(false);
const afterSaleId = ref(0);
const afterSale = ref<MallAfterSaleApi.AfterSale>({
  order: {},
  orderItem: {},
  logs: [],
});
const isLegacyRoute = computed(
  () => String(route.name || '') === 'TradeAfterSaleDetail',
);

const [OrderDescriptions] = useDescription({
  title: '订单信息',
  bordered: false,
  column: 3,
  class: 'mx-4',
  schema: useOrderInfoSchema(),
});

const [AfterSaleDescriptions] = useDescription({
  title: '售后信息',
  bordered: false,
  column: 3,
  class: 'mx-4',
  schema: useAfterSaleInfoSchema(),
});

const [RefundStatusDescriptions] = useDescription({
  title: '退款状态',
  bordered: false,
  column: 1,
  class: 'mx-4',
  schema: useRefundStatusSchema(),
});

const [ProductGrid, productGridApi] = useVbenVxeGrid({
  gridOptions: {
    cellConfig: {
      height: 60,
    },
    columns: useProductColumns(),
    data: [],
    height: 'auto',
    border: true,
    scrollX: {
      enabled: true,
      gt: 5,
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<MallOrderApi.OrderItem>,
});

const [OperateLogGrid, operateLogGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useOperateLogSchema(),
    data: [],
    border: true,
    scrollX: {
      enabled: true,
      gt: 4,
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions,
});

const [DisagreeModal, disagreeModalApi] = useVbenModal({
  connectedComponent: DisagreeForm,
  destroyOnClose: true,
});

async function refreshDetailAndList() {
  await getDetail();
  emit('success');
}

/** 获得详情 */
async function getDetail() {
  loading.value = true;
  try {
    const res = await getAfterSale(afterSaleId.value);
    if (res === null) {
      message.error('售后订单不存在');
      handleBack();
      return;
    }
    afterSale.value = res;
    productGridApi.setGridOptions({ data: [afterSale.value.orderItem] });
    operateLogGridApi.setGridOptions({
      data: afterSale.value.logs || [],
    });
  } finally {
    loading.value = false;
  }
}

/** 同意售后 */
async function handleAgree() {
  await confirm('是否同意售后？');
  const hideLoading = message.loading({
    content: '正在处理中...',
    duration: 0,
  });
  try {
    await agreeAfterSale(afterSale.value.id!);
    message.success($t('ui.actionMessage.operationSuccess'));
    await refreshDetailAndList();
  } finally {
    hideLoading();
  }
}

/** 拒绝售后 */
function handleDisagree() {
  disagreeModalApi.setData({ afterSale: afterSale.value }).open();
}

/** 确认收货 */
async function handleReceive() {
  await confirm('是否确认收货？');
  const hideLoading = message.loading({
    content: '正在处理中...',
    duration: 0,
  });
  try {
    await receiveAfterSale(afterSale.value.id!);
    message.success($t('ui.actionMessage.operationSuccess'));
    await refreshDetailAndList();
  } finally {
    hideLoading();
  }
}

/** 拒绝收货 */
async function handleRefuse() {
  await confirm('是否拒绝收货？');
  const hideLoading = message.loading({
    content: '正在处理中...',
    duration: 0,
  });
  try {
    await refuseAfterSale(afterSale.value.id!);
    message.success($t('ui.actionMessage.operationSuccess'));
    await refreshDetailAndList();
  } finally {
    hideLoading();
  }
}

/** 确认退款 */
async function handleRefund() {
  await confirm('是否确认退款？');
  const hideLoading = message.loading({
    content: '正在处理中...',
    duration: 0,
  });
  try {
    await refundAfterSale(afterSale.value.id!);
    message.success($t('ui.actionMessage.operationSuccess'));
    await refreshDetailAndList();
  } finally {
    hideLoading();
  }
}

function resetDetail() {
  afterSaleId.value = 0;
  afterSale.value = {
    order: {},
    orderItem: {},
    logs: [],
  };
  productGridApi.setGridOptions({ data: [] });
  operateLogGridApi.setGridOptions({ data: [] });
}

async function openDetail(data?: { id?: number }) {
  resetDetail();
  afterSaleId.value = Number(data?.id || 0);
  if (!afterSaleId.value) {
    return;
  }
  await getDetail();
}

async function handleLegacyRouteClosed() {
  if (!isLegacyRoute.value) {
    return;
  }
  await tabs.closeCurrentTab();
  if (String(route.name || '') === 'TradeAfterSaleDetail') {
    await router.replace({ name: 'TradeAfterSale' });
  }
}

/** 返回列表页 */
async function handleBack() {
  await modalApi.close();
}

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      resetDetail();
      await handleLegacyRouteClosed();
      return;
    }
    modalApi.setState({ fullscreen: true });
    await openDetail(modalApi.getData<{ id?: number }>());
  },
});

/** 初始化 */
onMounted(() => {
  if (!isLegacyRoute.value) {
    return;
  }
  modalApi.setData({ id: Number(route.params.id) }).open();
});
</script>

<template>
  <Modal
    :title="afterSale.no || '退款详情'"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="false"
  >
    <Page auto-content-height :loading="loading">
      <template #extra>
        <TableAction
          :actions="[
            {
              label: '返回',
              type: 'default',
              icon: 'lucide:arrow-left',
              onClick: handleBack,
            },
            {
              label: '同意售后',
              type: 'primary',
              onClick: handleAgree,
              ifShow: afterSale.status === 10,
            },
            {
              label: '拒绝售后',
              type: 'primary',
              danger: true,
              onClick: handleDisagree,
              ifShow: afterSale.status === 10,
            },
            {
              label: '确认收货',
              type: 'primary',
              onClick: handleReceive,
              ifShow: afterSale.status === 30,
            },
            {
              label: '拒绝收货',
              type: 'primary',
              danger: true,
              onClick: handleRefuse,
              ifShow: afterSale.status === 30,
            },
            {
              label: '确认退款',
              type: 'primary',
              onClick: handleRefund,
              ifShow: afterSale.status === 40,
            },
          ]"
        />
      </template>

      <!-- 拒绝售后弹窗 -->
      <DisagreeModal @success="refreshDetailAndList" />

      <div class="mall-trade-detail-modal">
        <!-- 订单信息 -->
        <div class="mall-trade-detail-section">
          <OrderDescriptions :data="afterSale" />
        </div>
        <!-- 售后信息 -->
        <div class="mall-trade-detail-section">
          <AfterSaleDescriptions :data="afterSale" />
        </div>
        <!-- 退款状态 -->
        <div class="mall-trade-detail-section">
          <RefundStatusDescriptions :data="afterSale" />
        </div>
        <!-- 商品信息 -->
        <div class="mall-trade-detail-section">
          <ProductGrid class="mall-trade-compact-grid" table-title="商品信息">
            <template #spuName="{ row }">
              <div class="flex flex-1 flex-col items-start gap-1 text-left">
                <span class="text-sm">{{ row.spuName }}</span>
                <div class="flex flex-wrap gap-1">
                  <Tag
                    v-for="property in row.properties"
                    :key="property.propertyId!"
                    size="small"
                  >
                    {{ property.propertyName }}: {{ property.valueName }}
                  </Tag>
                </div>
              </div>
            </template>
          </ProductGrid>
        </div>
        <!-- 操作日志 -->
        <div class="mall-trade-detail-section">
          <OperateLogGrid
            class="mall-trade-compact-grid"
            table-title="售后日志"
          >
            <template #userType="{ row }">
              <Tag v-if="row.userId === 0" color="default">系统</Tag>
              <DictTag
                v-else
                :type="DICT_TYPE.USER_TYPE"
                :value="row.userType"
              />
            </template>
          </OperateLogGrid>
        </div>
      </div>
    </Page>
    <template #cancelText>关闭</template>
  </Modal>
</template>
