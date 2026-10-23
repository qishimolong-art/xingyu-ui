<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import {
  batchAdjustPrice,
  batchUpdateStockLimits,
} from '#/api/erp/parts/price-adjust';
import { getProductCategorySimpleList } from '#/api/erp/product/category';
import { getPurchaseWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { useFieldPermission } from '#/composables/useFieldPermission';
import SupplierLazySelect from '#/views/erp/purchase/components/SupplierLazySelect.vue';
import { filterErpBusinessPartnerOption } from '#/views/erp/utils/business-partner-select';

import {
  adjustMethodOptions,
  decimalPlacesOptions,
  filterPriceTypeOptions,
  getPreferredVisiblePriceType,
  sourcePriceTypeOptions,
  targetPriceTypeOptions,
} from './data';

defineOptions({ name: 'ErpPurchasePriceAdjustModal' });

const emit = defineEmits<{ success: [] }>();
const {
  hiddenFields,
  loadHiddenFields,
  loaded: hiddenFieldsLoaded,
} = useFieldPermission('erp_product');

const passwordModalVisible = ref(false);
const passwordInput = ref('');
const passwordError = ref('');
const executingPrice = ref(false);
const executingStock = ref(false);
const optionsLoading = ref(false);

const filter = reactive({
  code: '',
  name: '',
  categoryId: undefined as number | undefined,
  vehicleModel: '',
  supplierId: undefined as number | undefined,
  originPlace: '',
  brand: '',
  warehouseId: undefined as number | undefined,
});

const priceForm = reactive({
  targetPriceType: 'RETAIL_PRICE' as string | undefined,
  sourcePriceType: 'REFERENCE_PRICE' as string | undefined,
  adjustMethod: 'MULTIPLY',
  adjustCoefficient: 1.2,
  decimalPlaces: 2,
});

const stockForm = reactive({
  stockMax: undefined as number | undefined,
  stockMin: undefined as number | undefined,
  stockStandard: undefined as number | undefined,
});

const visibleTargetPriceTypeOptions = computed(() =>
  filterPriceTypeOptions(targetPriceTypeOptions, hiddenFields.value),
);
const visibleSourcePriceTypeOptions = computed(() =>
  filterPriceTypeOptions(sourcePriceTypeOptions, hiddenFields.value),
);
const noVisiblePriceTypeOptions = computed(
  () =>
    hiddenFieldsLoaded.value &&
    (!visibleTargetPriceTypeOptions.value.length ||
      !visibleSourcePriceTypeOptions.value.length),
);

const pricePreview = computed(() => {
  if (noVisiblePriceTypeOptions.value) {
    return '当前账号没有可用的价格字段权限';
  }
  if (!priceForm.targetPriceType || !priceForm.sourcePriceType) {
    return '请选择目标价格和数据源';
  }
  const target =
    visibleTargetPriceTypeOptions.value.find(
      (option) => option.value === priceForm.targetPriceType,
    )?.label ?? '请选择目标价格';
  const source =
    visibleSourcePriceTypeOptions.value.find(
      (option) => option.value === priceForm.sourcePriceType,
    )?.label ?? '请选择数据源';
  const methodSymbol: Record<string, string> = {
    ADD: '+',
    DIVIDE: '÷',
    MULTIPLY: '×',
    SUBTRACT: '-',
  };
  const symbol = methodSymbol[priceForm.adjustMethod] ?? priceForm.adjustMethod;
  return `${target} = round(${source} ${symbol} ${priceForm.adjustCoefficient}, ${priceForm.decimalPlaces})`;
});

const categoryOptions = ref<{ label: string; value: number }[]>([]);
const warehouseOptions = ref<{ label: string; value: number }[]>([]);

async function loadFilterOptions() {
  optionsLoading.value = true;
  try {
    const [categories, warehouses] = await Promise.all([
      getProductCategorySimpleList(),
      getPurchaseWarehouseSimpleList(),
    ]);
    categoryOptions.value = categories
      .filter((item) => item.id !== undefined && item.id !== null)
      .map((item) => ({ label: item.name, value: item.id! }));
    warehouseOptions.value = warehouses
      .filter((item) => item.id !== undefined && item.id !== null)
      .map((item) => ({ label: item.name, value: item.id! }));
  } finally {
    optionsLoading.value = false;
  }
}

void loadFilterOptions();

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen) {
    if (isOpen) {
      void loadHiddenFields();
      const data = modalApi.getData<{ initFilter?: Record<string, any> }>();
      if (data?.initFilter) {
        filter.code = data.initFilter.code ?? '';
        filter.name = data.initFilter.name ?? '';
      }
    } else {
      resetForm();
    }
  },
});

function resetForm() {
  Object.assign(filter, {
    brand: '',
    categoryId: undefined,
    code: '',
    name: '',
    originPlace: '',
    supplierId: undefined,
    vehicleModel: '',
    warehouseId: undefined,
  });
  Object.assign(priceForm, {
    adjustCoefficient: 1.2,
    adjustMethod: 'MULTIPLY',
    decimalPlaces: 2,
    sourcePriceType: getPreferredVisiblePriceType(
      sourcePriceTypeOptions,
      hiddenFields.value,
      'REFERENCE_PRICE',
    ),
    targetPriceType: getPreferredVisiblePriceType(
      targetPriceTypeOptions,
      hiddenFields.value,
      'RETAIL_PRICE',
    ),
  });
  Object.assign(stockForm, {
    stockMax: undefined,
    stockMin: undefined,
    stockStandard: undefined,
  });
  passwordInput.value = '';
  passwordError.value = '';
  passwordModalVisible.value = false;
}

function openStockPasswordModal() {
  if (
    stockForm.stockMax === undefined &&
    stockForm.stockMin === undefined &&
    stockForm.stockStandard === undefined
  ) {
    message.warning('请至少填写一项库存限制');
    return;
  }
  passwordInput.value = '';
  passwordError.value = '';
  passwordModalVisible.value = true;
}

function syncVisiblePriceTypes() {
  const targetFallback = getPreferredVisiblePriceType(
    targetPriceTypeOptions,
    hiddenFields.value,
    'RETAIL_PRICE',
  );
  const sourceFallback = getPreferredVisiblePriceType(
    sourcePriceTypeOptions,
    hiddenFields.value,
    'REFERENCE_PRICE',
  );
  if (
    !visibleTargetPriceTypeOptions.value.some(
      (option) => option.value === priceForm.targetPriceType,
    )
  ) {
    priceForm.targetPriceType = targetFallback;
  }
  if (
    !visibleSourcePriceTypeOptions.value.some(
      (option) => option.value === priceForm.sourcePriceType,
    )
  ) {
    priceForm.sourcePriceType = sourceFallback;
  }
}

async function handlePriceExecute() {
  if (!hiddenFieldsLoaded.value) {
    await loadHiddenFields();
  }
  syncVisiblePriceTypes();
  if (
    !visibleTargetPriceTypeOptions.value.length ||
    !visibleSourcePriceTypeOptions.value.length
  ) {
    message.warning('当前账号没有可用的价格字段权限');
    return;
  }
  if (!priceForm.targetPriceType || !priceForm.sourcePriceType) {
    message.warning('请选择目标价格和数据源');
    return;
  }
  if (
    priceForm.adjustMethod === 'DIVIDE' &&
    Number(priceForm.adjustCoefficient) === 0
  ) {
    message.warning('除法调整时系数不能为 0');
    return;
  }
  executingPrice.value = true;
  try {
    const count = await batchAdjustPrice({
      adjustCoefficient: priceForm.adjustCoefficient,
      adjustMethod: priceForm.adjustMethod,
      decimalPlaces: priceForm.decimalPlaces,
      filterCondition: buildFilter(),
      sourcePriceType: priceForm.sourcePriceType,
      targetPriceType: priceForm.targetPriceType,
    });
    message.success(`已成功调整 ${count} 条配件价格`);
    emit('success');
    modalApi.close();
  } finally {
    executingPrice.value = false;
  }
}

async function handlePasswordConfirm() {
  if (!passwordInput.value.trim()) {
    passwordError.value = '请输入调整口令';
    return;
  }
  executingStock.value = true;
  try {
    const count = await batchUpdateStockLimits({
      filterCondition: buildFilter(),
      password: passwordInput.value,
      stockMax: stockForm.stockMax,
      stockMin: stockForm.stockMin,
      stockStandard: stockForm.stockStandard,
    });
    passwordModalVisible.value = false;
    message.success(`已成功更新 ${count} 条配件库存限制`);
    emit('success');
    modalApi.close();
  } catch {
    passwordError.value = '口令错误，请重新输入';
    passwordInput.value = '';
  } finally {
    executingStock.value = false;
  }
}

function handlePasswordCancel() {
  passwordModalVisible.value = false;
}

function buildFilter() {
  return {
    brand: filter.brand || undefined,
    categoryId: filter.categoryId,
    code: filter.code || undefined,
    name: filter.name || undefined,
    originPlace: filter.originPlace || undefined,
    supplierId: filter.supplierId,
    vehicleModel: filter.vehicleModel || undefined,
    warehouseId: filter.warehouseId,
  };
}

watch(hiddenFields, syncVisiblePriceTypes, { immediate: true });
</script>

<template>
  <Modal
    title="批量调整配件价格/库存"
    :footer="false"
    class="!w-[1120px] max-w-[calc(100vw-32px)]"
  >
    <div class="parts-adjust-modal">
      <a-alert
        type="warning"
        show-icon
        message="请先确认筛选范围"
        description="价格与库存调整都会应用于符合下方全部条件的配件；未填写条件时将覆盖全部配件。"
      />

      <section class="parts-adjust-section">
        <header class="parts-adjust-section__header">
          <div>
            <div class="parts-adjust-section__title">筛选条件</div>
            <div class="parts-adjust-section__description">
              多个条件同时填写时按“且”匹配
            </div>
          </div>
        </header>

        <div class="parts-adjust-grid parts-adjust-grid--filter">
          <label class="parts-adjust-field">
            <span>编码</span>
            <a-input
              v-model:value="filter.code"
              placeholder="请输入配件编码"
              allow-clear
            />
          </label>
          <label class="parts-adjust-field">
            <span>配件名称</span>
            <a-input
              v-model:value="filter.name"
              placeholder="请输入配件名称"
              allow-clear
            />
          </label>
          <label class="parts-adjust-field">
            <span>配件类别</span>
            <a-select
              v-model:value="filter.categoryId"
              :loading="optionsLoading"
              :options="categoryOptions"
              placeholder="请选择配件类别"
              popup-class-name="parts-adjust-select-dropdown"
              show-search
              :filter-option="filterErpBusinessPartnerOption"
              allow-clear
            />
          </label>
          <label class="parts-adjust-field">
            <span>供应商</span>
            <SupplierLazySelect
              v-model:value="filter.supplierId"
              placeholder="请选择供应商"
              popup-class-name="parts-adjust-select-dropdown"
              show-search
              allow-clear
            />
          </label>
          <label class="parts-adjust-field">
            <span>适用车型</span>
            <a-input
              v-model:value="filter.vehicleModel"
              placeholder="请输入适用车型"
              allow-clear
            />
          </label>
          <label class="parts-adjust-field">
            <span>产地</span>
            <a-input
              v-model:value="filter.originPlace"
              placeholder="请输入产地"
              allow-clear
            />
          </label>
          <label class="parts-adjust-field">
            <span>品牌</span>
            <a-input
              v-model:value="filter.brand"
              placeholder="请输入品牌"
              allow-clear
            />
          </label>
          <label class="parts-adjust-field">
            <span>仓库</span>
            <a-select
              v-model:value="filter.warehouseId"
              :loading="optionsLoading"
              :options="warehouseOptions"
              placeholder="请选择仓库"
              popup-class-name="parts-adjust-select-dropdown"
              show-search
              option-filter-prop="label"
              allow-clear
            />
          </label>
        </div>
      </section>

      <section class="parts-adjust-section">
        <header class="parts-adjust-section__header">
          <div>
            <div class="parts-adjust-section__title">调整价格</div>
            <div class="parts-adjust-section__description">
              按数据源价格和计算规则批量生成目标价格
            </div>
          </div>
          <a-button
            type="primary"
            :loading="executingPrice"
            :disabled="noVisiblePriceTypeOptions"
            @click="handlePriceExecute"
          >
            执行价格调整
          </a-button>
        </header>

        <div class="parts-adjust-grid">
          <label class="parts-adjust-field">
            <span>目标价格</span>
            <a-select
              v-model:value="priceForm.targetPriceType"
              :options="visibleTargetPriceTypeOptions"
              :disabled="!visibleTargetPriceTypeOptions.length"
              :not-found-content="'当前账号没有可用的目标价格字段权限'"
              placeholder="当前账号没有可用的目标价格字段权限"
              popup-class-name="parts-adjust-select-dropdown"
            />
          </label>
          <label class="parts-adjust-field">
            <span>数据源</span>
            <a-select
              v-model:value="priceForm.sourcePriceType"
              :options="visibleSourcePriceTypeOptions"
              :disabled="!visibleSourcePriceTypeOptions.length"
              :not-found-content="'当前账号没有可用的数据源价格字段权限'"
              placeholder="当前账号没有可用的数据源价格字段权限"
              popup-class-name="parts-adjust-select-dropdown"
            />
          </label>
          <label class="parts-adjust-field">
            <span>调整方式</span>
            <a-select
              v-model:value="priceForm.adjustMethod"
              :options="adjustMethodOptions"
              popup-class-name="parts-adjust-select-dropdown"
            />
          </label>
          <label class="parts-adjust-field">
            <span>调整系数</span>
            <a-input-number
              v-model:value="priceForm.adjustCoefficient"
              :precision="4"
              :min="0"
              class="w-full"
            />
          </label>
          <label class="parts-adjust-field">
            <span>保留小数</span>
            <a-select
              v-model:value="priceForm.decimalPlaces"
              :options="decimalPlacesOptions"
              popup-class-name="parts-adjust-select-dropdown"
            />
          </label>
          <div class="parts-adjust-preview">
            <span class="parts-adjust-preview__label">计算预览</span>
            <code>{{ pricePreview }}</code>
          </div>
        </div>
      </section>

      <section class="parts-adjust-section">
        <header class="parts-adjust-section__header">
          <div>
            <div class="parts-adjust-section__title">调整库存上下限</div>
            <div class="parts-adjust-section__description">
              只更新已填写的项目，留空项目保持原值
            </div>
          </div>
          <a-button :loading="executingStock" @click="openStockPasswordModal">
            执行库存调整
          </a-button>
        </header>

        <div class="parts-adjust-grid parts-adjust-grid--stock">
          <label class="parts-adjust-field">
            <span>库存上限</span>
            <a-input-number
              v-model:value="stockForm.stockMax"
              :min="0"
              :precision="0"
              placeholder="不填则不修改"
              class="w-full"
            />
          </label>
          <label class="parts-adjust-field">
            <span>库存下限</span>
            <a-input-number
              v-model:value="stockForm.stockMin"
              :min="0"
              :precision="0"
              placeholder="不填则不修改"
              class="w-full"
            />
          </label>
          <label class="parts-adjust-field">
            <span>标准库存</span>
            <a-input-number
              v-model:value="stockForm.stockStandard"
              :min="0"
              :precision="0"
              placeholder="不填则不修改"
              class="w-full"
            />
          </label>
        </div>
      </section>
    </div>

    <a-modal
      v-model:open="passwordModalVisible"
      title="请输入调整口令"
      :confirm-loading="executingStock"
      :width="380"
      ok-text="确认调整"
      cancel-text="取消"
      @ok="handlePasswordConfirm"
      @cancel="handlePasswordCancel"
    >
      <a-form
        layout="horizontal"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item label="调整口令">
          <a-input-password
            v-model:value="passwordInput"
            placeholder="请输入调整口令"
            @press-enter="handlePasswordConfirm"
          />
        </a-form-item>
        <a-form-item
          v-if="passwordError"
          :wrapper-col="{ offset: 6, span: 16 }"
        >
          <span class="text-red-500">{{ passwordError }}</span>
        </a-form-item>
      </a-form>
    </a-modal>
  </Modal>
</template>

<style scoped>
.parts-adjust-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px;
  font-size: 12px;
}

.parts-adjust-modal :deep(.ant-alert) {
  padding: 8px 12px;
}

.parts-adjust-modal :deep(.ant-alert-message) {
  font-size: 12px;
  font-weight: 600;
}

.parts-adjust-modal :deep(.ant-alert-description) {
  margin-top: 1px;
  font-size: 12px;
}

.parts-adjust-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.parts-adjust-section__header {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.parts-adjust-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.parts-adjust-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.parts-adjust-section__description {
  margin-top: 2px;
  padding-left: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.parts-adjust-section__header :deep(.ant-btn) {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
}

.parts-adjust-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 16px;
  padding: 12px;
}

.parts-adjust-grid--stock {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.parts-adjust-field {
  display: grid;
  min-width: 0;
  align-items: center;
  grid-template-columns: 72px minmax(0, 1fr);
}

.parts-adjust-field > span {
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  line-height: 1.2;
  white-space: nowrap;
}

.parts-adjust-field :deep(.ant-input),
.parts-adjust-field :deep(.ant-input-number),
.parts-adjust-field :deep(.ant-select-single) {
  width: 100%;
  height: 32px;
  font-size: 12px;
}

.parts-adjust-field :deep(.ant-input-number-input) {
  height: 30px;
  font-size: 12px;
}

.parts-adjust-field :deep(.ant-select-selection-item),
.parts-adjust-field :deep(.ant-select-selection-placeholder) {
  font-size: 12px;
}

.parts-adjust-preview {
  display: grid;
  min-width: 0;
  align-items: center;
  grid-column: span 3;
  grid-template-columns: 72px minmax(0, 1fr);
}

.parts-adjust-preview__label {
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
}

.parts-adjust-preview code {
  min-width: 0;
  height: 32px;
  padding: 6px 10px;
  overflow: hidden;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 48%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.parts-adjust-select-dropdown .ant-select-item),
:global(.parts-adjust-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 1024px) {
  .parts-adjust-grid,
  .parts-adjust-grid--stock {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .parts-adjust-preview {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .parts-adjust-section__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .parts-adjust-grid,
  .parts-adjust-grid--stock {
    grid-template-columns: minmax(0, 1fr);
  }

  .parts-adjust-preview {
    grid-column: span 1;
  }
}
</style>
