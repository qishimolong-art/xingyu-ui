<script lang="ts" setup>
import { useCandidatePopupClass } from '#/views/erp/utils/candidate-focus';
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Form as AForm, FormItem, message, Select } from 'ant-design-vue';

import { getBaseDataSimpleList } from '#/api/erp/base';
import { getCurrentUserHiddenFields } from '#/api/system/permission/field';
import {
  loadOrderPriceCustomFieldNames,
  mapVisibleSelectablePriceLevelOptions,
} from '#/views/erp/sale/utils/price-level';

const candidatePopupClass = useCandidatePopupClass();

const emit = defineEmits(['success']);

type SalePriceBatchDocumentType = 'cart' | 'quote';
type BatchUpdateMode = 'local' | 'server';

interface ModalData {
  documentId?: number;
  documentType?: SalePriceBatchDocumentType;
  itemCount?: number;
  itemIds?: number[];
  mode?: BatchUpdateMode;
}

const DOCUMENT_LABEL: Record<SalePriceBatchDocumentType, string> = {
  cart: '销售手推车',
  quote: '报价订单',
};

const documentId = ref<number>();
const documentType = ref<SalePriceBatchDocumentType>('quote');
const itemCount = ref(0);
const itemIds = ref<number[]>([]);
const mode = ref<BatchUpdateMode>('local');
const priceLevel = ref<number>();
const priceLevelOptions = ref<{ label: string; value: number }[]>([]);

const selectedCount = computed(() =>
  mode.value === 'server' ? itemIds.value.length : itemCount.value,
);
const title = computed(
  () =>
    `批量调整${DOCUMENT_LABEL[documentType.value]}价格（已选 ${selectedCount.value} 条）`,
);

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(option?.label ?? '');
  return label.toLowerCase().includes(keyword);
}

function normalizePriceLevel(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

async function loadPriceLevelOptions() {
  const [priceLevels, hiddenFields, orderPriceFieldNames] = await Promise.all([
    getBaseDataSimpleList('price_level'),
    getCurrentUserHiddenFields('erp_product'),
    loadOrderPriceCustomFieldNames(),
  ]);
  priceLevelOptions.value = mapVisibleSelectablePriceLevelOptions(
    priceLevels || [],
    hiddenFields || [],
    orderPriceFieldNames || [],
  );
  priceLevel.value = undefined;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const currentMode = mode.value;
    const currentDocumentId = documentId.value;
    const currentItemIds = [...itemIds.value];
    const currentPriceLevel = normalizePriceLevel(priceLevel.value);
    const currentSelectedCount =
      currentMode === 'server' ? currentItemIds.length : itemCount.value;

    if (currentSelectedCount === 0) {
      message.warning('请先勾选需要批量调整价格的销售明细');
      return;
    }
    if (currentPriceLevel === undefined) {
      message.warning('请选择价格体系');
      return;
    }

    modalApi.lock();
    try {
      await modalApi.close();
      emit('success', {
        documentId: currentDocumentId,
        itemIds: currentItemIds,
        mode: currentMode,
        priceLevel: currentPriceLevel,
      });
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      documentId.value = undefined;
      documentType.value = 'quote';
      itemCount.value = 0;
      itemIds.value = [];
      mode.value = 'local';
      priceLevel.value = undefined;
      priceLevelOptions.value = [];
      return;
    }
    const data = modalApi.getData<ModalData>();
    documentId.value = data?.documentId;
    documentType.value = data?.documentType || 'quote';
    itemCount.value = data?.itemCount || 0;
    itemIds.value = data?.itemIds || [];
    mode.value = data?.mode || 'local';
    await loadPriceLevelOptions();
  },
});
</script>

<template>
  <Modal :title="title" class="w-[480px]">
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <FormItem label="价格体系">
        <Select
          v-model:value="priceLevel"
          :filter-option="filterSelectOption"
          :options="priceLevelOptions"
          allow-clear
          show-search
          placeholder="请选择价格体系"
          :popup-class-name="
            candidatePopupClass('sale-document-item-select-dropdown')
          "
          class="w-full"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
