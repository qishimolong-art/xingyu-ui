<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { batchAdjustPrice } from '#/api/erp/parts/price-adjust';
import { getWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { useFieldPermission } from '#/composables/useFieldPermission';

import {
  adjustMethodOptions,
  decimalPlacesOptions,
  filterPriceTypeOptions,
  getPreferredVisiblePriceType,
  sourcePriceTypeOptions,
  targetPriceTypeOptions,
} from './data';

defineOptions({ name: 'ErpPartsPriceAdjustModal' });

const emit = defineEmits<{ success: [] }>();
const {
  hiddenFields,
  loadHiddenFields,
  loaded: hiddenFieldsLoaded,
} = useFieldPermission('erp_product');

// 区块一：筛选条件
const filter = reactive({
  code: '',
  name: '',
  vehicleModel: '',
  originPlace: '',
  brand: '',
  warehouseId: undefined as number | undefined,
});

// 区块二：价格调整
const priceForm = reactive({
  targetPriceType: 'RETAIL_PRICE' as string | undefined,
  sourcePriceType: 'REFERENCE_PRICE' as string | undefined,
  adjustMethod: 'MULTIPLY',
  adjustCoefficient: 1.2,
  decimalPlaces: 2,
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

// 价格调整预览公式
const pricePreview = computed(() => {
  if (noVisiblePriceTypeOptions.value) {
    return '当前账号没有可用的价格字段权限';
  }
  if (!priceForm.targetPriceType || !priceForm.sourcePriceType) {
    return '请选择目标价格和数据源';
  }
  const target =
    visibleTargetPriceTypeOptions.value.find(
      (o) => o.value === priceForm.targetPriceType,
    )?.label ?? '请选择目标价格';
  const source =
    visibleSourcePriceTypeOptions.value.find(
      (o) => o.value === priceForm.sourcePriceType,
    )?.label ?? '请选择数据源';
  const methodSymbol: Record<string, string> = {
    ADD: '+',
    SUBTRACT: '-',
    MULTIPLY: '×',
    DIVIDE: '÷',
  };
  const symbol = methodSymbol[priceForm.adjustMethod] ?? priceForm.adjustMethod;
  return `${target} = round(${source} ${symbol} ${priceForm.adjustCoefficient}, ${priceForm.decimalPlaces})`;
});

// 仓库列表
const warehouseOptions = ref<{ label: string; value: number }[]>([]);
getWarehouseSimpleList().then((list: any[]) => {
  warehouseOptions.value = list.map((w) => ({ label: w.name, value: w.id }));
});

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen) {
    if (isOpen) {
      void loadHiddenFields();
      // 从 modalApi.getData() 拿父组件传入的 initFilter
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
    code: '',
    name: '',
    vehicleModel: '',
    originPlace: '',
    brand: '',
    warehouseId: undefined,
  });
  priceForm.targetPriceType = getPreferredVisiblePriceType(
    targetPriceTypeOptions,
    hiddenFields.value,
    'RETAIL_PRICE',
  );
  priceForm.sourcePriceType = getPreferredVisiblePriceType(
    sourcePriceTypeOptions,
    hiddenFields.value,
    'REFERENCE_PRICE',
  );
  priceForm.adjustMethod = 'MULTIPLY';
  priceForm.adjustCoefficient = 1.2;
  priceForm.decimalPlaces = 2;
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
  try {
    const count = await batchAdjustPrice({
      filterCondition: buildFilter(),
      targetPriceType: priceForm.targetPriceType,
      sourcePriceType: priceForm.sourcePriceType,
      adjustMethod: priceForm.adjustMethod,
      adjustCoefficient: priceForm.adjustCoefficient,
      decimalPlaces: priceForm.decimalPlaces,
    });
    message.success(`已成功调整 ${count} 条配件`);
    emit('success');
    modalApi.close();
  } catch {
    // 错误由全局请求处理
  }
}

function buildFilter() {
  return {
    code: filter.code || undefined,
    name: filter.name || undefined,
    vehicleModel: filter.vehicleModel || undefined,
    originPlace: filter.originPlace || undefined,
    brand: filter.brand || undefined,
    warehouseId: filter.warehouseId,
  };
}

watch(hiddenFields, syncVisiblePriceTypes, { immediate: true });
</script>

<template>
  <Modal title="查询配件属性综合" :footer="false" class="!w-[700px]">
    <!-- 区块一：筛选条件 -->
    <a-card title="筛选条件" :bordered="false" size="small" class="mb-3">
      <a-form
        layout="horizontal"
        :label-col="{ span: 5 }"
        :wrapper-col="{ span: 17 }"
      >
        <a-form-item label="编码">
          <a-input
            v-model:value="filter.code"
            placeholder="请输入配件编码"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="零件名称">
          <a-input
            v-model:value="filter.name"
            placeholder="请输入零件名称"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="适用车型">
          <a-input
            v-model:value="filter.vehicleModel"
            placeholder="请输入适用车型"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="产地">
          <a-input
            v-model:value="filter.originPlace"
            placeholder="请输入产地"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="品牌">
          <a-input
            v-model:value="filter.brand"
            placeholder="请输入品牌"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="仓库">
          <a-select
            v-model:value="filter.warehouseId"
            :options="warehouseOptions"
            placeholder="请选择仓库"
            allow-clear
          />
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 区块二：调整价格 -->
    <a-card title="调整价格" :bordered="false" size="small">
      <a-form
        layout="horizontal"
        :label-col="{ span: 5 }"
        :wrapper-col="{ span: 17 }"
      >
        <a-form-item label="调整（目标价）">
          <a-select
            v-model:value="priceForm.targetPriceType"
            :options="visibleTargetPriceTypeOptions"
            :disabled="!visibleTargetPriceTypeOptions.length"
            :not-found-content="'当前账号没有可用的目标价格字段权限'"
            placeholder="当前账号没有可用的目标价格字段权限"
          />
        </a-form-item>
        <a-form-item label="数据源">
          <a-select
            v-model:value="priceForm.sourcePriceType"
            :options="visibleSourcePriceTypeOptions"
            :disabled="!visibleSourcePriceTypeOptions.length"
            :not-found-content="'当前账号没有可用的数据源价格字段权限'"
            placeholder="当前账号没有可用的数据源价格字段权限"
          />
        </a-form-item>
        <a-form-item label="调整方式">
          <a-select
            v-model:value="priceForm.adjustMethod"
            :options="adjustMethodOptions"
          />
        </a-form-item>
        <a-form-item label="系数">
          <a-input-number
            v-model:value="priceForm.adjustCoefficient"
            :precision="4"
            :min="0"
            class="w-full"
          />
        </a-form-item>
        <a-form-item label="保留小数">
          <a-select
            v-model:value="priceForm.decimalPlaces"
            :options="decimalPlacesOptions"
          />
        </a-form-item>
        <a-form-item label="计算预览">
          <span class="text-gray-600 text-sm">{{ pricePreview }}</span>
        </a-form-item>
        <a-form-item :wrapper-col="{ offset: 5, span: 17 }">
          <a-button
            type="primary"
            :disabled="noVisiblePriceTypeOptions"
            @click="handlePriceExecute"
          >
            执行(S)
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </Modal>
</template>
