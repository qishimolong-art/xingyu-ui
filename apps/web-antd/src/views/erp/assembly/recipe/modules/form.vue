<script lang="ts" setup>
import type { ErpProductApi } from '#/api/erp/product/product';

import { computed, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import {
  Button,
  Input,
  message,
  Pagination,
  RadioGroup,
  Select,
  Table,
} from 'ant-design-vue';

import {
  createAssemblyRecipe,
  ErpAssemblyRecipeApi,
  getAssemblyRecipe,
  getAssemblyRecipeItemPage,
  updateAssemblyRecipe,
} from '#/api/erp/assembly/recipe';
import {
  formatAssemblyAmountInput,
  formatAssemblyNaturalDecimal,
  isAssemblyDecimalDraft,
  validateAssemblyDecimal,
} from '#/views/erp/assembly/utils/decimal-input';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import ProductSelectModal from '#/views/erp/product/product/modules/product-select-modal.vue';

const emit = defineEmits(['success']);
const PAGE_SIZE = 20;
const { hasAccessByCodes } = useAccess();

type EditableItem = ErpAssemblyRecipeApi.RecipeItem & {
  clientKey?: string;
  quantityPerSetText?: string;
  quantityPerSetTextVersion?: number;
};

const formData = ref<ErpAssemblyRecipeApi.Recipe>({
  productId: 0,
  purpose: ErpAssemblyRecipeApi.PURPOSE_ASSEMBLY,
  laborCostPerSet: 0,
  status: 1,
  items: [],
});
const readonly = ref(false);
const laborCostPerSetText = ref('0.00');
const laborCostPerSetTextVersion = ref(0);
const finishedProduct = ref<Partial<ErpProductApi.Product>>();
const pageNo = ref(1);
const pageSize = ref(PAGE_SIZE);
const persistedTotal = ref(0);
const pageRows = ref<EditableItem[]>([]);
const pageCache = new Map<string, EditableItem[]>();
const deletedIds = new Set<number>();
const newRows = ref<EditableItem[]>([]);
const loadingItems = ref(false);
let itemLoadVersion = 0;
let modalOpenVersion = 0;
const finishedSelectRef = ref<InstanceType<typeof ProductSelectModal>>();
const componentSelectRef = ref<InstanceType<typeof ProductSelectModal>>();

const title = computed(() =>
  readonly.value ? '查看模块' : formData.value.id ? '编辑模块' : '新增模块',
);
const tableRows = computed(() =>
  pageNo.value === 1 ? [...pageRows.value, ...newRows.value] : pageRows.value,
);
const displayTotal = computed(
  () => persistedTotal.value - deletedIds.size + newRows.value.length,
);
const canEdit = computed(
  () => readonly.value && hasAccessByCodes(['erp:assembly-recipe:update']),
);

function resetState() {
  itemLoadVersion += 1;
  formData.value = {
    productId: 0,
    purpose: ErpAssemblyRecipeApi.PURPOSE_ASSEMBLY,
    laborCostPerSet: 0,
    status: 1,
    items: [],
  };
  finishedProduct.value = undefined;
  laborCostPerSetText.value = '0.00';
  laborCostPerSetTextVersion.value = 0;
  readonly.value = false;
  pageNo.value = 1;
  pageSize.value = PAGE_SIZE;
  persistedTotal.value = 0;
  pageRows.value = [];
  pageCache.clear();
  deletedIds.clear();
  newRows.value = [];
}

function toEditableItem(product: ErpProductApi.Product): EditableItem {
  return {
    clientKey: `new-${product.id}-${Date.now()}-${Math.random()}`,
    productId: product.id!,
    productCode: product.code,
    productName: product.name,
    productFactoryCode: product.factoryCode,
    productStandard: product.standard,
    productUnitName: product.unitName,
    batchNoEnabled: product.batchNoEnabled,
    quantityPerSet: 1,
    quantityPerSetText: '1',
    sort: displayTotal.value + 1,
  };
}

function hydrateEditableItem(
  item: ErpAssemblyRecipeApi.RecipeItem,
): EditableItem {
  return {
    ...item,
    quantityPerSetText: formatAssemblyNaturalDecimal(item.quantityPerSet),
  };
}

function updateLaborCostPerSetText(value: unknown) {
  const text = String(value ?? '');
  if (!isAssemblyDecimalDraft(text)) {
    message.warning('每套人工费最多支持 18 位整数和 6 位小数');
    laborCostPerSetTextVersion.value += 1;
    return;
  }
  laborCostPerSetText.value = text;
}

function blurLaborCostPerSet() {
  const parsed = validateAssemblyDecimal(laborCostPerSetText.value, {
    allowZero: true,
    label: '每套人工费',
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    laborCostPerSetText.value = formatAssemblyAmountInput(
      formData.value.laborCostPerSet,
    );
    return;
  }
  formData.value.laborCostPerSet = parsed.value;
  laborCostPerSetText.value = formatAssemblyAmountInput(
    laborCostPerSetText.value,
  );
}

function updateQuantityPerSetText(row: EditableItem, value: unknown) {
  const text = String(value ?? '');
  if (!isAssemblyDecimalDraft(text)) {
    message.warning('每套用量最多支持 18 位整数和 6 位小数');
    row.quantityPerSetTextVersion = (row.quantityPerSetTextVersion ?? 0) + 1;
    return;
  }
  row.quantityPerSetText = text;
}

function blurQuantityPerSet(row: EditableItem) {
  const parsed = validateAssemblyDecimal(
    row.quantityPerSetText ?? row.quantityPerSet,
    { label: '每套用量' },
  );
  if (!parsed.ok) {
    message.warning(parsed.message);
    row.quantityPerSetText = formatAssemblyNaturalDecimal(row.quantityPerSet);
    return;
  }
  row.quantityPerSet = parsed.value;
  row.quantityPerSetText = formatAssemblyNaturalDecimal(row.quantityPerSetText);
}

async function loadItemPage(
  targetPage = pageNo.value,
  targetPageSize = pageSize.value,
) {
  const loadVersion = ++itemLoadVersion;
  pageNo.value = targetPage;
  pageSize.value = targetPageSize;
  if (!formData.value.id) {
    pageRows.value = [];
    return;
  }
  const cacheKey = `${targetPageSize}:${targetPage}`;
  const cached = pageCache.get(cacheKey);
  if (cached) {
    pageRows.value = cached;
    return;
  }
  loadingItems.value = true;
  try {
    const result = await getAssemblyRecipeItemPage({
      recipeId: formData.value.id,
      pageNo: targetPage,
      pageSize: targetPageSize,
    });
    if (loadVersion !== itemLoadVersion) return;
    persistedTotal.value = result.total;
    const editedById = new Map<number, EditableItem>();
    for (const cachedRows of pageCache.values()) {
      cachedRows.forEach((row) => row.id && editedById.set(row.id, row));
    }
    const rows = (result.list || [])
      .filter((item) => !item.id || !deletedIds.has(item.id))
      .map(
        (item) =>
          (item.id && editedById.get(item.id)) || hydrateEditableItem(item),
      );
    pageCache.set(cacheKey, rows);
    pageRows.value = rows;
  } finally {
    if (loadVersion === itemLoadVersion) {
      loadingItems.value = false;
    }
  }
}

async function fetchAllItems() {
  if (!formData.value.id) return [] as EditableItem[];
  const all: EditableItem[] = [];
  const chunkSize = 100;
  const pages = Math.max(1, Math.ceil(persistedTotal.value / chunkSize));
  for (let current = 1; current <= pages; current += 1) {
    const result = await getAssemblyRecipeItemPage({
      recipeId: formData.value.id,
      pageNo: current,
      pageSize: chunkSize,
    });
    all.push(...(result.list || []).map((item) => hydrateEditableItem(item)));
  }
  const editedById = new Map<number, EditableItem>();
  for (const rows of pageCache.values()) {
    rows.forEach((row) => row.id && editedById.set(row.id, row));
  }
  return all
    .filter((row) => !row.id || !deletedIds.has(row.id))
    .map((row) => (row.id && editedById.get(row.id)) || row);
}

function selectFinished() {
  if (!readonly.value) finishedSelectRef.value?.open();
}

function handleFinishedSelected(products: ErpProductApi.Product[]) {
  const product = products[0];
  if (!product) return;
  if (newRows.value.some((row) => row.productId === product.id)) {
    message.warning('成品不能同时作为组成配件');
    return;
  }
  formData.value.productId = product.id!;
  formData.value.moduleCode = product.code || '';
  formData.value.moduleName = product.name || '';
  finishedProduct.value = product;
}

function selectComponents() {
  if (!readonly.value) componentSelectRef.value?.open();
}

async function handleComponentsSelected(products: ErpProductApi.Product[]) {
  const knownIds = new Set<number>([
    ...newRows.value.map((row) => row.productId),
    ...[...pageCache.values()].flat().map((row) => row.productId),
  ]);
  const additions = products.filter((product) => {
    if (product.id === formData.value.productId) return false;
    if (knownIds.has(product.id!)) return false;
    knownIds.add(product.id!);
    return true;
  });
  newRows.value.push(...additions.map((item) => toEditableItem(item)));
  pageNo.value = 1;
  await loadItemPage(1, pageSize.value);
  if (additions.length < products.length) {
    message.info('已忽略成品本身或重复配件');
  }
}

function removeItem(row: EditableItem) {
  if (row.id) {
    deletedIds.add(row.id);
    for (const [page, rows] of pageCache.entries()) {
      pageCache.set(
        page,
        rows.filter((item) => item.id !== row.id),
      );
    }
    pageRows.value = pageRows.value.filter((item) => item.id !== row.id);
  } else {
    newRows.value = newRows.value.filter(
      (item) => item.clientKey !== row.clientKey,
    );
  }
}

function rowKey(row: EditableItem) {
  return row.id || row.clientKey || `${row.productId}-${row.sort}`;
}

async function submit() {
  if (!formData.value.productId) {
    message.warning('请选择组成件');
    return;
  }
  if (!formData.value.moduleCode?.trim()) {
    message.warning('请输入模块编码');
    return;
  }
  if (!formData.value.moduleName?.trim()) {
    message.warning('请输入模块名称');
    return;
  }
  const laborCost = validateAssemblyDecimal(laborCostPerSetText.value, {
    allowZero: true,
    label: '每套人工费',
  });
  if (!laborCost.ok) {
    message.warning(laborCost.message);
    return;
  }
  const allItems = [...(await fetchAllItems()), ...newRows.value];
  if (allItems.length === 0) {
    message.warning('请至少选择一个组成配件');
    return;
  }
  const parsedQuantities = new Map<EditableItem, number>();
  for (const row of allItems) {
    const parsed = validateAssemblyDecimal(
      row.quantityPerSetText ?? row.quantityPerSet,
      { label: '每套用量' },
    );
    if (!parsed.ok) {
      message.warning(parsed.message);
      return;
    }
    parsedQuantities.set(row, parsed.value);
  }
  const productIds = allItems.map((row) => row.productId);
  if (productIds.includes(formData.value.productId)) {
    message.warning('成品不能作为自身组成配件');
    return;
  }
  if (new Set(productIds).size !== productIds.length) {
    message.warning('组成配件不能重复');
    return;
  }
  modalApi.lock();
  try {
    const payload: ErpAssemblyRecipeApi.Recipe = {
      ...formData.value,
      purpose: ErpAssemblyRecipeApi.PURPOSE_ASSEMBLY,
      moduleCode: formData.value.moduleCode.trim(),
      moduleName: formData.value.moduleName.trim(),
      laborCostPerSet: laborCost.value,
      items: allItems.map((row, index) => ({
        id: row.id,
        productId: row.productId,
        quantityPerSet: parsedQuantities.get(row)!,
        sort: index,
        remark: row.remark,
      })),
    };
    await (payload.id
      ? updateAssemblyRecipe(payload)
      : createAssemblyRecipe(payload));
    message.success('保存成功');
    emit('success');
    await modalApi.close();
  } finally {
    modalApi.unlock();
  }
}

const [Modal, modalApi] = useVbenModal({
  onConfirm: submit,
  async onOpenChange(open) {
    const openVersion = ++modalOpenVersion;
    if (!open) {
      resetState();
      return;
    }
    resetState();
    const source = modalApi.getData<
      ErpAssemblyRecipeApi.Recipe & { readonly?: boolean }
    >();
    readonly.value = !!source?.readonly;
    if (!source?.id) return;
    modalApi.lock();
    try {
      const data = await getAssemblyRecipe(source.id, false);
      if (openVersion !== modalOpenVersion) return;
      if (!data) {
        message.error('组装配方不存在或无权访问');
        await modalApi.close();
        return;
      }
      formData.value = data;
      formData.value.purpose =
        data.purpose || ErpAssemblyRecipeApi.PURPOSE_ASSEMBLY;
      formData.value.moduleCode = data.moduleCode || data.productCode || '';
      formData.value.moduleName = data.moduleName || data.productName || '';
      formData.value.laborCostPerSet = data.laborCostPerSet || 0;
      laborCostPerSetText.value = formatAssemblyAmountInput(
        data.laborCostPerSet,
      );
      finishedProduct.value = {
        id: data.productId,
        code: data.productCode,
        name: data.productName,
        factoryCode: data.productFactoryCode,
        standard: data.productStandard,
        unitName: data.productUnitName,
      };
      persistedTotal.value = data.itemCount || 0;
      await loadItemPage(1, PAGE_SIZE);
    } finally {
      modalApi.unlock();
    }
    await nextTick();
  },
});
</script>

<template>
  <Modal
    :title="title"
    class="assembly-recipe-modal !w-full"
    bordered
    content-class="p-0"
    fullscreen
    :fullscreen-button="false"
    :show-confirm-button="!readonly"
  >
    <ProductSelectModal
      ref="finishedSelectRef"
      @success="handleFinishedSelected"
    />
    <ProductSelectModal
      ref="componentSelectRef"
      @success="handleComponentsSelected"
    />

    <div class="assembly-form">
      <section class="assembly-section">
        <header class="flex items-center justify-between">
          <span class="assembly-section__title">基本信息</span>
          <Button
            v-if="canEdit"
            type="primary"
            size="small"
            @click="readonly = false"
          >
            编辑
          </Button>
        </header>
        <div class="assembly-fields">
          <div class="field">
            <label>用途 <b>*</b></label>
            <Select
              v-model:value="formData.purpose"
              :disabled="readonly"
              :options="[{ label: '装配', value: 1 }]"
            />
          </div>
          <div class="field">
            <label>状态</label>
            <RadioGroup
              v-model:value="formData.status"
              class="assembly-status"
              :disabled="readonly"
              option-type="button"
              button-style="solid"
              :options="[
                { label: '启用', value: 1 },
                { label: '停用', value: 0 },
              ]"
            />
          </div>
          <div class="field">
            <label>组成件 <b>*</b></label>
            <Input
              readonly
              :value="finishedProduct?.name || ''"
              placeholder="请选择最终组装入库的组成件"
              @click="selectFinished"
            >
              <template #addonAfter>
                <Button
                  type="link"
                  size="small"
                  :disabled="readonly"
                  @click.stop="selectFinished"
                >
                  选择
                </Button>
              </template>
            </Input>
          </div>
          <div class="field">
            <label>组成件编码</label>
            <Input
              readonly
              :value="finishedProduct?.code || ''"
              placeholder="选择组成件后自动带出"
            />
          </div>
          <div class="field">
            <label>模块编码 <b>*</b></label>
            <Input
              v-model:value="formData.moduleCode"
              :disabled="readonly"
              :maxlength="64"
            />
          </div>
          <div class="field">
            <label>模块名称 <b>*</b></label>
            <Input
              v-model:value="formData.moduleName"
              :disabled="readonly"
              :maxlength="255"
            />
          </div>
          <div class="field">
            <label>人工费用（每套） <b>*</b></label>
            <Input
              :key="`labor-cost-${laborCostPerSetTextVersion}`"
              :value="laborCostPerSetText"
              :disabled="readonly"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              class="w-full"
              @update:value="updateLaborCostPerSetText"
              @blur="blurLaborCostPerSet"
            />
          </div>
          <div class="field">
            <label>备注</label>
            <Input
              v-model:value="formData.remark"
              :disabled="readonly"
              :maxlength="500"
            />
          </div>
        </div>
      </section>

      <section class="assembly-section">
        <header class="flex items-center justify-between">
          <span class="assembly-section__title">配方明细</span>
          <Button
            v-if="!readonly"
            type="primary"
            size="small"
            @click="selectComponents"
          >
            选择配件
          </Button>
        </header>
        <Table
          size="small"
          :loading="loadingItems"
          :data-source="tableRows"
          :pagination="false"
          :row-key="rowKey"
          :scroll="{ x: 1000, y: 400 }"
        >
          <Table.Column title="序号" :width="70">
            <template #default="{ index }">
              {{ (pageNo - 1) * pageSize + index + 1 }}
            </template>
          </Table.Column>
          <Table.Column
            title="配件编码"
            data-index="productCode"
            :width="130"
          />
          <Table.Column
            title="配件名称"
            data-index="productName"
            :width="190"
          />
          <Table.Column
            title="厂家编码"
            data-index="productFactoryCode"
            :width="130"
          />
          <Table.Column
            title="规格型号"
            data-index="productStandard"
            :width="140"
          />
          <Table.Column title="单位" data-index="productUnitName" :width="70" />
          <Table.Column title="每套用量" :width="140">
            <template #default="{ record }">
              <Input
                :key="`quantity-${rowKey(record)}-${record.quantityPerSetTextVersion ?? 0}`"
                :value="record.quantityPerSetText"
                :disabled="readonly"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                class="w-full"
                @update:value="
                  (value) => updateQuantityPerSetText(record, value)
                "
                @blur="blurQuantityPerSet(record)"
              />
            </template>
          </Table.Column>
          <Table.Column title="备注" :width="180">
            <template #default="{ record }">
              <Input
                v-model:value="record.remark"
                :disabled="readonly"
                :maxlength="500"
              />
            </template>
          </Table.Column>
          <Table.Column v-if="!readonly" title="操作" fixed="right" :width="70">
            <template #default="{ record }">
              <Button
                type="link"
                danger
                size="small"
                @click="removeItem(record)"
              >
                删除
              </Button>
            </template>
          </Table.Column>
        </Table>
        <div class="flex justify-end p-3">
          <Pagination
            v-model:current="pageNo"
            v-model:page-size="pageSize"
            :total="displayTotal"
            :page-size-options="['10', '20', '50', '100']"
            show-size-changer
            show-quick-jumper
            @change="loadItemPage"
          />
        </div>
      </section>

      <section v-if="formData.id" class="assembly-section assembly-audit">
        <header>
          <span class="assembly-section__title">审计信息</span>
        </header>
        <ErpAuditInfo title="" :record="formData" />
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.assembly-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}
.assembly-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}
.assembly-section > header {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}
.assembly-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 600;
}
.assembly-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}
.assembly-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 12px;
}
.field {
  display: grid;
  min-width: 0;
  align-items: center;
  grid-template-columns: 84px minmax(0, 1fr);
}
.assembly-fields :deep(.ant-input),
.assembly-fields :deep(.ant-input-group-wrapper),
.assembly-fields :deep(.ant-input-number),
.assembly-fields :deep(.ant-select) {
  width: 100%;
  min-width: 0;
  font-size: 12px;
}
.assembly-fields :deep(.ant-input),
.assembly-fields :deep(.ant-input-number),
.assembly-fields :deep(.ant-select-single),
.assembly-fields :deep(.ant-select-selector) {
  min-height: 32px;
}
.assembly-fields :deep(.ant-input),
.assembly-fields :deep(.ant-input-number),
.assembly-fields :deep(.ant-select-selector) {
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}
.assembly-fields :deep(.ant-input-number-input) {
  height: 30px;
  font-size: 12px;
}
.assembly-fields :deep(.ant-select-selection-item),
.assembly-fields :deep(.ant-select-selection-placeholder) {
  font-size: 12px;
  line-height: 30px !important;
}
.assembly-fields :deep(.ant-input-group-addon) {
  padding: 0;
  background: hsl(var(--background));
  border-color: hsl(var(--border));
}
.assembly-fields :deep(.ant-input-group-addon .ant-btn) {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
.field label {
  min-width: 0;
  padding-right: 10px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
.field label b {
  color: #f5222d;
}
.assembly-status {
  display: flex;
  width: 100%;
}
.assembly-status :deep(.ant-radio-button-wrapper) {
  flex: 1 1 0;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 30px;
  text-align: center;
}
.assembly-section :deep(.ant-table) {
  font-size: 12px;
}
.assembly-section :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.assembly-section :deep(.ant-table .ant-input),
.assembly-section :deep(.ant-table .ant-input-number) {
  min-height: 30px;
  border-radius: 6px;
  font-size: 12px;
}
.assembly-section :deep(.ant-pagination) {
  font-size: 12px;
}
.assembly-audit :deep(.erp-audit-info) {
  padding: 12px;
}
.assembly-audit :deep(.erp-audit-info *) {
  font-size: 12px;
}
@media (max-width: 1100px) {
  .assembly-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 680px) {
  .assembly-fields {
    grid-template-columns: 1fr;
  }
  .field {
    grid-template-columns: 78px minmax(0, 1fr);
  }
}
</style>
