<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallOrderApi } from '#/api/mall/trade/order';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import {
  DeliveryTypeEnum,
  DICT_TYPE,
  TradeOrderStatusEnum,
} from '@vben/constants';
import { fenToYuan } from '@vben/utils';

import { Image, List, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOrderPage } from '#/api/mall/trade/order';
import { DictTag } from '#/components/dict-tag';
import { $t } from '#/locales';

import {
  handleMallTradeSearchEnter,
  shouldIgnoreMallTradeRowDetailClick,
} from '../utils/grid-search';
import { useGridColumns, useGridFormSchema } from './data';
import OrderDetail from './detail/index.vue';
import DeliveryForm from './modules/delivery-form.vue';
import RemarkForm from './modules/remark-form.vue';

import '../styles/compact-grid.css';

const { hasAccessByCodes } = useAccess();

const [DeliveryFormModal, deliveryFormModalApi] = useVbenModal({
  connectedComponent: DeliveryForm,
  destroyOnClose: true,
});

const [RemarkFormModal, remarkFormModalApi] = useVbenModal({
  connectedComponent: RemarkForm,
  destroyOnClose: true,
});

const [OrderDetailModal, orderDetailModalApi] = useVbenModal({
  connectedComponent: OrderDetail,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 详情 */
function handleDetail(row: MallOrderApi.Order) {
  if (!row.id || !hasAccessByCodes(['trade:order:query'])) {
    return;
  }
  orderDetailModalApi.setData({ id: row.id }).open();
}

/** 发货 */
function handleDelivery(row: MallOrderApi.Order) {
  deliveryFormModalApi.setData(row).open();
}

/** 备注 */
function handleRemark(row: MallOrderApi.Order) {
  remarkFormModalApi.setData(row).open();
}

function handleCellClick({
  column,
  event,
  row,
}: {
  column: any;
  event: Event;
  row: MallOrderApi.Order;
}) {
  if (!row?.id || shouldIgnoreMallTradeRowDetailClick({ column, event })) {
    return;
  }
  handleDetail(row);
}

function handleSearchEnter(event: KeyboardEvent) {
  handleMallTradeSearchEnter(event, () => gridApi.query());
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    expandConfig: {
      trigger: 'row',
      expandAll: true,
      padding: true,
    },
    columns: useGridColumns(),
    height: 'auto',
    keepSource: true,
    scrollX: {
      enabled: true,
      gt: 8,
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getOrderPage({
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
  } as VxeTableGridOptions<MallOrderApi.Order>,
  gridEvents: {
    cellClick: handleCellClick,
  },
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【交易】交易订单"
        url="https://doc.iocoder.cn/mall/trade-order/"
      />
      <DocAlert
        title="【交易】购物车"
        url="https://doc.iocoder.cn/mall/trade-cart/"
      />
    </template>

    <DeliveryFormModal @success="handleRefresh" />
    <RemarkFormModal @success="handleRefresh" />
    <OrderDetailModal @success="handleRefresh" />
    <Grid
      class="mall-trade-compact-grid mall-trade-row-detail-grid"
      table-title="订单列表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #expand_content="{ row }">
        <List item-layout="vertical" :data-source="row.items">
          <template #renderItem="{ item }">
            <List.Item>
              <List.Item.Meta>
                <template #title>
                  {{ item.spuName }}
                  <Tag
                    color="blue"
                    v-for="property in item.properties"
                    :key="property.propertyId"
                  >
                    {{ property.propertyName }} : {{ property.valueName }}
                  </Tag>
                </template>
                <template #avatar>
                  <Image :src="item.picUrl" :width="40" :height="40" />
                </template>
                <template #description>
                  {{
                    `原价：${fenToYuan(item.price)} 元 / 数量：${item.count} 个`
                  }}
                  |
                  <DictTag
                    :type="DICT_TYPE.TRADE_ORDER_ITEM_AFTER_SALE_STATUS"
                    :value="item.afterSaleStatus"
                  />
                </template>
              </List.Item.Meta>
            </List.Item>
          </template>
        </List>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.detail'),
              type: 'link',
              icon: ACTION_ICON.VIEW,
              auth: ['trade:order:query'],
              onClick: handleDetail.bind(null, row),
            },
          ]"
          :drop-down-actions="[
            {
              label: '发货',
              type: 'link',
              ifShow: () =>
                row.deliveryType === DeliveryTypeEnum.EXPRESS.type &&
                (row.status === TradeOrderStatusEnum.UNDELIVERED.status ||
                  row.status === TradeOrderStatusEnum.DELIVERED.status),
              onClick: handleDelivery.bind(null, row),
            },
            {
              label: '备注',
              type: 'link',
              onClick: handleRemark.bind(null, row),
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
