<script lang="ts" setup>
import type { ProductQuickCreatePayload } from '../data';

import type { ErpProductBrandApi } from '#/api/erp/product/brand';
import type { ErpProductCategoryApi } from '#/api/erp/product/category';
import type { ErpProductApi } from '#/api/erp/product/product';
import type { ErpProductUnitApi } from '#/api/erp/product/unit';
import type { ErpWarehouseApi } from '#/api/erp/stock/warehouse';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { message, Tabs } from 'ant-design-vue';

import {
  createProduct,
  getProductDetail,
  updateProduct,
} from '#/api/erp/product/product';
import { getConfigKey } from '#/api/infra/config';
import { $t } from '#/locales';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import BrandForm from '#/views/erp/product/brand/modules/form.vue';
import CategoryForm from '#/views/erp/product/category/modules/form.vue';
import UnitForm from '#/views/erp/product/unit/modules/form.vue';
import WarehouseForm from '#/views/erp/stock/warehouse/modules/form.vue';

import {
  normalizeProductDeptValues,
  normalizeProductNumberValues,
  normalizeProductTextValues,
} from '../data';
import { flattenCustomFields, mergeCustomFields } from '../utils/custom-fields';
import BaseInfo from './tabs/base-info.vue';
import DetailInfo from './tabs/detail-info.vue';
import ExtendInfo from './tabs/extend-info.vue';
import ImageInfo from './tabs/image-info.vue';
import PriceInfo from './tabs/price-info.vue';
import StockDistribution from './tabs/stock-distribution.vue';
import StockInfo from './tabs/stock-info.vue';
import UniversalInfo from './tabs/universal-info.vue';

const emit = defineEmits(['success']);

const formType = ref<'create' | 'detail' | 'edit'>('create');
const formData = ref<ErpProductApi.Product>({} as ErpProductApi.Product);
const detailLoading = ref(false);
const detailLoadError = ref('');
const activeTabKey = ref('base');
let detailLoadSequence = 0;
const userStore = useUserStore();
const quickCreateContext = ref<ProductQuickCreatePayload>();

const baseRef = ref<InstanceType<typeof BaseInfo>>();
const priceRef = ref<InstanceType<typeof PriceInfo>>();
const extendRef = ref<InstanceType<typeof ExtendInfo>>();
const stockInfoRef = ref<InstanceType<typeof StockInfo>>();

const mainImage = ref('');
const detailContent = ref('');
const universals = ref<ErpProductApi.ProductUniversal[]>([]);

const getTitle = computed(() => {
  if (formData.value.readonlyBySaleDistribution) {
    return '配件信息详情（销售仓只读）';
  }
  if (formType.value === 'detail') {
    return '配件信息详情';
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['配件信息']);
  }
  return $t('ui.actionTitle.create', ['配件信息']);
});
const isDetail = computed(() => formType.value === 'detail');
const isReadonlyBySaleDistribution = computed(
  () => formData.value.readonlyBySaleDistribution === true,
);
const isReadonly = computed(
  () => isDetail.value || isReadonlyBySaleDistribution.value,
);

function handleCreateWarehouse() {
  handleQuickCreate({
    fieldName: 'defaultWarehouseId',
    target: 'warehouse',
    title: '默认仓库',
  });
}

function handleQuickCreate(payload: ProductQuickCreatePayload) {
  if (isReadonly.value) {
    return;
  }
  quickCreateContext.value = payload;
  if (payload.target === 'unit') {
    unitModalApi.setData({}).open();
    return;
  }
  if (payload.target === 'brand') {
    brandModalApi.setData({}).open();
    return;
  }
  if (payload.target === 'category') {
    categoryModalApi.setData({ parentId: 0 }).open();
    return;
  }
  warehouseModalApi.setData({ type: 'create' }).open();
}

async function handleQuickCreated(
  record?:
    | ErpProductBrandApi.ProductBrand
    | ErpProductCategoryApi.ProductCategory
    | ErpProductUnitApi.ProductUnit
    | ErpWarehouseApi.Warehouse,
) {
  const context = quickCreateContext.value;
  if (!context) {
    return;
  }

  if (context.target === 'warehouse' && record?.id) {
    const warehouse = record as ErpWarehouseApi.Warehouse;
    formData.value = {
      ...formData.value,
      defaultWarehouseId: warehouse.id,
      defaultWarehouseName: warehouse.name,
    };
  }
  baseRef.value?.refreshFieldOptions(context.fieldName);
  if (context.target === 'brand' && record?.name) {
    await baseRef.value?.setFieldValue(context.fieldName, record.name);
  } else if (record?.id) {
    await baseRef.value?.setFieldValue(context.fieldName, record.id);
  }
  quickCreateContext.value = undefined;
}

function setFormDisabled(disabled: boolean) {
  baseRef.value?.setDisabled(disabled);
  priceRef.value?.setDisabled(disabled);
  extendRef.value?.setDisabled(disabled);
}

function reset() {
  detailLoadSequence += 1;
  formType.value = 'create';
  formData.value = {} as ErpProductApi.Product;
  void baseRef.value?.resetForm?.();
  void priceRef.value?.resetForm?.();
  void extendRef.value?.resetForm?.();
  detailLoading.value = false;
  detailLoadError.value = '';
  activeTabKey.value = 'base';
  mainImage.value = '';
  detailContent.value = '';
  universals.value = [];
}

async function reloadDetail(id = formData.value.id, sequence?: number) {
  if (!id) {
    return false;
  }
  const detail = await getProductDetail(id);
  if (sequence !== undefined && sequence !== detailLoadSequence) {
    return false;
  }
  formData.value = detail;
  mainImage.value = detail.mainImage ?? '';
  detailContent.value = detail.detailContent ?? '';
  universals.value = detail.universals ?? [];
  const flattenedDetail = flattenCustomFields(detail);
  await nextTick();
  await baseRef.value?.setValues(flattenedDetail);
  await priceRef.value?.setValues(flattenedDetail);
  await extendRef.value?.setValues(flattenedDetail);
  baseRef.value?.refreshDefaultWarehouseOptions();
  return true;
}

async function handleStockDistributionSuccess() {
  await reloadDetail();
  await stockInfoRef.value?.reload?.();
  emit('success');
}

const [WarehouseModal, warehouseModalApi] = useVbenModal({
  connectedComponent: WarehouseForm,
  destroyOnClose: true,
});

const [UnitModal, unitModalApi] = useVbenModal({
  connectedComponent: UnitForm,
  destroyOnClose: true,
});

const [BrandModal, brandModalApi] = useVbenModal({
  connectedComponent: BrandForm,
  destroyOnClose: true,
});

const [CategoryModal, categoryModalApi] = useVbenModal({
  connectedComponent: CategoryForm,
  destroyOnClose: true,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (isReadonly.value) {
      return;
    }

    const valid = await baseRef.value?.validate();
    if (!valid) {
      activeTabKey.value = 'base';
      return;
    }
    if (formType.value !== 'create') {
      const priceValid = await priceRef.value?.validate();
      if (!priceValid) {
        activeTabKey.value = 'price';
        return;
      }
    }
    const extendValid = await extendRef.value?.validate();
    if (!extendValid) {
      activeTabKey.value = 'extend';
      return;
    }

    const base = (await baseRef.value?.getValues()) ?? {};
    const price = (await priceRef.value?.getValues()) ?? {};
    const extend = (await extendRef.value?.getValues()) ?? {};
    const payload = mergeCustomFields(
      normalizeProductDeptValues(
        normalizeProductTextValues(
          normalizeProductNumberValues({
            ...formData.value,
            ...base,
            ...price,
            ...extend,
            mainImage: mainImage.value,
            detailContent: detailContent.value,
            universals: universals.value ?? [],
          } as ErpProductApi.Product & Record<string, any>),
        ),
      ),
    );
    delete payload.lastPurchasePrice;

    modalApi.lock();
    try {
      await (payload.id ? updateProduct(payload) : createProduct(payload));
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      reset();
      quickCreateContext.value = undefined;
      return;
    }

    const data = modalApi.getData<{
      id?: number;
      readonlyBySaleDistribution?: boolean;
      type?: 'create' | 'detail' | 'edit';
    }>();
    formType.value = data?.type ?? 'create';
    detailLoadError.value = '';
    activeTabKey.value = 'base';
    modalApi.setState({ fullscreen: true });
    if (data?.readonlyBySaleDistribution) {
      formData.value = {
        readonlyBySaleDistribution: true,
      } as ErpProductApi.Product;
    }

    await nextTick();
    setFormDisabled(isReadonly.value);

    if (!data?.id) {
      let codeMode = 'AUTO';
      try {
        const configValue = await getConfigKey('erp.product.code-mode');
        if (configValue?.toUpperCase?.() === 'MANUAL') {
          codeMode = 'MANUAL';
        }
      } catch {
        // ignore and fallback to AUTO
      }
      await baseRef.value?.setValues({
        codeMode,
        manualInputCode: codeMode === 'MANUAL',
        deptId: userStore.userInfo?.deptId,
        deptIds: userStore.userInfo?.deptId ? [userStore.userInfo.deptId] : [],
      });
      return;
    }

    const sequence = ++detailLoadSequence;
    detailLoading.value = true;
    modalApi.lock();
    try {
      const loaded = await reloadDetail(data.id, sequence);
      if (!loaded) {
        return;
      }
      await Promise.all([
        baseRef.value?.refreshSchema(),
        priceRef.value?.refreshSchema(),
        extendRef.value?.refreshSchema(),
      ]);
      setFormDisabled(isReadonly.value);
    } catch {
      if (sequence === detailLoadSequence) {
        detailLoadError.value = '配件信息加载失败，请关闭后重试';
      }
    } finally {
      if (sequence === detailLoadSequence) {
        detailLoading.value = false;
      }
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="!isReadonly && !detailLoading && !detailLoadError"
  >
    <UnitModal @success="handleQuickCreated" />
    <BrandModal @success="handleQuickCreated" />
    <CategoryModal @success="handleQuickCreated" />
    <WarehouseModal @success="handleQuickCreated" />

    <div
      v-if="formType === 'create'"
      class="product-form-view product-form-view--editable product-create-layout"
    >
      <section class="product-create-card">
        <header class="product-create-card__header">
          <span class="product-create-card__title">新增配件资料</span>
        </header>
        <Tabs
          v-model:active-key="activeTabKey"
          class="product-form-tabs product-create-tabs"
          :destroy-inactive-tab-pane="false"
        >
          <Tabs.TabPane key="base" tab="配件信息" force-render>
            <BaseInfo
              ref="baseRef"
              class="product-edit-form"
              :on-create-warehouse="handleCreateWarehouse"
              :on-quick-create="handleQuickCreate"
              :value="formData"
            />
          </Tabs.TabPane>
          <Tabs.TabPane key="extend" tab="拓展信息" force-render>
            <ExtendInfo ref="extendRef" class="product-edit-form" />
          </Tabs.TabPane>
        </Tabs>
      </section>
    </div>

    <div
      v-else
      class="product-form-view"
      :class="{ 'product-form-view--editable': !isReadonly }"
    >
      <div v-if="detailLoading" class="product-detail-load-state">
        正在加载完整配件信息，请稍候…
      </div>
      <div
        v-else-if="detailLoadError"
        class="product-detail-load-state is-error"
      >
        {{ detailLoadError }}
      </div>

      <div
        v-show="!detailLoading && !detailLoadError"
        class="product-detail-layout"
      >
        <section class="product-detail-card">
          <Tabs
            v-model:active-key="activeTabKey"
            class="product-form-tabs product-detail-tabs"
            :destroy-inactive-tab-pane="false"
          >
            <Tabs.TabPane key="base" tab="配件信息" force-render>
              <BaseInfo
                ref="baseRef"
                class="product-edit-form"
                :on-create-warehouse="handleCreateWarehouse"
                :on-quick-create="handleQuickCreate"
                :readonly="isReadonly"
                :value="formData"
              />
            </Tabs.TabPane>

            <Tabs.TabPane key="price" tab="价格信息" force-render>
              <PriceInfo ref="priceRef" class="product-edit-form" />
            </Tabs.TabPane>

            <Tabs.TabPane key="extend" tab="拓展信息" force-render>
              <ExtendInfo ref="extendRef" class="product-edit-form" />
            </Tabs.TabPane>

            <Tabs.TabPane key="image" tab="配件图片" force-render>
              <div class="product-section-content">
                <ImageInfo
                  v-model:model-value="mainImage"
                  :disabled="isReadonly"
                />
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane key="detail" tab="配件详情" force-render>
              <div class="product-section-content">
                <DetailInfo
                  v-model:model-value="detailContent"
                  :disabled="isReadonly"
                />
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane
              v-if="!isReadonlyBySaleDistribution"
              key="distribution"
              tab="库存分发"
              force-render
            >
              <div class="product-section-content">
                <StockDistribution
                  :readonly="isReadonly"
                  :value="formData"
                  @success="handleStockDistributionSuccess"
                />
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane
              v-if="!isReadonlyBySaleDistribution"
              key="stock"
              tab="库存信息"
              force-render
            >
              <div class="product-section-content">
                <StockInfo ref="stockInfoRef" :value="formData" />
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane key="universal" tab="通用件" force-render>
              <div class="product-section-content">
                <UniversalInfo
                  v-model:model-value="universals"
                  :disabled="isReadonly"
                />
              </div>
            </Tabs.TabPane>
          </Tabs>
        </section>

        <section class="product-detail-card product-detail-audit">
          <header class="product-detail-audit__header">
            <span class="product-detail-audit__title">审计信息</span>
          </header>
          <ErpAuditInfo
            :department-keys="['createDeptName', 'createDeptId']"
            department-label="创建部门"
            title=""
            :record="formData"
          />
        </section>
      </div>
    </div>

    <template #cancelText>
      {{ isReadonly ? '关闭' : '取消' }}
    </template>
  </Modal>
</template>

<style scoped>
.product-form-view {
  min-height: calc(100vh - 142px);
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.product-create-card,
.product-detail-card {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.product-create-card__header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.product-create-card__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.product-create-card__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.product-form-tabs {
  font-size: 12px;
}

.product-form-tabs :deep(.ant-tabs-nav) {
  padding: 0 12px;
  margin: 0;
  background: hsl(var(--muted) / 18%);
}

.product-form-tabs :deep(.ant-tabs-tab) {
  padding: 10px 0;
  font-size: 12px;
}

.product-form-tabs :deep(.ant-tabs-tab-btn),
.product-form-tabs :deep(.ant-btn),
.product-form-tabs :deep(.ant-form),
.product-form-tabs :deep(.ant-table),
.product-form-tabs :deep(.ant-empty),
.product-form-tabs :deep(.vxe-table--render-default) {
  font-size: 12px;
}

.product-form-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  font-weight: 600;
}

.product-detail-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.product-detail-load-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.product-detail-load-state.is-error {
  color: hsl(var(--destructive));
}

.product-edit-form {
  margin: 0 !important;
}

.product-edit-form :deep(.product-form-grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 12px;
  padding: 10px 12px 12px;
}

.product-edit-form :deep(.product-form-grid > div) {
  min-width: 0;
}

.product-edit-form :deep(.product-form-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.product-edit-form :deep(.product-form-grid > div > .flex-auto) {
  min-width: 0;
}

.product-edit-form :deep(.ant-input),
.product-edit-form :deep(.ant-input-affix-wrapper),
.product-edit-form :deep(.ant-input-number),
.product-edit-form :deep(.ant-picker),
.product-edit-form :deep(.ant-select-selector),
.product-edit-form :deep(.ant-tree-select .ant-select-selector) {
  min-height: 32px;
  font-size: 12px;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.product-form-view--editable .product-edit-form :deep(.ant-input),
.product-form-view--editable .product-edit-form :deep(.ant-input-affix-wrapper),
.product-form-view--editable .product-edit-form :deep(.ant-input-number),
.product-form-view--editable .product-edit-form :deep(.ant-picker),
.product-form-view--editable .product-edit-form :deep(.ant-select-selector) {
  background: hsl(var(--card)) !important;
}

.product-edit-form :deep(.ant-input),
.product-edit-form :deep(.ant-picker-input > input),
.product-edit-form :deep(.ant-select-selection-item),
.product-edit-form :deep(.ant-select-selection-placeholder),
.product-edit-form :deep(.ant-radio-wrapper),
.product-edit-form :deep(.ant-radio-button-wrapper),
.product-edit-form :deep(.ant-checkbox-wrapper) {
  font-size: 12px;
}

.product-edit-form :deep(.ant-input:not(textarea)),
.product-edit-form :deep(.ant-picker) {
  height: 32px;
}

.product-edit-form :deep(.ant-select-single) {
  height: 32px;
}

.product-edit-form :deep(.ant-input[disabled]),
.product-edit-form :deep(.ant-input-affix-wrapper-disabled),
.product-edit-form :deep(.ant-input-number-disabled),
.product-edit-form :deep(.ant-picker-disabled),
.product-edit-form :deep(.ant-select-disabled .ant-select-selector),
.product-edit-form :deep(textarea:disabled) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.product-section-content {
  padding: 10px 12px 12px;
}

.product-section-content :deep(> .mx-2) {
  margin-right: 0;
  margin-left: 0;
}

.product-detail-audit__header {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  background: hsl(var(--muted) / 18%);
  border-bottom: 1px solid hsl(var(--border));
}

.product-detail-audit__title {
  position: relative;
  padding-left: 10px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.product-detail-audit__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.product-detail-audit :deep(.erp-audit-info) {
  padding: 12px;
}

.product-detail-audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.product-detail-audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.product-form-select-dropdown .ant-select-item),
:global(.product-form-select-dropdown .ant-select-tree),
:global(.product-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 1279px) {
  .product-edit-form :deep(.product-form-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .product-form-view {
    padding: 8px;
  }

  .product-edit-form :deep(.product-form-grid) {
    grid-template-columns: minmax(0, 1fr);
  }

  .product-section-content {
    padding: 8px;
  }
}
</style>
