<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { ErpStockApi } from '#/api/erp/stock/stock';
import type { MallSpuApi } from '#/api/mall/product/spu';

import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useTabs } from '@vben/hooks';
import { cloneDeep, convertToInteger, formatToFraction } from '@vben/utils';

import { Alert, Button, Empty, message, Table, Tabs } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getMallStockSummary } from '#/api/erp/stock/stock';
import {
  createSpu,
  getSpu,
  updateRetailPrice,
  updateSpu,
} from '#/api/mall/product/spu';
import { $t } from '#/locales';

import {
  useDeliveryFormSchema,
  useDescriptionFormSchema,
  useInfoFormSchema,
  useOtherFormSchema,
  usePartsParamFormSchema,
} from './data';

type FormType = 'create' | 'detail' | 'edit';

const emit = defineEmits(['success']);

const spuId = ref<number>();
const route = useRoute();
const router = useRouter();
const { closeCurrentTab } = useTabs();
const { hasAccessByCodes } = useAccess();
const formType = ref<FormType>('create');
const activeTabName = ref('info');
const formLoading = ref(false); // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const isDetail = computed(() => formType.value === 'detail'); // 是否查看详情
const canSubmit = computed(() => !isDetail.value && !formLoading.value);
const canEditFromDetail = computed(
  () =>
    isDetail.value && !!spuId.value && hasAccessByCodes(['product:spu:update']),
);
const modalTitle = computed(() => {
  if (formType.value === 'detail') {
    return '商品详情';
  }
  return formType.value === 'edit' ? '编辑商品' : '新增商品';
});
const legacyRouteNames = ['ProductSpuAdd', 'ProductSpuEdit', 'ProductSpuDetail'];
const legacyRouteNameSet = new Set(legacyRouteNames);
const isLegacyRoute = computed(() =>
  legacyRouteNameSet.has(String(route.name || '')),
);

function createDefaultFormData(): MallSpuApi.Spu {
  return {
    name: '',
    categoryId: undefined,
    keyword: '',
    picUrl: '',
    sliderPicUrls: [],
    introduction: '',
    deliveryTypes: [],
    deliveryTemplateId: undefined,
    brandId: undefined,
    specType: false,
    subCommissionType: false,
    skus: [
      {
        name: '', // SKU 名称，提交时会自动使用 SPU 名称
        price: 0,
        marketPrice: 0,
        costPrice: 0,
        barCode: '',
        picUrl: '',
        stock: 0,
        weight: 0,
        volume: 0,
        firstBrokeragePrice: 0,
        secondBrokeragePrice: 0,
      },
    ],
    description: '',
    sort: 0,
    giveIntegral: 0,
    virtualSalesCount: 0,
  };
}

const formData = ref<MallSpuApi.Spu>(createDefaultFormData()); // spu 表单数据
const mallStockSummary = ref<ErpStockApi.MallStockSummary>();
const mallStockSummaryLoading = ref(false);
const mallStockSummaryError = ref(false);

function formatPartsParamValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (Array.isArray(value)) {
    const text = value
      .map((item) => formatPartsParamValue(item))
      .filter((item) => item !== '-')
      .join(' / ');
    return text || '-';
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return formatPartsParamValue(record.name ?? record.label ?? record.title);
  }

  const text = String(value).trim();
  return text && text !== 'null' && text !== 'undefined' ? text : '-';
}

function buildPartsParamValues(spu: MallSpuApi.Spu) {
  return {
    partCategoryName: formatPartsParamValue(spu.categoryName),
    code: formatPartsParamValue(spu.code),
    partName: formatPartsParamValue(spu.name),
    partBrandName: formatPartsParamValue(spu.brandName),
    standard: formatPartsParamValue(spu.standard),
    featureCode: formatPartsParamValue(spu.featureCode),
    vehicleModel: formatPartsParamValue(spu.vehicleModel),
  };
}

function formatStockCount(value: number | string | undefined) {
  if (value === undefined || value === null || value === '') {
    return '0';
  }
  return String(value);
}

function formatMallStockCell(
  record: ErpStockApi.MallWarehouseStock,
  dataIndex: unknown,
) {
  if (typeof dataIndex !== 'string') {
    return '-';
  }
  return formatStockCount(
    record[dataIndex as keyof ErpStockApi.MallWarehouseStock] as
      | number
      | string
      | undefined,
  );
}

function formatMallTextCell(
  record: ErpStockApi.MallWarehouseStock,
  dataIndex: unknown,
) {
  if (typeof dataIndex !== 'string') {
    return '-';
  }
  const value = record[dataIndex as keyof ErpStockApi.MallWarehouseStock];
  return value || '-';
}

const mallStockSummaryText = computed(() => {
  if (mallStockSummaryLoading.value) {
    return '正在读取 ERP 仓库库存...';
  }
  if (mallStockSummaryError.value) {
    return 'ERP 库存读取失败，不影响商品编辑';
  }
  if (!mallStockSummary.value) {
    return 'ERP 仓库库存：0';
  }
  if (!mallStockSummary.value.mapped) {
    return '未绑定 ERP 产品，暂无仓库库存来源';
  }
  return `ERP 可用库存：${formatStockCount(
    mallStockSummary.value.totalAvailableCount,
  )}，已关联 ERP 产品 ${mallStockSummary.value.mappingCount} 个`;
});

const mallStockSummaryStatus = computed(() => {
  if (mallStockSummaryError.value) {
    return 'is-error';
  }
  if (mallStockSummaryLoading.value) {
    return 'is-loading';
  }
  if (mallStockSummary.value && !mallStockSummary.value.mapped) {
    return 'is-unmapped';
  }
  return 'is-mapped';
});

const mallStockRows = computed(
  () => mallStockSummary.value?.warehouseStocks ?? [],
);
const canSyncRetailPrice = computed(
  () =>
    !!spuId.value &&
    mallStockSummary.value?.mapped === true &&
    mallStockSummary.value?.mappingCount === 1,
);
const retailPriceDisabled = computed(
  () => formType.value === 'edit' && !canSyncRetailPrice.value,
);

const mallStockCards = computed(() => [
  {
    label: '可用库存合计',
    value: mallStockSummary.value?.totalAvailableCount,
    primary: true,
  },
  { label: '当前库存合计', value: mallStockSummary.value?.totalCount },
  { label: '锁定库存合计', value: mallStockSummary.value?.totalLockCount },
  { label: '占用库存合计', value: mallStockSummary.value?.totalOccupiedCount },
  { label: '待入库存合计', value: mallStockSummary.value?.totalPendingInCount },
  { label: '在途库存合计', value: mallStockSummary.value?.totalInTransitCount },
]);

const mallStockPagination: TablePaginationConfig = {
  defaultPageSize: 10,
  hideOnSinglePage: false,
  pageSizeOptions: ['10', '20', '50', '100'],
  position: ['bottomRight'],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 个仓库`,
  size: 'small',
};

const mallStockTableScroll = {
  x: '100%',
  y: 'max(320px, calc(100vh - 520px))',
} as const;

const mallStockColumns: TableColumnsType<ErpStockApi.MallWarehouseStock> = [
  { title: '仓库名称', dataIndex: 'warehouseName', width: 180 },
  { title: '仓库部门', dataIndex: 'deptName', width: 150 },
  { title: '当前库存', dataIndex: 'count', width: 110, align: 'right' },
  { title: '锁定库存', dataIndex: 'lockCount', width: 110, align: 'right' },
  { title: '占用库存', dataIndex: 'occupiedCount', width: 110, align: 'right' },
  {
    title: '待入库存',
    dataIndex: 'pendingInCount',
    width: 110,
    align: 'right',
  },
  {
    title: '在途库存',
    dataIndex: 'inTransitCount',
    width: 110,
    align: 'right',
  },
  {
    title: '可用库存',
    dataIndex: 'availableCount',
    width: 120,
    align: 'right',
  },
  { title: '货架位', dataIndex: 'shelf', width: 160 },
];

const [InfoForm, infoFormApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: useInfoFormSchema(),
  showDefaultActions: false,
});

const [DeliveryForm, deliveryFormApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: useDeliveryFormSchema(),
  showDefaultActions: false,
});

const [DescriptionForm, descriptionFormApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'vertical',
  schema: useDescriptionFormSchema(),
  showDefaultActions: false,
});

const [PartsParamForm, partsParamFormApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: usePartsParamFormSchema(),
  showDefaultActions: false,
});

const [OtherForm, otherFormApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: useOtherFormSchema(),
  showDefaultActions: false,
});

/** tab 切换 */
function handleTabChange(key: number | string) {
  activeTabName.value = String(key);
}

function setFormsDisabled(disabled: boolean) {
  infoFormApi.setDisabled(disabled);
  deliveryFormApi.setDisabled(disabled);
  descriptionFormApi.setDisabled(disabled);
  partsParamFormApi.setDisabled(disabled);
  otherFormApi.setDisabled(disabled);
}

function updateInfoFormSchema() {
  infoFormApi.updateSchema(
    useInfoFormSchema({ retailPriceDisabled: retailPriceDisabled.value }),
  );
}

/** 提交表单 */
async function handleSubmit() {
  const values: MallSpuApi.Spu = await infoFormApi
    .merge(deliveryFormApi)
    .merge(descriptionFormApi)
    .merge(otherFormApi)
    .submitAllForm(true);
  const submitValues = cloneDeep(values);
  if (spuId.value) {
    submitValues.id = spuId.value;
  }
  submitValues.specType = false;
  submitValues.subCommissionType = false;
  submitValues.skus = buildHiddenSkuList(submitValues, formData.value.skus);
  const retailPrice = Number(convertToInteger(submitValues.price ?? 0));
  // 校验商品名称不能为空（用于 SKU name）
  if (!submitValues.name || submitValues.name.trim() === '') {
    message.error('商品名称不能为空');
    return false;
  }
  if (submitValues.skus) {
    submitValues.skus.forEach((item) => {
      // 给 sku name 赋值（使用商品名称作为 SKU 名称）
      item.name = submitValues.name;
      // 金额转换：元转分
      item.price = convertToInteger(item.price);
      item.marketPrice = convertToInteger(item.marketPrice);
      item.costPrice = convertToInteger(item.costPrice);
      item.firstBrokeragePrice = convertToInteger(item.firstBrokeragePrice);
      item.secondBrokeragePrice = convertToInteger(item.secondBrokeragePrice);
    });
  }
  // 处理轮播图列表：上传组件可能返回对象或字符串，统一处理成字符串数组
  const newSliderPicUrls: any[] = [];
  submitValues.sliderPicUrls!.forEach((item: any) => {
    // 如果是前端选的图
    typeof item === 'object'
      ? newSliderPicUrls.push(item.url)
      : newSliderPicUrls.push(item);
  });
  submitValues.sliderPicUrls = newSliderPicUrls;

  // 提交数据
  if (spuId.value) {
    await updateSpu(submitValues);
    if (canSyncRetailPrice.value) {
      await updateRetailPrice({ id: spuId.value, price: retailPrice });
    }
  } else {
    await createSpu(submitValues);
  }
  return true;
}

function buildHiddenSkuList(
  submitValues: MallSpuApi.Spu,
  currentSkus?: MallSpuApi.Sku[],
) {
  const defaultSku = createDefaultFormData().skus?.[0] as MallSpuApi.Sku;
  const sku = cloneDeep(currentSkus?.[0] ?? defaultSku) as MallSpuApi.Sku;
  return [
    {
      ...sku,
      barCode: sku.barCode || '',
      costPrice: sku.costPrice ?? 0,
      firstBrokeragePrice: 0,
      marketPrice: sku.marketPrice ?? 0,
      name: submitValues.name || '',
      picUrl: sku.picUrl || submitValues.picUrl || '',
      price: submitValues.price ?? sku.price ?? 0,
      secondBrokeragePrice: 0,
      stock: sku.stock ?? 0,
      volume: sku.volume ?? 0,
      weight: sku.weight ?? 0,
    },
  ];
}

/** 获得详情 */
async function getDetail() {
  formLoading.value = true;
  try {
    const res = await getSpu(spuId.value!);
    const retailPrice = res.price ?? res.skus?.[0]?.price ?? 0;
    // 金额转换：分转元
    res.skus?.forEach((item) => {
      item.price = formatToFraction(item.price);
      item.marketPrice = formatToFraction(item.marketPrice);
      item.costPrice = formatToFraction(item.costPrice);
      item.firstBrokeragePrice = formatToFraction(item.firstBrokeragePrice);
      item.secondBrokeragePrice = formatToFraction(item.secondBrokeragePrice);
    });
    res.price = formatToFraction(retailPrice) as unknown as number;
    formData.value = res;
    await nextTick();
    // 初始化各表单值
    await Promise.all([
      infoFormApi.setValues(res),
      deliveryFormApi.setValues(res),
      descriptionFormApi.setValues(res),
      partsParamFormApi.setValues(buildPartsParamValues(res)),
      otherFormApi.setValues(res),
    ]);
    setFormsDisabled(isDetail.value);
    await nextTick();
    await nextTick();
    await loadMallStockSummary();
    updateInfoFormSchema();
  } finally {
    formLoading.value = false;
  }
}

async function loadMallStockSummary() {
  mallStockSummary.value = undefined;
  mallStockSummaryError.value = false;
  if (!spuId.value) {
    return;
  }
  mallStockSummaryLoading.value = true;
  try {
    mallStockSummary.value = await getMallStockSummary(spuId.value);
  } catch {
    mallStockSummaryError.value = true;
  } finally {
    mallStockSummaryLoading.value = false;
  }
}

async function resetFormState() {
  spuId.value = undefined;
  formType.value = 'create';
  activeTabName.value = 'info';
  formLoading.value = false;
  formData.value = createDefaultFormData();
  mallStockSummary.value = undefined;
  mallStockSummaryLoading.value = false;
  mallStockSummaryError.value = false;
  setFormsDisabled(false);
  updateInfoFormSchema();
  await nextTick();
  await Promise.all([
    infoFormApi.resetForm(),
    deliveryFormApi.resetForm(),
    descriptionFormApi.resetForm(),
    partsParamFormApi.resetForm(),
    otherFormApi.resetForm(),
  ]);
  await partsParamFormApi.setValues(buildPartsParamValues(formData.value));
}

async function openForm(data?: { id?: number; type?: FormType }) {
  await resetFormState();
  formType.value = data?.type ?? (data?.id ? 'edit' : 'create');
  spuId.value = data?.id;
  updateInfoFormSchema();
  setFormsDisabled(isDetail.value);

  if (!spuId.value) {
    return;
  }

  await getDetail();
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value) {
    return;
  }
  formType.value = 'edit';
  updateInfoFormSchema();
  setFormsDisabled(false);
}

async function handleLegacyRouteClosed() {
  if (!isLegacyRoute.value) {
    return;
  }
  await closeCurrentTab();
  if (legacyRouteNameSet.has(String(route.name || ''))) {
    await router.replace('/mall/product/spu');
  }
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!canSubmit.value) {
      return;
    }
    modalApi.lock();
    try {
      const submitted = await handleSubmit();
      if (!submitted) {
        return;
      }
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      await resetFormState();
      await handleLegacyRouteClosed();
      return;
    }
    modalApi.setState({ fullscreen: true });
    await openForm(modalApi.getData<{ id?: number; type?: FormType }>());
  },
});

/** 初始化 */
onMounted(async () => {
  if (!isLegacyRoute.value) {
    return;
  }
  const routeTypeMap: Record<string, FormType> = {
    ProductSpuAdd: 'create',
    ProductSpuDetail: 'detail',
    ProductSpuEdit: 'edit',
  };
  modalApi
    .setData({
      id: route.params.id ? Number(route.params.id) : undefined,
      type: routeTypeMap[String(route.name || '')] ?? 'create',
    })
    .open();
});
</script>

<template>
  <div>
    <Modal
      :title="modalTitle"
      class="!w-full"
      bordered
      content-class="p-0"
      :show-confirm-button="canSubmit"
    >
      <div class="mall-spu-form-view" :class="{ 'is-detail': isDetail }">
        <div v-if="formLoading" class="mall-spu-form-load-state">
          正在加载商品信息，请稍候...
        </div>
        <Tabs
          v-show="!formLoading"
          :active-key="activeTabName"
          class="mall-spu-form-tabs"
          :destroy-inactive-tab-pane="false"
          @change="handleTabChange"
        >
          <Tabs.TabPane key="info" tab="基础设置" force-render>
            <section class="mall-spu-form-section">
              <header class="mall-spu-form-section__header">
                <span class="mall-spu-form-section__title">基础设置</span>
              </header>
              <InfoForm class="mall-spu-edit-form" />
            </section>
          </Tabs.TabPane>
          <Tabs.TabPane v-if="spuId" key="sku" tab="ERP库存" force-render>
            <section class="mall-spu-form-section mall-spu-erp-stock-section">
              <header class="mall-spu-form-section__header">
                <span class="mall-spu-form-section__title">ERP库存</span>
              </header>
              <Alert
                class="mall-spu-erp-stock-summary"
                :class="mallStockSummaryStatus"
                :message="mallStockSummaryText"
                show-icon
                :type="
                  mallStockSummaryError
                    ? 'error'
                    : mallStockSummary?.mapped === false
                      ? 'warning'
                      : 'success'
                "
              />
              <div class="mall-spu-stock-cards">
                <div
                  v-for="item in mallStockCards"
                  :key="item.label"
                  class="mall-spu-stock-card"
                  :class="{ 'is-primary': item.primary }"
                >
                  <span class="mall-spu-stock-card__label">
                    {{ item.label }}
                  </span>
                  <strong class="mall-spu-stock-card__value">
                    {{ formatStockCount(item.value) }}
                  </strong>
                </div>
              </div>
              <Table
                v-if="mallStockRows.length > 0 || mallStockSummaryLoading"
                class="mall-spu-stock-table"
                :columns="mallStockColumns"
                :data-source="mallStockRows"
                :loading="mallStockSummaryLoading"
                :pagination="mallStockPagination"
                :row-key="(row) => row.warehouseId"
                :scroll="mallStockTableScroll"
                bordered
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template
                    v-if="
                      [
                        'count',
                        'lockCount',
                        'occupiedCount',
                        'pendingInCount',
                        'inTransitCount',
                        'availableCount',
                      ].includes(column.dataIndex as string)
                    "
                  >
                    {{ formatMallStockCell(record, column.dataIndex) }}
                  </template>
                  <template
                    v-else-if="
                      ['warehouseName', 'deptName', 'shelf'].includes(
                        column.dataIndex as string,
                      )
                    "
                  >
                    {{ formatMallTextCell(record, column.dataIndex) }}
                  </template>
                </template>
              </Table>
              <Empty
                v-else
                class="mall-spu-stock-empty"
                description="暂无 ERP 仓库库存"
              />
            </section>
          </Tabs.TabPane>
          <Tabs.TabPane key="delivery" tab="物流设置" force-render>
            <section class="mall-spu-form-section">
              <header class="mall-spu-form-section__header">
                <span class="mall-spu-form-section__title">物流设置</span>
              </header>
              <DeliveryForm class="mall-spu-edit-form" />
            </section>
          </Tabs.TabPane>
          <Tabs.TabPane key="description" tab="商品详情" force-render>
            <section class="mall-spu-form-section">
              <header class="mall-spu-form-section__header">
                <span class="mall-spu-form-section__title">商品详情</span>
              </header>
              <DescriptionForm class="mall-spu-edit-form" />
            </section>
          </Tabs.TabPane>
          <Tabs.TabPane key="partsParam" tab="配件参数" force-render>
            <section class="mall-spu-form-section">
              <header class="mall-spu-form-section__header">
                <span class="mall-spu-form-section__title">配件参数</span>
              </header>
              <PartsParamForm class="mall-spu-edit-form" />
            </section>
          </Tabs.TabPane>
          <Tabs.TabPane key="other" tab="其它设置" force-render>
            <section class="mall-spu-form-section">
              <header class="mall-spu-form-section__header">
                <span class="mall-spu-form-section__title">其它设置</span>
              </header>
              <OtherForm class="mall-spu-edit-form" />
            </section>
          </Tabs.TabPane>
        </Tabs>
      </div>
      <template #cancelText>
        {{ isDetail ? '关闭' : '取消' }}
      </template>
      <template #prepend-footer>
        <Button
          v-if="canEditFromDetail"
          type="primary"
          @click="handleEditFromDetail"
        >
          编辑
        </Button>
      </template>
    </Modal>
  </div>
</template>
<style lang="scss" scoped>
.mall-spu-form-tabs :deep(.ant-tabs-nav) {
  margin: 0;
  padding: 0 12px;
  background: hsl(var(--card));
}

.mall-spu-form-tabs :deep(.ant-tabs-tab) {
  padding: 10px 0;
  font-size: 12px;
}

.mall-spu-form-tabs :deep(.ant-tabs-tab-btn) {
  font-size: 12px !important;
}

.mall-spu-form-view {
  min-height: calc(100vh - 190px);
  padding: 12px;
  overflow: auto;
  background: hsl(var(--muted) / 45%);
}

.mall-spu-form-load-state {
  display: flex;
  min-height: 240px;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.mall-spu-form-section {
  min-height: calc(100vh - 250px);
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
}

.mall-spu-form-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.mall-spu-form-section__title {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.mall-spu-erp-stock-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.mall-spu-erp-stock-summary {
  width: 100%;
  margin-bottom: 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 20px;
}

.mall-spu-erp-stock-summary.is-mapped {
  border-color: hsl(var(--success) / 35%);
  background: hsl(var(--success) / 8%);
}

.mall-spu-erp-stock-summary.is-unmapped,
.mall-spu-erp-stock-summary.is-loading {
  border-color: hsl(var(--warning) / 35%);
  background: hsl(var(--warning) / 8%);
}

.mall-spu-erp-stock-summary.is-error {
  border-color: hsl(var(--destructive) / 35%);
  background: hsl(var(--destructive) / 8%);
}

.mall-spu-stock-cards {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.mall-spu-stock-card {
  min-height: 54px;
  padding: 8px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--muted) / 28%);
}

.mall-spu-stock-card.is-primary {
  border-color: hsl(var(--success) / 35%);
  background: hsl(var(--success) / 8%);
}

.mall-spu-stock-card__label {
  display: block;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
}

.mall-spu-stock-card__value {
  display: block;
  margin-top: 4px;
  color: hsl(var(--foreground));
  font-size: 17px;
  line-height: 22px;
}

.mall-spu-stock-table {
  width: 100%;
  min-width: 0;
}

.mall-spu-stock-table :deep(.ant-table-container table) {
  width: 100% !important;
  min-width: 1160px;
}

.mall-spu-stock-table :deep(.ant-pagination) {
  margin: 12px 0 0;
}

.mall-spu-stock-empty {
  width: 100%;
  padding: 48px 0;
  border: 1px dashed hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--muted) / 20%);
}

.mall-spu-edit-form {
  width: min(100%, 980px);
}

.mall-spu-edit-form :deep(.ant-form-item) {
  margin-bottom: 12px;
  font-size: 12px;
}

.mall-spu-edit-form :deep(.ant-form-item-label > label),
.mall-spu-edit-form :deep(.ant-input),
.mall-spu-edit-form :deep(.ant-input-number-input),
.mall-spu-edit-form :deep(.ant-select-selection-item),
.mall-spu-edit-form :deep(.ant-picker-input > input),
.mall-spu-edit-form :deep(.ant-radio-wrapper),
.mall-spu-edit-form :deep(.ant-checkbox-wrapper) {
  font-size: 12px;
}

.mall-spu-edit-form :deep(.ant-input),
.mall-spu-edit-form :deep(.ant-input-affix-wrapper),
.mall-spu-edit-form :deep(.ant-input-number),
.mall-spu-edit-form :deep(.ant-picker),
.mall-spu-edit-form :deep(.ant-select-selector),
.mall-spu-form-section :deep(.ant-btn) {
  min-height: 28px;
  font-size: 12px;
}

.mall-spu-form-section :deep(.vxe-table--render-default) {
  font-size: 12px;
}

.mall-spu-form-section :deep(.ant-table) {
  width: min(100%, 1160px);
  font-size: 12px;
}

@media (max-width: 1024px) {
  .mall-spu-edit-form {
    width: 100%;
  }

  .mall-spu-stock-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
