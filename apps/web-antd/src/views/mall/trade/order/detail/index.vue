<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallDeliveryExpressApi } from '#/api/mall/trade/delivery/express';
import type { MallDeliveryPickUpStoreApi } from '#/api/mall/trade/delivery/pickUpStore';
import type { MallOrderApi } from '#/api/mall/trade/order';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import {
  DeliveryTypeEnum,
  DICT_TYPE,
  TradeOrderStatusEnum,
} from '@vben/constants';
import { useTabs } from '@vben/hooks';

import { message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getSimpleDeliveryExpressList } from '#/api/mall/trade/delivery/express';
import { getDeliveryPickUpStore } from '#/api/mall/trade/delivery/pickUpStore';
import {
  getExpressTrackList,
  getOrder,
  pickUpOrder,
} from '#/api/mall/trade/order';
import { useDescription } from '#/components/description';
import { DictTag } from '#/components/dict-tag';
import { TableAction } from '#/components/table-action';

import AddressForm from '../modules/address-form.vue';
import DeliveryForm from '../modules/delivery-form.vue';
import PriceForm from '../modules/price-form.vue';
import RemarkForm from '../modules/remark-form.vue';
import {
  useDeliveryInfoSchema,
  useExpressTrackColumns,
  useOperateLogColumns,
  useOrderInfoSchema,
  useOrderPriceSchema,
  useOrderStatusSchema,
  useProductColumns,
} from './data';

import '../../styles/compact-grid.css';

defineOptions({ name: 'TradeOrderDetail' });

const emit = defineEmits(['success']);

const route = useRoute();
const router = useRouter();
const tabs = useTabs();

const loading = ref(false);
const orderId = ref(0);
const order = ref<MallOrderApi.Order>({
  logs: [],
});
const deliveryExpressList = ref<MallDeliveryExpressApi.DeliveryExpress[]>([]);
const expressTrackList = ref<any[]>([]);
const pickUpStore = ref<
  MallDeliveryPickUpStoreApi.DeliveryPickUpStore | undefined
>();
const isLegacyRoute = computed(
  () => String(route.name || '') === 'TradeOrderDetail',
);

const [OrderInfoDescriptions] = useDescription({
  title: '订单信息',
  bordered: false,
  column: 3,
  class: 'mx-4',
  schema: useOrderInfoSchema(),
});

const [OrderStatusDescriptions] = useDescription({
  title: '订单状态',
  bordered: false,
  column: 1,
  class: 'mx-4',
  schema: useOrderStatusSchema(),
});

const [OrderPriceDescriptions] = useDescription({
  title: '费用信息',
  bordered: false,
  column: 4,
  class: 'mx-4',
  schema: useOrderPriceSchema(),
});

const [DeliveryInfoDescriptions] = useDescription({
  title: '收货信息',
  bordered: false,
  column: 3,
  class: 'mx-4',
  schema: useDeliveryInfoSchema(),
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
      gt: 6,
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

const [ExpressTrackGrid, expressTrackGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useExpressTrackColumns(),
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

const [OperateLogGrid, operateLogGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useOperateLogColumns(),
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

const [DeliveryFormModal, deliveryFormModalApi] = useVbenModal({
  connectedComponent: DeliveryForm,
  destroyOnClose: true,
});

const [RemarkFormModal, remarkFormModalApi] = useVbenModal({
  connectedComponent: RemarkForm,
  destroyOnClose: true,
});

const [AddressFormModal, addressFormModalApi] = useVbenModal({
  connectedComponent: AddressForm,
  destroyOnClose: true,
});

const [PriceFormModal, priceFormModalApi] = useVbenModal({
  connectedComponent: PriceForm,
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
    const res = await getOrder(orderId.value);
    if (res === null) {
      message.error('交易订单不存在');
      handleBack();
      return;
    }
    order.value = res;
    expressTrackList.value = [];
    pickUpStore.value = undefined;
    productGridApi.setGridOptions({ data: res.items || [] });
    operateLogGridApi.setGridOptions({ data: res.logs || [] });
    expressTrackGridApi.setGridOptions({ data: [] });

    // 如果配送方式为快递，则查询物流公司
    if (res.deliveryType === DeliveryTypeEnum.EXPRESS.type) {
      deliveryExpressList.value = await getSimpleDeliveryExpressList();
      if (res.logisticsId) {
        expressTrackList.value = await getExpressTrackList(res.id!);
        expressTrackGridApi.setGridOptions({
          data: expressTrackList.value || [],
        });
      }
    } else if (
      res.deliveryType === DeliveryTypeEnum.PICK_UP.type &&
      res.pickUpStoreId
    ) {
      pickUpStore.value = await getDeliveryPickUpStore(res.pickUpStoreId);
    }
  } finally {
    loading.value = false;
  }
}

/** 各种操作 */
const handleRemark = () => {
  remarkFormModalApi.setData(order.value).open();
};

const handleDelivery = () => {
  deliveryFormModalApi.setData(order.value).open();
};

const handleUpdateAddress = () => {
  addressFormModalApi.setData(order.value).open();
};

const handleUpdatePrice = () => {
  priceFormModalApi.setData(order.value).open();
};

/** 核销 */
const handlePickUp = async () => {
  await confirm('确认核销订单吗？');
  const hideLoading = message.loading({
    content: '正在处理中...',
    duration: 0,
  });
  try {
    await pickUpOrder(order.value.id!);
    message.success('核销成功');
    await refreshDetailAndList();
  } finally {
    hideLoading();
  }
};

function resetDetail() {
  orderId.value = 0;
  order.value = { logs: [] };
  deliveryExpressList.value = [];
  expressTrackList.value = [];
  pickUpStore.value = undefined;
  productGridApi.setGridOptions({ data: [] });
  expressTrackGridApi.setGridOptions({ data: [] });
  operateLogGridApi.setGridOptions({ data: [] });
}

async function openDetail(data?: { id?: number }) {
  resetDetail();
  orderId.value = Number(data?.id || 0);
  if (!orderId.value) {
    return;
  }
  await getDetail();
}

async function handleLegacyRouteClosed() {
  if (!isLegacyRoute.value) {
    return;
  }
  await tabs.closeCurrentTab();
  if (String(route.name || '') === 'TradeOrderDetail') {
    await router.replace({ name: 'TradeOrder' });
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
onMounted(async () => {
  if (!isLegacyRoute.value) {
    return;
  }
  modalApi.setData({ id: Number(route.params.id) }).open();
});
</script>

<template>
  <Modal
    :title="order.no || '订单详情'"
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
              label: '调整价格',
              type: 'primary',
              onClick: handleUpdatePrice,
              ifShow: order.status === TradeOrderStatusEnum.UNPAID.status,
            },
            {
              label: '备注',
              type: 'primary',
              onClick: handleRemark,
            },
            {
              label: '发货',
              type: 'primary',
              onClick: handleDelivery,
              ifShow:
                order.status === TradeOrderStatusEnum.UNDELIVERED.status &&
                order.deliveryType === DeliveryTypeEnum.EXPRESS.type,
            },
            {
              label: '修改地址',
              type: 'primary',
              onClick: handleUpdateAddress,
              ifShow:
                order.status === TradeOrderStatusEnum.UNDELIVERED.status &&
                order.deliveryType === DeliveryTypeEnum.EXPRESS.type,
            },
            {
              label: '核销',
              type: 'primary',
              onClick: handlePickUp,
              ifShow:
                order.status === TradeOrderStatusEnum.UNDELIVERED.status &&
                order.deliveryType === DeliveryTypeEnum.PICK_UP.type,
            },
          ]"
        />
      </template>

      <!-- 各种操作的弹窗 -->
      <DeliveryFormModal @success="refreshDetailAndList" />
      <RemarkFormModal @success="refreshDetailAndList" />
      <AddressFormModal @success="refreshDetailAndList" />
      <PriceFormModal @success="refreshDetailAndList" />

      <div class="mall-trade-detail-modal">
        <!-- 订单信息 -->
        <div class="mall-trade-detail-section">
          <OrderInfoDescriptions :data="order" />
        </div>
        <!-- 订单状态 -->
        <div class="mall-trade-detail-section">
          <OrderStatusDescriptions :data="order" />
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
        <!-- 费用信息 -->
        <div class="mall-trade-detail-section">
          <OrderPriceDescriptions :data="order" />
        </div>
        <!-- 收货信息 -->
        <div class="mall-trade-detail-section">
          <DeliveryInfoDescriptions :data="order" />
        </div>
        <!-- 物流详情 -->
        <div
          v-if="expressTrackList.length > 0"
          class="mall-trade-detail-section"
        >
          <ExpressTrackGrid
            class="mall-trade-compact-grid"
            table-title="物流详情"
          />
        </div>
        <!-- 操作日志 -->
        <div class="mall-trade-detail-section">
          <OperateLogGrid
            class="mall-trade-compact-grid"
            table-title="操作日志"
          >
            <template #userType="{ row }">
              <Tag v-if="row.userType === 0" color="default"> 系统 </Tag>
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
