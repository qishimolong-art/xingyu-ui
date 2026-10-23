<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallSpuApi } from '#/api/mall/product/spu';

import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { confirm, DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { ProductSpuStatusEnum } from '@vben/constants';
import { downloadFileFromBlobPart, fenToYuan, yuanToFen } from '@vben/utils';

import { InputNumber, message, Modal, Tabs } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteSpu,
  exportSpu,
  getSpuPage,
  getTabsCount,
  updateRetailPrice,
  updateStatus,
} from '#/api/mall/product/spu';
import { $t } from '#/locales';

import { handleMallProductSearchEnter } from '../utils/grid-search';
import { useGridColumns, useGridFormSchema } from './data';
import SpuForm from './form/index.vue';

import '../styles/compact-grid.css';

const route = useRoute();
const tabType = ref(0);
const tabsData = ref([
  {
    name: '出售中',
    type: 0,
    count: 0,
  },
  {
    name: '仓库中',
    type: 1,
    count: 0,
  },
  {
    name: '已售罄',
    type: 2,
    count: 0,
  },
  {
    name: '警戒库存',
    type: 3,
    count: 0,
  },
  {
    name: '回收站',
    type: 4,
    count: 0,
  },
]);

const [SpuFormModal, spuFormModalApi] = useVbenModal({
  connectedComponent: SpuForm,
  destroyOnClose: true,
});
const retailPriceModalOpen = ref(false);
const retailPriceSaving = ref(false);
const retailPriceRow = ref<MallSpuApi.Spu>();
const retailPriceYuan = ref<number>(0);

/** 刷新表格 */
async function handleRefresh() {
  await gridApi.query();
  await getTabCount();
}

/** 导出表格 */
async function handleExport() {
  const data = await exportSpu(await gridApi.formApi.getValues());
  downloadFileFromBlobPart({ fileName: '商品.xls', source: data });
}

/** 获得每个 Tab 的数量 */
async function getTabCount() {
  const res = await getTabsCount();
  for (const objName in res) {
    const index = Number(objName);
    if (tabsData.value[index]) {
      tabsData.value[index].count = res[objName]!;
    }
  }
}

/** 创建商品 */
function handleCreate() {
  spuFormModalApi.setData({ type: 'create' }).open();
}

/** 编辑商品 */
function handleEdit(row: MallSpuApi.Spu) {
  spuFormModalApi.setData({ id: row.id, type: 'edit' }).open();
}

/** 修改小程序价格 */
function handleUpdateRetailPrice(row: MallSpuApi.Spu) {
  retailPriceRow.value = row;
  retailPriceYuan.value = Number(fenToYuan(row.price ?? 0));
  retailPriceModalOpen.value = true;
}

async function handleRetailPriceSubmit() {
  const row = retailPriceRow.value;
  if (!row?.id) {
    return;
  }
  const price = Number(yuanToFen(retailPriceYuan.value ?? 0));
  retailPriceSaving.value = true;
  try {
    await updateRetailPrice({ id: row.id, price });
    message.success('小程序价格已更新');
    retailPriceModalOpen.value = false;
    await handleRefresh();
  } finally {
    retailPriceSaving.value = false;
  }
}

/** 删除商品 */
async function handleDelete(row: MallSpuApi.Spu) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteSpu(row.id!);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    await handleRefresh();
  } finally {
    hideLoading();
  }
}

/** 更新状态 */
async function handleStatusChange(
  newStatus: number,
  row: MallSpuApi.Spu,
): Promise<boolean | undefined> {
  return new Promise((resolve, reject) => {
    // 二次确认
    const text = newStatus ? '上架' : '下架';
    confirm({
      content: `确认要${text + row.name}吗?`,
    })
      .then(async () => {
        // 更新状态
        await updateStatus({
          id: row.id!,
          status: newStatus,
        });
        // 提示并返回成功
        message.success(`${text}成功`);
        resolve(true);
      })
      .catch(() => {
        reject(new Error('取消操作'));
      });
  });
}

/** 添加到仓库 / 回收站的状态 */
async function handleStatus02Change(row: MallSpuApi.Spu, newStatus: number) {
  const text =
    newStatus === ProductSpuStatusEnum.RECYCLE.status
      ? '加入到回收站'
      : '恢复到仓库';
  await confirm({
    content: `确认要"${row.name}"${text}吗？`,
  });
  const hideLoading = message.loading({
    content: `正在${text}中...`,
    duration: 0,
  });
  try {
    await updateStatus({ id: row.id!, status: newStatus });
    message.success(`${text}成功`);
    await handleRefresh();
  } finally {
    hideLoading();
  }
}

/** 查看商品详情 */
function handleDetail(row: MallSpuApi.Spu) {
  spuFormModalApi.setData({ id: row.id, type: 'detail' }).open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: MallSpuApi.Spu;
}) {
  if (
    !row?.id ||
    column?.field === 'actions' ||
    column?.field === 'status' ||
    column?.field === 'price' ||
    column?.slots?.default === 'actions'
  ) {
    return;
  }
  handleDetail(row);
}

function handleSearchEnter(event: KeyboardEvent) {
  handleMallProductSearchEnter(event, () => gridApi.query());
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
    scrollX: {
      enabled: true,
      gt: 8,
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getSpuPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            tabType: tabType.value,
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
  } as VxeTableGridOptions<MallSpuApi.Spu>,
  gridEvents: {
    cellClick: handleCellClick,
  },
});

function onChangeTab(key: any) {
  tabType.value = Number(key);
  gridApi.query();
}

onMounted(async () => {
  // 解析路由的 categoryId
  if (route.query.categoryId) {
    await gridApi.formApi.setValues({
      categoryId: Number(route.query.categoryId),
    });
  }
  // 获得每个 Tab 的数量
  await getTabCount();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【商品】商品 SPU 与 SKU"
        url="https://doc.iocoder.cn/mall/product-spu-sku/"
      />
    </template>

    <SpuFormModal @success="handleRefresh" />
    <Modal
      v-model:open="retailPriceModalOpen"
      :confirm-loading="retailPriceSaving"
      destroy-on-close
      title="修改小程序价格"
      width="420px"
      @ok="handleRetailPriceSubmit"
    >
      <div class="mall-spu-retail-price-modal">
        <div class="mall-spu-retail-price-modal__name">
          {{ retailPriceRow?.name }}
        </div>
        <div class="mall-spu-retail-price-modal__field">
          <span class="mall-spu-retail-price-modal__label">小程序价格</span>
          <InputNumber
            v-model:value="retailPriceYuan"
            :min="0"
            :precision="2"
            class="mall-spu-retail-price-modal__input"
            addon-after="元"
          />
        </div>
      </div>
    </Modal>

    <Grid
      class="mall-product-compact-grid mall-product-row-detail-grid"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-actions>
        <Tabs @change="onChangeTab" class="mall-product-status-tabs w-full">
          <Tabs.TabPane
            v-for="item in tabsData"
            :key="item.type"
            :tab="`${item.name} (${item.count})`"
          />
        </Tabs>
      </template>
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['商品']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['product:spu:create'],
              onClick: handleCreate,
            },
            {
              label: $t('ui.actionTitle.export'),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['product:spu:export'],
              onClick: handleExport,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '改价',
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['product:spu:update'],
              onClick: handleUpdateRetailPrice.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['product:spu:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.detail'),
              type: 'link',
              icon: ACTION_ICON.VIEW,
              onClick: handleDetail.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['product:spu:delete'],
              ifShow: () => tabType === 4,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                confirm: handleDelete.bind(null, row),
              },
            },
            {
              label: '恢复',
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['product:spu:update'],
              onClick: handleStatus02Change.bind(
                null,
                row,
                ProductSpuStatusEnum.DISABLE.status,
              ),
            },
            {
              label: '回收',
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['product:spu:update'],
              onClick: handleStatus02Change.bind(
                null,
                row,
                ProductSpuStatusEnum.RECYCLE.status,
              ),
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.mall-spu-retail-price-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mall-spu-retail-price-modal__name {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 500;
}

.mall-spu-retail-price-modal__field {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.mall-spu-retail-price-modal__label {
  color: hsl(var(--muted-foreground));
}

.mall-spu-retail-price-modal__input {
  width: 100%;
}
</style>
